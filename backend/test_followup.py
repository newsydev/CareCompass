import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import ValidationError

from app.main import process_triage
from app.schemas import FollowUpOption, FollowUpQuestion, PatientContext, TriageRequest


class FakeGroq:
    """Stands in for the Groq client; returns the queued JSON for every call."""

    def __init__(self, payload):
        self.payload = payload
        self.calls = 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **_kwargs):
        self.calls += 1
        content = self.payload if isinstance(self.payload, str) else json.dumps(self.payload)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


async def triage(text, history=None, answers=None, context=None, groq=None):
    request = TriageRequest(
        user_input=text,
        conversation_history=history or [],
        answers=answers or {},
        patient_context=context or PatientContext(),
    )
    with patch("app.main.get_groq_client", return_value=groq), patch("app.modules.clarify.get_groq_client", return_value=groq):
        return await process_triage(request)


def ids(response):
    return [question.question_id for question in response.questions]


def assistant_asked(*question_ids):
    return {"role": "assistant", "content": "I need a little more information.", "follow_up_ids": list(question_ids)}


class FollowUpEngineTests(unittest.IsolatedAsyncioTestCase):
    async def test_general_question_is_answered_directly_without_questions(self):
        groq = FakeGroq({"answer": "A fever is a body temperature above the usual range, often a sign the body is fighting an infection."})
        response = await triage("What is a fever?", groq=groq)
        self.assertEqual(response.action, "answer")
        self.assertEqual(response.questions, [])
        self.assertIsNone(response.care_type)
        self.assertIn("fighting an infection", response.message)
        self.assertEqual(response.intent, "health_info")
        self.assertIn("Who is it for", response.message)  # short definition, then a pivot back to care
        self.assertEqual(response.follow_up_question, response.message)

    async def test_general_question_without_llm_is_honest_and_does_not_ask(self):
        response = await triage("What is a fever?")
        self.assertEqual(response.action, "answer")
        self.assertEqual(response.questions, [])
        self.assertIn("can't look up", response.message)

    async def test_malformed_llm_output_falls_back_safely(self):
        for payload in ("not json at all", {"answer": ""}, {"answer": "x" * 5000}, ["list"]):
            with self.subTest(payload=str(payload)[:20]):
                response = await triage("Why do we get fever?", groq=FakeGroq(payload))
                self.assertEqual(response.action, "answer")
                self.assertIn("can't look up", response.message)

    async def test_personal_symptom_is_not_treated_as_a_general_question(self):
        groq = FakeGroq({"answer": "should never be used for a personal complaint"})
        response = await triage("I have fever, what should I do?", groq=groq)
        self.assertNotEqual(response.action, "answer") if response.questions else None
        self.assertNotIn("should never be used", response.message or "")

    async def test_symptom_missing_duration_and_severity_asks_only_those(self):
        response = await triage("Mujhe headache ho raha hai.")
        self.assertEqual(response.action, "ask_followup")
        self.assertEqual(ids(response), ["duration", "severity"])
        self.assertEqual(response.follow_up_question, response.message)  # older clients still see a follow-up
        self.assertEqual(response.detected_language, "Hinglish")
        duration = response.questions[0]
        self.assertEqual(duration.input_type, "single_choice")
        self.assertTrue(duration.allow_custom_input)
        self.assertIn("Kuch ghante", [option.label for option in duration.options])  # asked in the user's language

    async def test_known_age_is_not_asked_again(self):
        response = await triage("I have a headache", context=PatientContext(age_years=30))
        self.assertNotIn("patient", ids(response))
        self.assertNotIn("patient_age", ids(response))

    async def test_age_in_the_message_is_not_asked_again(self):
        response = await triage("My 3 year old has fever")
        self.assertNotIn("patient_age", ids(response))
        self.assertNotIn("patient", ids(response))

    async def test_child_with_unknown_age_asks_age_group(self):
        response = await triage("my baby has fever")
        self.assertIn("patient_age", ids(response))
        self.assertLessEqual(len(response.questions), 2)

    async def test_symptom_and_duration_already_given_are_not_asked_again(self):
        response = await triage("papa ko do din se bukhar hai aur khansi bhi")
        self.assertEqual(ids(response), ["associated"])  # symptoms, patient and duration are known; only the red-flag screen is left
        self.assertEqual(response.answered_context.get("Duration"), "do din")
        done = await triage("Associated symptoms: none of the listed signs.",
                            history=[{"role": "user", "content": "papa ko do din se bukhar hai aur khansi bhi"}, assistant_asked("associated")],
                            answers={"associated": ["none"]})
        self.assertEqual(done.questions, [])
        self.assertIsNotNone(done.care_type)

    async def test_english_symptom_with_duration_and_self_only_asks_the_red_flag_screen(self):
        response = await triage("I have had a fever for two days and need a home checkup.")
        self.assertEqual(ids(response), ["associated"])

    async def test_at_most_two_questions_per_round_and_two_rounds(self):
        first = await triage("Mujhe headache ho raha hai")
        self.assertEqual(ids(first), ["duration", "severity"])
        history = [
            {"role": "user", "content": "Mujhe headache ho raha hai"},
            assistant_asked(*ids(first)),
        ]
        second = await triage("Duration: since yesterday. Severity: mild.", history=history,
                              answers={"duration": "since_yesterday", "severity": "mild"})
        self.assertEqual(second.action, "ask_followup")
        self.assertEqual(ids(second), ["associated"])
        self.assertEqual(second.questions[0].input_type, "multi_choice")
        history += [
            {"role": "user", "content": "Duration: since yesterday. Severity: mild.", "answers": {"duration": "since_yesterday", "severity": "mild"}},
            assistant_asked("associated"),
        ]
        third = await triage("Associated symptoms: none of the listed signs.", history=history, answers={"associated": ["none"]})
        self.assertEqual(third.questions, [])  # two rounds are the limit; it now proceeds with what is known
        self.assertEqual(third.action, "answer")

    async def test_emergency_signs_get_immediate_guidance_not_a_questionnaire(self):
        for text in ["sudden severe headache and one-sided weakness", "papa ko seene me dard ho raha hai", "chest pain"]:
            with self.subTest(text=text):
                response = await triage(text)
                self.assertEqual(response.action, "urgent_guidance")
                self.assertEqual(response.care_type, "emergency_112")
                self.assertEqual(response.questions, [])
                self.assertIn("112", " ".join(response.assessment.next_steps))

    async def test_selected_warning_sign_escalates_to_urgent_guidance(self):
        history = [
            {"role": "user", "content": "headache since yesterday, mild"},
            assistant_asked("associated"),
        ]
        response = await triage("Associated symptoms: stiff neck, new confusion.", history=history,
                                answers={"associated": ["stiff_neck", "confusion"]})
        self.assertEqual(response.action, "urgent_guidance")
        self.assertEqual(response.care_type, "emergency_112")

    async def test_answer_that_resolves_uncertainty_does_not_start_another_questionnaire(self):
        first = await triage("Mujhe sardi hai")
        self.assertEqual(ids(first), ["duration"])
        history = [{"role": "user", "content": "Mujhe sardi hai"}, assistant_asked("duration")]
        response = await triage("Duration: for 2 to 3 days.", history=history, answers={"duration": "two_three_days"})
        self.assertEqual(response.questions, [])
        self.assertEqual(response.action, "answer")
        self.assertIsNotNone(response.care_type)

    async def test_changed_query_reassesses_what_is_needed(self):
        history = [
            {"role": "user", "content": "Mujhe headache ho raha hai"},
            assistant_asked("duration", "severity"),
            {"role": "user", "content": "Duration: since yesterday. Severity: mild.", "answers": {"duration": "since_yesterday", "severity": "mild"}},
            assistant_asked("associated"),
            {"role": "user", "content": "Associated symptoms: none of the listed signs.", "answers": {"associated": ["none"]}},
            {"role": "assistant", "content": "Suggested service: Doctor consultation."},
        ]
        response = await triage("ab pet dard bhi hai 2 din se", history=history)
        self.assertEqual(response.action, "ask_followup")
        self.assertIn("severity", ids(response))      # new complaint, severity unknown
        self.assertNotIn("duration", ids(response))   # but it already said 2 din

    async def test_unknown_patient_is_asked_only_when_relevant(self):
        response = await triage("fever, what should I do")
        self.assertEqual(ids(response), ["patient", "duration"])
        patient = response.questions[0]
        self.assertIn("older_adult", [option.value for option in patient.options])
        self.assertTrue(any(option.age_years == 65 for option in patient.options))

    async def test_questions_are_never_repeated_even_if_the_card_was_ignored(self):
        history = [{"role": "user", "content": "Mujhe sardi hai"}, assistant_asked("duration")]
        response = await triage("ok please help", history=history)
        self.assertNotIn("duration", ids(response))

    async def test_vague_request_asks_main_concern_then_stops_at_the_cap(self):
        first = await triage("doctor chahiye")
        self.assertEqual(first.action, "ask_followup")
        self.assertEqual(ids(first), ["main_concern", "patient"])

        history = [{"role": "user", "content": "doctor chahiye"}, assistant_asked("main_concern", "patient"),
                   {"role": "user", "content": "doctor chahiye"}, assistant_asked("main_concern")]
        capped = await triage("doctor chahiye", history=history)
        self.assertEqual(capped.questions, [])
        self.assertEqual(capped.care_type, "teleconsultation")  # no endless loop

    async def test_follow_up_cap_counts_history_shaped_like_the_client_sends_it(self):
        history = [
            {"role": "user", "content": "doctor chahiye"}, assistant_asked("x1"),
            {"role": "user", "content": "doctor chahiye"}, assistant_asked("x2"),
            {"role": "user", "content": "doctor chahiye"}, assistant_asked("x3"),
        ]
        response = await triage("doctor chahiye", history=history)
        self.assertEqual(response.care_type, "teleconsultation")

    async def test_legacy_plain_text_follow_ups_still_count_toward_the_cap(self):
        history = [
            {"role": "user", "content": "doctor chahiye"}, {"role": "assistant", "content": "?", "follow_up_question": "?"},
            {"role": "user", "content": "doctor chahiye"}, {"role": "assistant", "content": "?", "follow_up_question": "?"},
        ]
        response = await triage("doctor chahiye", history=history)
        self.assertEqual(response.care_type, "teleconsultation")

    async def test_specific_services_are_not_interrogated(self):
        for text in ["I need a blood sample collected at home for a prescribed CBC test.",
                     "My mother needs a nurse at home for wound dressing."]:
            with self.subTest(text=text):
                response = await triage(text)
                self.assertEqual(response.questions, [])
                self.assertIsNotNone(response.care_type)

    async def test_hindi_questions_are_asked_in_hindi(self):
        response = await triage("मुझे सिरदर्द है")
        self.assertEqual(response.action, "ask_followup")
        self.assertEqual(response.detected_language, "Hindi")
        self.assertTrue(any("ऀ" <= ch <= "ॿ" for ch in response.questions[0].question_text))

    async def test_answered_context_reports_only_what_is_known(self):
        response = await triage("Mujhe headache ho raha hai")
        self.assertEqual(response.answered_context.get("Symptoms"), "headache")
        self.assertNotIn("Duration", response.answered_context)

    async def test_unusual_complaint_is_read_by_the_llm_but_validated(self):
        groq = FakeGroq({"symptoms": ["ringing in ears"], "duration": None, "patient": "self"})
        response = await triage("kaanon mein ghanti jaisi awaaz aa rahi hai", groq=groq)
        self.assertEqual(response.action, "ask_followup")
        self.assertIn("duration", ids(response))

        bad = await triage("kaanon mein ghanti jaisi awaaz aa rahi hai", groq=FakeGroq({"symptoms": "not a list"}))
        self.assertEqual(bad.action, "ask_followup")
        self.assertEqual(ids(bad)[0], "main_concern")


