import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app, process_triage
from app.modules import intake, triage
import app.main as main_module
from app.modules.matching import IST, match_caregivers
from app.modules.routing import CONTROLLED_RED_FLAGS, detect_language, route_request
from app.schemas import Location, TriageRequest
from app.storage import connection, initialize_database

DELHI = {"lat": 28.6139, "lng": 77.2090}
MORNING = datetime(2026, 1, 15, 8, 0, tzinfo=IST)

# Phrasings written independently of the labelled dataset to estimate generalisation.
HELD_OUT = [
    ("Can a nurse come to change my father's catheter?", "home_nursing"),
    ("need someone to give vitamin B12 injection at home", "home_nursing"),
    ("दादाजी के पैर के घाव पर पट्टी करनी है", "home_nursing"),
    ("operation ke tanke ki dressing karwani hai", "home_nursing"),
    ("Please arrange a lipid profile with home sample pickup", "lab_test_home"),
    ("मम्मी का थायराइड टेस्ट करवाना है घर से", "lab_test_home"),
    ("ghar pe blood test ho sakta hai kya kal", "lab_test_home"),
    ("I want to discuss my blood reports with a physician", "teleconsultation"),
    ("skin pe rash hai, online doctor se baat karni hai", "teleconsultation"),
    ("मुझे गैस की समस्या है, डॉक्टर से सलाह लेनी है", "teleconsultation"),
    ("My mother has been vomiting since last night, please send someone home", "paramedic_home_visit"),
    ("nani ko teen din se bukhar hai", "paramedic_home_visit"),
    ("पापा बहुत कमजोर हैं, घर पर कोई देख ले", "paramedic_home_visit"),
    ("my son has had loose motions for 2 days", "paramedic_home_visit"),
    ("help", None),
    ("koi hai?", None),
    ("पिताजी के लिए डॉक्टर चाहिए", None),
    ("I need to book an appointment", None),
]


