import sys
from pathlib import Path

# Ensure UTF-8 output encoding for Windows terminal
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import asyncio
from app.schemas import TriageRequest, Location
from app.main import process_triage

async def run_tests():
    print("=" * 65)
    print("SANOCARE CARECOMPASS OFFICIAL DATASET TEST SUITE")
    print("=" * 65)

    # TEST CASE 1: Incomplete Query -> Follow-up Question
    print("\n--- TEST CASE 1: Incomplete Input ('doctor chahiye') ---")
    req1 = TriageRequest(
        user_input="doctor chahiye",
        language="auto",
        location=Location(lat=28.54, lng=77.27),
        conversation_history=[]
    )
    res1 = await process_triage(req1)
    print(f">> Follow-up Question: {res1.follow_up_question}")
    assert res1.follow_up_question is not None, "Failed: Should ask follow up question"
    assert res1.care_type is None, "Failed: Care type should be None"
    print("TEST 1 PASSED: Follow-up question generated successfully!")

    # TEST CASE 2: Emergency Red Flag -> Emergency 112 Bypass
    print("\n--- TEST CASE 2: Emergency Red Flag ('chest pain ho raha hai papa ko') ---")
    req2 = TriageRequest(
        user_input="chest pain ho raha hai papa ko",
        language="auto",
        location=Location(lat=28.54, lng=77.27),
        conversation_history=[]
    )
    res2 = await process_triage(req2)
    print(f">> Care Type: {res2.care_type}")
    print(f">> Urgency: {res2.urgency}")
    print(f">> Red Flags: {res2.red_flags}")
    print(f">> Matched Caregivers: {res2.matched_caregivers}")
    assert res2.care_type == "emergency_112", f"Expected emergency_112, got {res2.care_type}"
    assert res2.urgency == "emergency", f"Expected emergency, got {res2.urgency}"
    assert "chest_pain" in res2.red_flags, "Expected chest_pain in red_flags"
    assert len(res2.matched_caregivers) == 0, "Emergency must have 0 caregivers"
    print("TEST 2 PASSED: Emergency 112 bypass triggered with controlled vocabulary!")

    # TEST CASE 3: Home Nursing Procedure -> Real Caregiver Supply Match
    print("\n--- TEST CASE 3: Home Nursing ('Grandmother has a bedsore that needs dressing') ---")
    req3 = TriageRequest(
        user_input="Grandmother has a bedsore that needs dressing",
        language="en",
        location=Location(lat=28.5069, lng=77.2092),
        conversation_history=[]
    )
    res3 = await process_triage(req3)
    print(f">> Care Type: {res3.care_type}")
    print(f">> Urgency: {res3.urgency}")
    print(f">> Reasoning: {res3.reasoning}")
    print(">> Matched Caregivers from caregivers.csv:")
    for cg in res3.matched_caregivers:
        print(f"   - [{cg.caregiver_id}] Score: {cg.score} | Reason: {cg.reason}")
    assert res3.care_type == "home_nursing", f"Expected home_nursing, got {res3.care_type}"
    assert len(res3.matched_caregivers) > 0, "Must match active medics"
    print("TEST 3 PASSED: Home nursing matches genuine caregivers from supply dataset!")

    # TEST CASE 4: Paramedic Home Visit with Multi-turn history
    print("\n--- TEST CASE 4: Paramedic Home Visit ('mummy ko 2 din se bukhar hai, ghar pe dikhana hai') ---")
    req4 = TriageRequest(
        user_input="mummy ko 2 din se bukhar hai, ghar pe dikhana hai",
        language="auto",
        location=Location(lat=28.54, lng=77.27),
        conversation_history=[
            {"role": "user", "content": "doctor chahiye"},
            {"role": "assistant", "content": "Happy to help - who is this for and what is the main concern?"}
        ]
    )
    res4 = await process_triage(req4)
    print(f">> Care Type: {res4.care_type}")
    print(f">> Urgency: {res4.urgency}")
    print(f">> Reasoning: {res4.reasoning}")
    print(">> Matched Caregivers:")
    for cg in res4.matched_caregivers:
        print(f"   - [{cg.caregiver_id}] Score: {cg.score} | Reason: {cg.reason}")
    assert res4.care_type in ["paramedic_home_visit", "teleconsultation"], f"Unexpected care_type {res4.care_type}"
    assert len(res4.matched_caregivers) > 0, "Must match caregivers"
    print("TEST 4 PASSED: Multi-turn input resolves correctly to care recommendation!")

    print("\n" + "=" * 65)
    print("ALL TESTS PASSED WITH OFFICIAL DATASET & LIVE GROQ INFERENCE!")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_tests())
