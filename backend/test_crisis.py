import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.modules.crisis import (
    OTHER_THREAT, OVERDOSE, SELF_HARM_IDEATION, SELF_HARM_IMMINENT, detect_crisis,
)

IDEATION_PHRASES = [
    "mujhe sucidal though aa rha hai bro",  # the exact message from the bug report
    "I feel suicidal", "i am sucidal", "suicidel thoughts aa rahe hain", "having suiciiide thoughts",
    "I want to kill myself", "i wanna kill my self", "thinking of ending my life", "I want to end it all",
    "I want to die", "i wish i was dead", "everyone would be better off dead without me", "no reason to live",
    "I dont want to live anymore", "I can't go on", "I have been cutting myself", "self harm thoughts",
    "I want to hurt myself", "nothing to live for",
    "main marna chahta hu", "marna chahti hoon", "mujhe jeene ka mann nahi hai", "jeene ka koi matlab nahi",
    "main apni jaan de dunga", "khud ko khatam kar lunga", "khudkushi ka khayal aata hai", "khud kushi karna hai",
    "aatmhatya ke vichar", "mar jana chahta hu", "zindagi khatam karni hai", "sab khatam kar dunga",
    "मुझे आत्महत्या के विचार आ रहे हैं", "मैं मरना चाहता हूँ", "मैं जान दे दूँगा", "जीने का मन नहीं है",
    "मुझे सुसाइड के ख्याल आते हैं", "खुद को खत्म कर लूँगा", "मुझे खुदकुशी करनी है", "मर जाना चाहती हूँ",
    "मुझे मर जाना है", "ज़िंदगी खत्म करना चाहता हूँ", "मुझे जीना नहीं है, जीना नहीं चाहता",
    "no, I want to die", "I am not okay and I want to kill myself",
]
OVERDOSE_PHRASES = [
    "I took too many pills", "I swallowed poison", "zeher kha liya", "sleeping pills kha li", "maine saari goliyan kha li",
    "I overdosed", "he drank phenyl", "neend ki goli zyada kha li", "meri nas kaat li", "I took an overdose",
    "मैंने ज़हर खा लिया", "बच्चे ने दवाई खा ली", "मैंने नींद की गोली खा ली", "मैंने नस काट ली",
]
THREAT_PHRASES = [
    "he is going to kill me", "I was stabbed", "mujhe maar dalega", "मुझे मार डालेगा", "mujhe chaku lag gaya",
    "mar jaunga seene mein dard hai", "I think I am dying and my chest hurts",
]
NEGATIVES = [
    "my headache is killing me", "this traffic is killing me", "mar gaya yaar thak gaya", "dying to eat pizza",
    "I'm dying of laughter", "main uspe jaan deta hoon", "I am not suicidal", "no suicidal thoughts at all",
    "mujhe suicidal thoughts nahi aa rahe", "मुझे आत्महत्या के विचार नहीं आ रहे", "I do not want to die",
    "bhookh se bura haal hai", "mujhe bukhar hai", "pet mein dard hai 2 din se", "I need a nurse for dressing",
    "मुझे तीन दिन से बुखार है", "my phone died yesterday", "she killed it at the presentation", "I want a blood test at home",
    "doctor ne kaha tablet din mein do baar leni hai",
]


class CrisisDetectionTests(unittest.TestCase):
    def test_ideation_and_variants_are_detected(self):
        for phrase in IDEATION_PHRASES:
            with self.subTest(phrase=phrase):
                signal = detect_crisis(phrase)
                self.assertIsNotNone(signal, phrase)
                self.assertIn(signal.kind, {SELF_HARM_IDEATION, SELF_HARM_IMMINENT}, phrase)

    def test_screenshot_message_is_ideation(self):
        self.assertEqual(detect_crisis("mujhe sucidal though aa rha hai bro").kind, SELF_HARM_IDEATION)

    def test_overdose_and_poisoning(self):
        for phrase in OVERDOSE_PHRASES:
            with self.subTest(phrase=phrase):
                signal = detect_crisis(phrase)
                self.assertIsNotNone(signal, phrase)
                self.assertEqual(signal.kind, OVERDOSE, phrase)

    def test_other_life_threats(self):
        for phrase in THREAT_PHRASES:
            with self.subTest(phrase=phrase):
                signal = detect_crisis(phrase)
                self.assertIsNotNone(signal, phrase)
                self.assertEqual(signal.kind, OTHER_THREAT, phrase)

    def test_imminent_cues_raise_severity(self):
        for phrase in ["I am going to kill myself tonight", "abhi marna chahta hu, tablets hain mere paas",
                       "आज रात आत्महत्या कर लूँगा", "I want to die, I have the pills"]:
            with self.subTest(phrase=phrase):
                self.assertEqual(detect_crisis(phrase).kind, SELF_HARM_IMMINENT, phrase)

    def test_idioms_negations_and_normal_symptoms_do_not_alert(self):
        for phrase in NEGATIVES:
            with self.subTest(phrase=phrase):
                self.assertIsNone(detect_crisis(phrase), phrase)

    def test_history_is_scanned_and_marked(self):
        history = [{"role": "user", "content": "I want to end my life"},
                   {"role": "assistant", "content": "Please call 112."}]
        signal = detect_crisis("ok", history)
        self.assertEqual(signal.source, "history")
        self.assertEqual(signal.kind, SELF_HARM_IDEATION)
        self.assertIsNone(detect_crisis("ok", [{"role": "assistant", "content": "I want to die"}]))
        old = [{"role": "user", "content": "I want to end my life"}] + [{"role": "user", "content": f"fever day {i}"} for i in range(5)]
        self.assertIsNone(detect_crisis("fever", old))

    def test_a_crisis_phrase_is_never_cancelled_by_a_negated_one(self):
        self.assertIsNotNone(detect_crisis("I am not suicidal but I want to kill myself"))


class CrisisTriageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"CARECOMPASS_DB_PATH": str(Path(self.directory.name) / "crisis.sqlite3")})
        self.env.start()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.env.stop()
        self.directory.cleanup()

    def triage(self, text, language="auto", history=None, answers=None):
        # Nothing downstream of the crisis check may run: any call to these would fail the test.
        with patch("app.main.intent_gate", new=AsyncMock(side_effect=AssertionError("gate ran"))), \
             patch("app.main.clarify", new=AsyncMock(side_effect=AssertionError("clarify ran"))), \
             patch("app.main.extract_intake", new=AsyncMock(side_effect=AssertionError("llm ran"))), \
             patch("app.main.assess_safety", side_effect=AssertionError("safety ran first")):
            return self.client.post("/api/triage", json={
                "user_input": text, "language": language,
                "conversation_history": history or [], "answers": answers or {},
            })

    def test_screenshot_message_gets_emergency_response_without_follow_up(self):
        response = self.triage("mujhe sucidal though aa rha hai bro", "hi")
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["care_type"], "emergency_112")
        self.assertEqual(data["urgency"], "emergency")
        self.assertIn("suicidal_ideation", data["red_flags"])
        self.assertIsNone(data["follow_up_question"])
        self.assertEqual(data["questions"], [])
        self.assertEqual(data["assessment"]["level"], "emergency")
        self.assertEqual(data["crisis"]["kind"], "self_harm_ideation")
        numbers = [line["number"] for line in data["crisis"]["helplines"]]
        names = [line["name"] for line in data["crisis"]["helplines"]]
        self.assertIn("112", numbers)
        self.assertIn("14416", numbers)
        self.assertTrue(any("टेली-मानस" in name for name in names))
        self.assertRegex(data["message"], r"[ऀ-ॿ]")

    def test_english_request_gets_english_text_and_helplines(self):
        data = self.triage("I want to kill myself", "en").json()
        self.assertNotRegex(data["message"], r"[ऀ-ॿ]")
        self.assertIn("Tele-MANAS", [line["name"] for line in data["crisis"]["helplines"]])
        self.assertIn("112", [line["number"] for line in data["crisis"]["helplines"]])
        self.assertEqual(data["crisis"]["language"], "English")

    def test_hindi_text_in_english_hint_is_still_hindi_when_requested(self):
        data = self.triage("मैं मरना चाहता हूँ", "hi").json()
        self.assertEqual(data["crisis"]["language"], "Hindi")

    def test_urgent_cases_lead_with_ambulance_numbers(self):
        for text, kind in [("I swallowed poison", "overdose_or_poisoning"),
                           ("I am going to kill myself tonight", "self_harm_imminent")]:
            data = self.triage(text, "en").json()
            self.assertEqual(data["crisis"]["kind"], kind)
            self.assertEqual(data["crisis"]["helplines"][0]["number"], "112")
            self.assertEqual(data["crisis"]["helplines"][1]["number"], "102")
        ideation = self.triage("I feel suicidal", "en").json()
        self.assertEqual(ideation["crisis"]["helplines"][0]["number"], "14416")

    def test_history_and_follow_up_answers_trigger_the_alert(self):
        history = [{"role": "user", "content": "I feel like ending my life"}]
        self.assertEqual(self.triage("2 din se", "en", history).json()["crisis"]["source"], "history")
        answers = {"main_concern": "I want to die"}
        self.assertEqual(self.triage("Continue", "en", None, answers).json()["care_type"], "emergency_112")

    def test_normal_requests_still_use_the_existing_pipeline(self):
        response = self.client.post("/api/triage", json={"user_input": "I have a fever since 2 days", "language": "en"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["crisis"])


if __name__ == "__main__":
    unittest.main()