class OfflinePipeline(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.patches = [patch.object(module, "get_groq_client", lambda: None) for module in (intake, triage, main_module)]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in self.patches:
            item.stop()

    async def triage(self, text, history=None, **extra):
        return await process_triage(TriageRequest(user_input=text, location=DELHI, conversation_history=history or [], **extra))

    async def test_mt001_latest_concern_wins_over_earlier_vague_turn(self):
        first = await self.triage("doctor chahiye")
        self.assertIsNone(first.care_type)
        self.assertTrue(first.follow_up_question)
        history = [{"role": "user", "content": "doctor chahiye"}, {"role": "assistant", "content": first.follow_up_question, "follow_up_question": first.follow_up_question}]
        second = await self.triage("mummy ko 2 din se bukhar hai, ghar pe dikhana hai", history)
        self.assertEqual((second.care_type, second.urgency), ("paramedic_home_visit", "same_day"))
        self.assertTrue(second.matched_caregivers)

    async def test_mt002_emergency_uses_controlled_vocab_and_no_caregivers(self):
        response = await self.triage("chest pain ho raha hai papa ko")
        self.assertEqual((response.care_type, response.urgency), ("emergency_112", "emergency"))
        self.assertIn("chest_pain", response.red_flags)
        self.assertEqual(response.matched_caregivers, [])

    async def test_red_flags_are_always_contract_vocabulary(self):
        for text in ["emergency, send ambulance", "oxygen 85", "vomiting blood", "पापा बेहोश हो गए"]:
            with self.subTest(text=text):
                response = await self.triage(text)
                self.assertEqual(response.care_type, "emergency_112")
                self.assertTrue(set(response.red_flags) <= set(CONTROLLED_RED_FLAGS))
        self.assertEqual((await self.triage("oxygen 85")).red_flags, ["breathlessness"])

    async def test_hindi_dataset_regressions(self):
        cases = {"सुबह से एसिडिटी है, डॉक्टर से सलाह चाहिए": "teleconsultation", "घर पर इंजेक्शन लगवाना है": "home_nursing", "माँ के लिए कुछ बुक करना है": None}
        for text, expected in cases.items():
            with self.subTest(text=text):
                response = await self.triage(text)
                self.assertEqual(response.care_type, expected)
                self.assertEqual(response.detected_language, "Hindi")
        follow_up = await self.triage("माँ के लिए कुछ बुक करना है")
        self.assertRegex(follow_up.follow_up_question, "[\u0900-\u097F]")

    async def test_held_out_paraphrases(self):
        for text, expected in HELD_OUT:
            with self.subTest(text=text):
                self.assertEqual((await self.triage(text)).care_type, expected)

    async def test_follow_ups_are_bounded(self):
        history = []
        for _ in range(2):
            response = await self.triage("help", history)
            self.assertIsNone(response.care_type)
            history += [{"role": "user", "content": "help"}, {"role": "assistant", "follow_up_question": response.follow_up_question}]
        self.assertEqual((await self.triage("help", history)).care_type, "teleconsultation")

    async def test_abnormal_vitals_block_routine_booking_but_risk_factors_route(self):
        urgent = await self.triage("lab test at home, temperature 40.5 C", patient_context={"age_years": 40})
        self.assertIsNone(urgent.care_type)
        self.assertIn("112", urgent.follow_up_question)
        self.assertEqual(urgent.matched_caregivers, [])
        elderly = await self.triage("papa ko 2 din se bukhar hai", patient_context={"age_years": 72})
        self.assertEqual((elderly.care_type, elderly.urgency), ("paramedic_home_visit", "same_day"))
        self.assertTrue(elderly.matched_caregivers)

    async def test_breathlessness_inflections_are_flagged(self):
        for text in ["seene mein dard aur saans phool rahi hai", "papa ko saans phool rahi hai", "मुझे सांस फूल रही है", "I am short of breath"]:
            response = await self.triage(text)
            self.assertEqual(response.care_type, "emergency_112", text)
            self.assertIn("breathlessness", response.red_flags, text)


class RoutingUnits(unittest.TestCase):
    def test_language_detection(self):
        self.assertEqual(detect_language("घर पर इंजेक्शन"), "Hindi")
        self.assertEqual(detect_language("papa ko bukhar hai"), "Hinglish")
        self.assertEqual(detect_language("my father has fever"), "English")
        self.assertEqual(detect_language("anything", "hi"), "Hindi")

    def test_targeted_follow_up_mentions_known_patient(self):
        decision = route_request("I want to book something for my mother")
        self.assertIsNone(decision.care_type)
        self.assertEqual(decision.patient, "mother")
        self.assertIn("since when", decision.follow_up_question)


class MatchingEligibility(unittest.TestCase):
    def test_hard_filters_and_reasons(self):
        location = Location(**DELHI)
        matches, _ = match_caregivers("home_nursing", location, "English", "catheter change", "same_day", MORNING)
        self.assertTrue(matches)
        for match in matches:
            self.assertIn("catheter care", match.reason)
            self.assertNotIn("base tier", match.reason)
            self.assertLessEqual(float(match.reason.split(" km")[0].split(", ")[-1]), 12)

    def test_no_eligible_caregiver_is_explained(self):
        matches, note = match_caregivers("home_nursing", Location(lat=28.9, lng=76.7), "Hindi", "dressing", "same_day", MORNING)
        self.assertEqual(matches, [])
        self.assertIn("outside service radius", note)

    def test_late_requests_offer_tomorrow(self):
        matches, note = match_caregivers("paramedic_home_visit", Location(**DELHI), "Hindi", "fever", "same_day", MORNING.replace(hour=22))
        self.assertTrue(matches)
        self.assertIn("tomorrow", note)
        self.assertTrue(all(match.next_available.startswith("2026-01-16") for match in matches))


class Bookings(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"CARECOMPASS_DB_PATH": str(Path(self.directory.name) / "b.sqlite3")})
        self.env.start()
        self.client = TestClient(app)
        self.client.__enter__()
        self.client.post("/api/auth/register", json={"email": "b@example.com", "name": "B", "password": "OnlyForTests123!"})

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.env.stop()
        self.directory.cleanup()

    def slot(self, hour=14):
        return (datetime.now(IST) + timedelta(days=1)).replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()

    def test_booking_lifecycle_and_validation(self):
        body = {"caregiver_id": "CG_012", "care_type": "teleconsultation", "urgency": "same_day", "slot_start": self.slot()}
        created = self.client.post("/api/bookings", json=body)
        self.assertEqual(created.status_code, 201, created.text)
        booking = created.json()
        self.assertTrue(booking["booking_id"].startswith("CC-DEMO-"))
        self.assertEqual((booking["status"], booking["is_demo"]), ("confirmed_demo", True))
        self.assertEqual(self.client.post("/api/bookings", json=body).status_code, 409)
        self.assertEqual(self.client.post("/api/bookings", json={**body, "slot_start": self.slot(23)}).status_code, 422)
        self.assertEqual(self.client.post("/api/bookings", json={**body, "care_type": "home_nursing"}).status_code, 422)
        self.assertEqual([item["booking_id"] for item in self.client.get("/api/bookings").json()], [booking["booking_id"]])
        self.assertEqual(self.client.post(f"/api/bookings/{booking['booking_id']}/cancel").json()["status"], "cancelled")
        self.assertEqual(self.client.post("/api/bookings", json=body).status_code, 201)

    def test_requires_login(self):
        self.client.post("/api/auth/logout")
        self.assertEqual(self.client.get("/api/bookings").status_code, 401)

    def test_v1_database_migrates(self):
        path = Path(self.directory.name) / "old.sqlite3"
        with patch.dict(os.environ, {"CARECOMPASS_DB_PATH": str(path)}):
            initialize_database()
            with connection() as db:
                db.execute("DROP TABLE bookings")
                db.execute("PRAGMA user_version = 1")
            initialize_database()
            with connection() as db:
                self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 3)
                self.assertTrue(db.execute("SELECT name FROM sqlite_master WHERE name = 'bookings'").fetchone())


if __name__ == "__main__":
    unittest.main()
