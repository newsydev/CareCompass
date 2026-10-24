import unittest
from unittest.mock import AsyncMock, patch

import httpx
from pydantic import ValidationError

from app.main import app, process_triage
from app.modules.intake import fallback_heuristic_extraction
from app.modules.matching import match_caregivers
from app.modules.safety import assess_safety
from app.modules.triage import detect_red_flags
from app.schemas import ExtractedEntities, PatientContext, TriageRequest, Vitals


class SafetyRulesTests(unittest.TestCase):
    def test_short_emergencies_and_negation_are_not_masked_by_other_symptoms(self):
        for text in ["chest pain", "seizure", "no fever but chest pain", "chest pain and no fever", "saans nahi aa rahi", "swollen tongue", "sudden severe headache", "I can\u2019t breathe", "chest tightness", "one-sided weakness"]:
            with self.subTest(text=text):
                self.assertEqual(assess_safety(text, PatientContext()).level, "emergency")
        for text in ["no chest pain", "without difficulty breathing", "chest pain nahi hai"]:
            with self.subTest(text=text):
                self.assertEqual(detect_red_flags(text, []), [])
        self.assertNotEqual(assess_safety("not an emergency, I want a CBC test", PatientContext()).level, "emergency")

    def test_oxygen_thresholds_and_missing_information(self):
        for value, expected in [(92, "emergency"), (93, "clinician_review"), (94, "clinician_review"), (95, "clinician_review")]:
            with self.subTest(value=value):
                result = assess_safety("I feel unwell", PatientContext(vitals=Vitals(oxygen_percent=value)))
                self.assertEqual(result.level, expected)
                if value <= 94:
                    self.assertTrue(result.requires_prompt_review)
        result = assess_safety("mild cough", PatientContext())
        self.assertEqual(result.level, "clinician_review")
        self.assertTrue(any("age" in item.lower() for item in result.missing_information))
        self.assertTrue(any("oxygen" in item.lower() for item in result.missing_information))

    def test_infant_fever_requires_urgent_review_without_home_remedies(self):
        for text, context in [
            ("fever", PatientContext(age_years=0.1, vitals=Vitals(temperature_c=38))),
            ("my 2-month-old baby has temperature 38 C", PatientContext()),
        ]:
            result = assess_safety(text, context)
            self.assertEqual(result.level, "clinician_review")
            self.assertTrue(result.requires_prompt_review)
            self.assertFalse(result.supportive_steps)
            self.assertTrue(any("under 3 months" in step for step in result.next_steps))

    def test_adult_bp_without_symptoms_is_urgent_not_automatic_emergency(self):
        context = PatientContext(age_years=40, vitals=Vitals(systolic_bp=185, diastolic_bp=121))
        result = assess_safety("I measured my blood pressure", context)
        self.assertEqual(result.level, "clinician_review")
        self.assertTrue(result.requires_prompt_review)
        self.assertEqual(result.supportive_steps, [])
        for text in ["chest pain", "new blurred vision", "new weakness"]:
            self.assertEqual(assess_safety(text, context).level, "emergency")

    def test_adult_pulse_thresholds_are_not_applied_to_children(self):
        child = assess_safety("a checkup please", PatientContext(age_years=2, vitals=Vitals(heart_rate=140)))
        self.assertFalse(any("adult pulse" in step for step in child.next_steps))
        adult = assess_safety("a checkup please", PatientContext(age_years=40, vitals=Vitals(heart_rate=140)))
        self.assertTrue(any("adult pulse" in step for step in adult.next_steps))

    def test_history_pregnancy_and_immunity_prevent_self_care_clearance(self):
        for context in [
            PatientContext(age_years=70),
            PatientContext(age_years=35, medical_history="diabetes"),
            PatientContext(age_years=35, pregnant=True),
            PatientContext(age_years=35, immunocompromised=True),
        ]:
            result = assess_safety("mild cough", context)
            self.assertEqual(result.level, "clinician_review")
            self.assertTrue(result.risk_factors)
            self.assertTrue(result.requires_prompt_review)
            self.assertFalse(result.supportive_steps)
        self.assertFalse(assess_safety("mild cold", PatientContext(age_years=35, medical_history="no diabetes")).risk_factors)
        self.assertTrue(assess_safety("I have diabetes and a mild cough", PatientContext()).risk_factors)

    def test_supportive_guidance_is_never_a_viral_diagnosis_or_medical_clearance(self):
        context = PatientContext(
            age_years=35, medical_history="No known conditions, medicines or allergies",
            vitals=Vitals(temperature_c=37, oxygen_percent=98, heart_rate=75),
        )
        result = assess_safety("mild cold and runny nose", context)
        self.assertEqual(result.level, "self_care_support")
        self.assertTrue(result.supportive_steps)
        self.assertIn("cannot distinguish", result.viral_status)
        self.assertIn("not a diagnosis", result.disclaimer)
        self.assertFalse(result.critical_signs)
        self.assertFalse(result.missing_information)

    def test_text_vitals_and_conflicting_readings_use_the_dangerous_reading(self):
        for text in ["oxygen 98 then oxygen 88", "oxygen 88 then oxygen 98", "temperature 34 C then temperature 37 C"]:
            self.assertEqual(assess_safety(text, PatientContext()).level, "emergency")
        context = PatientContext(vitals=Vitals(oxygen_percent=98))
        self.assertEqual(assess_safety("oxygen 88", context).level, "emergency")
        result = assess_safety("temperature 105 F", PatientContext(age_years=30))
        self.assertTrue(result.requires_prompt_review)
        self.assertFalse(result.supportive_steps)

    def test_uninterpretable_text_vitals_are_explicit_not_assumed_normal(self):
        result = assess_safety("mild cold, oxygen 900", PatientContext(age_years=35, medical_history="no known conditions"))
        self.assertEqual(result.level, "clinician_review")
        self.assertTrue(any("could not be interpreted" in item for item in result.missing_information))
        self.assertTrue(result.requires_prompt_review)
        self.assertFalse(result.supportive_steps)

    def test_concerning_vitals_are_not_ignored_when_age_is_unknown(self):
        for vital in [Vitals(systolic_bp=190, diastolic_bp=125), Vitals(heart_rate=35), Vitals(respiratory_rate=30)]:
            result = assess_safety("please assess this reading", PatientContext(vitals=vital))
            self.assertTrue(result.requires_prompt_review)
            self.assertFalse(result.supportive_steps)

    def test_invalid_structured_measurements_and_blank_requests_are_rejected(self):
        for values in [{"oxygen_percent": 101}, {"temperature_c": float("nan")}, {"systolic_bp": 90, "diastolic_bp": 120}]:
            with self.assertRaises(ValidationError):
                Vitals(**values)
        with self.assertRaises(ValidationError):
            TriageRequest(user_input="   ")

    def test_no_fabricated_duration_or_distance(self):
        self.assertIsNone(fallback_heuristic_extraction("I need a home checkup").duration)
        self.assertEqual(fallback_heuristic_extraction("I have fever for 2 days").duration, "2 days")
        matches, note = match_caregivers("paramedic_home_visit", None)
        self.assertTrue(matches)
        self.assertIn("Location not shared", note)
        self.assertTrue(all("distance not verified" in match.reason for match in matches))
        self.assertTrue(all("km away" not in match.reason for match in matches))


class SafetyApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.intake_patch = patch("app.modules.intake.get_groq_client", return_value=None)
        self.triage_patch = patch("app.modules.triage.get_groq_client", return_value=None)
        self.intake_patch.start()
        self.triage_patch.start()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://carecompass.test")

    async def asyncTearDown(self):
        await self.client.aclose()
        self.intake_patch.stop()
        self.triage_patch.stop()

    async def test_emergency_bypasses_incomplete_intake_and_ai(self):
        with patch("app.main.extract_intake", new_callable=AsyncMock) as intake:
            for text in ["chest pain", "ambulance", "oxygen 88"]:
                result = await process_triage(TriageRequest(user_input=text))
                self.assertEqual(result.care_type, "emergency_112")
                self.assertTrue(result.assessment.critical_signs)
                self.assertFalse(result.matched_caregivers)
                self.assertEqual(result.assessment.supportive_steps, [])
            intake.assert_not_awaited()

    async def test_urgent_vitals_do_not_fall_through_to_home_caregiver_booking(self):
        response = await self.client.post("/api/triage", json={
            "user_input": "mild cough",
            "patient_context": {"age_years": 30, "vitals": {"oxygen_percent": 93}},
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["assessment"]["requires_prompt_review"])
        self.assertIsNone(data["care_type"])
        self.assertIn("112", data["follow_up_question"])
        self.assertEqual(data["matched_caregivers"], [])

    async def test_only_prior_user_messages_are_used_for_safety_screening(self):
        response = await self.client.post("/api/triage", json={
            "user_input": "I have a mild cough",
            "conversation_history": [{"role": "assistant", "content": "Call 112 if you get chest pain."}],
        })
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json()["assessment"]["level"], "emergency")
        response = await self.client.post("/api/triage", json={
            "user_input": "it started two days ago",
            "conversation_history": [{"role": "user", "content": "chest pain"}],
        })
        self.assertEqual(response.json()["care_type"], "emergency_112")

    async def test_ai_emergency_without_red_flags_is_still_an_emergency(self):
        with patch("app.main.evaluate_triage", new_callable=AsyncMock) as evaluate, \
                patch("app.main.get_groq_client", return_value=object()), \
                patch("app.main.extract_intake", new_callable=AsyncMock) as intake:
            intake.return_value = ExtractedEntities(patient="self", symptoms=["new symptom"], is_complete=True)
            evaluate.return_value = {"is_emergency": False, "care_type": "emergency_112", "urgency": "emergency", "red_flags": [], "reasoning": "Urgent assessment needed."}
            response = await process_triage(TriageRequest(user_input="I need help for something new"))
            self.assertEqual(response.assessment.level, "emergency")
            self.assertEqual(response.care_type, "emergency_112")
            self.assertTrue(response.assessment.critical_signs)
            self.assertFalse(response.matched_caregivers)

    async def test_hospitals_are_fictional_with_unverified_availability_and_optional_distances(self):
        response = await self.client.get("/api/hospitals/demo")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(item["is_demo"] and item["availability"] == "not_verified" and item["distance_km"] is None for item in response.json()))
        nearby = await self.client.get("/api/hospitals/demo", params={"lat": 28.54, "lng": 77.27})
        distances = [item["distance_km"] for item in nearby.json()]
        self.assertEqual(distances, sorted(distances))
        self.assertEqual((await self.client.get("/api/hospitals/demo", params={"lat": 10})).status_code, 422)
        self.assertEqual((await self.client.get("/api/hospitals/demo", params={"lat": 999, "lng": 0})).status_code, 422)

    async def test_voice_endpoint_validates_and_propagates_patient_context(self):
        with patch("app.main.transcribe_audio_bytes", new_callable=AsyncMock) as transcribe:
            transcribe.return_value = ("I feel unwell", "en")
            response = await self.client.post("/api/triage/voice", files={"file": ("test.wav", b"demo audio", "audio/wav")}, data={"patient_context": '{"vitals":{"oxygen_percent":88}}'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["care_type"], "emergency_112")
            transcribe.reset_mock()
            invalid = await self.client.post("/api/triage/voice", files={"file": ("test.wav", b"demo audio", "audio/wav")}, data={"patient_context": '{"vitals":{"oxygen_percent":999}}'})
            self.assertEqual(invalid.status_code, 422)
            transcribe.assert_not_awaited()

    async def test_invalid_context_returns_validation_error(self):
        response = await self.client.post("/api/triage", json={"user_input": "hello", "patient_context": {"age_years": -1}})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