class SchemaValidationTests(unittest.TestCase):
    def test_invalid_answer_keys_and_sizes_are_rejected(self):
        for answers in ({"Bad Key": "x"}, {"duration": "x" * 400}, {"duration": ["a"] * 20}, {f"q{i}x": "a" for i in range(11)}):
            with self.subTest(answers=str(answers)[:30]):
                with self.assertRaises(ValidationError):
                    TriageRequest(user_input="hi", answers=answers)

    def test_choice_question_needs_two_options_and_text_none(self):
        with self.assertRaises(ValidationError):
            FollowUpQuestion(question_id="duration", question_text="How long?", summary_label="Duration",
                             input_type="single_choice", options=[FollowUpOption(value="a", label="A")])
        with self.assertRaises(ValidationError):
            FollowUpQuestion(question_id="note", question_text="Anything else?", summary_label="Note",
                             input_type="text", options=[FollowUpOption(value="a", label="A"), FollowUpOption(value="b", label="B")])
        with self.assertRaises(ValidationError):
            FollowUpQuestion(question_id="duration", question_text="How long?", summary_label="Duration",
                             input_type="single_choice", options=[FollowUpOption(value="a", label="A"), FollowUpOption(value="a", label="B")])

    def test_old_saved_results_without_the_new_fields_still_validate(self):
        from app.schemas import TriageResponse
        old = TriageResponse.model_validate({"follow_up_question": None, "care_type": "teleconsultation", "urgency": "same_day"})
        self.assertIsNone(old.action)
        self.assertEqual(old.questions, [])


if __name__ == "__main__":
    unittest.main()
