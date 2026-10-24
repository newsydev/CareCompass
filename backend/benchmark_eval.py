"""Honest evaluation of the full /api/triage pipeline against a labelled JSONL dataset.

Usage: .venv/bin/python benchmark_eval.py [--data ../data/triage_dataset.jsonl] [--live] [--now ISO]
Defaults to offline mode (Groq disabled) for reproducible numbers.
"""
import argparse
import asyncio
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from predict import configure, predict  # noqa: E402
from app.config import DATA_DIR  # noqa: E402

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def macro_f1(pairs, labels):
    scores = {}
    for label in labels:
        tp = sum(1 for gold, pred in pairs if gold == label and pred == label)
        fp = sum(1 for gold, pred in pairs if gold != label and pred == label)
        fn = sum(1 for gold, pred in pairs if gold == label and pred != label)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        scores[label] = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return sum(scores.values()) / len(scores), scores


def contract_errors(response):
    errors = []
    if response.red_flags and (response.care_type != "emergency_112" or response.urgency != "emergency" or response.matched_caregivers):
        errors.append("red flag without emergency routing")
    if response.care_type == "emergency_112" and response.matched_caregivers:
        errors.append("emergency with caregivers")
    if response.follow_up_question and (response.care_type or response.urgency):
        errors.append("follow-up with care type")
    if response.care_type is None and not response.follow_up_question:
        errors.append("null care type without follow-up")
    return errors


async def evaluate(cases):
    care, urgency, by_language, failures = [], [], defaultdict(Counter), []
    emergency_total = emergency_hit = false_emergency = 0
    follow_tp = follow_fp = follow_fn = 0
    match_cases = top1 = top3 = 0
    contract = Counter()
    for case in cases:
        gold = case["response"]
        response = await predict(case["request"])
        care.append((str(gold["care_type"]), str(response.care_type)))
        urgency.append((str(gold["urgency"]), str(response.urgency)))
        correct = gold["care_type"] == response.care_type
        by_language[case.get("detected_language", "?")]["correct" if correct else "wrong"] += 1
        if not correct:
            failures.append((case["id"], case["request"]["user_input"], gold["care_type"], response.care_type))
        if gold["care_type"] == "emergency_112":
            emergency_total += 1
            emergency_hit += response.care_type == "emergency_112"
        elif response.care_type == "emergency_112":
            false_emergency += 1
        gold_follow, pred_follow = bool(gold["follow_up_question"]), bool(response.follow_up_question)
        follow_tp += gold_follow and pred_follow
        follow_fp += pred_follow and not gold_follow
        follow_fn += gold_follow and not pred_follow
        reference = [match["caregiver_id"] for match in gold.get("matched_caregivers") or []]
        if reference:
            match_cases += 1
            predicted = [match.caregiver_id for match in response.matched_caregivers]
            top1 += bool(predicted) and predicted[0] == reference[0]
            top3 += bool(set(predicted[:3]) & set(reference[:3]))
        for error in contract_errors(response):
            contract[error] += 1

    care_labels = sorted({gold for gold, _ in care})
    urgency_labels = sorted({gold for gold, _ in urgency})
    care_f1, care_per_class = macro_f1(care, care_labels)
    urgency_f1, _ = macro_f1(urgency, urgency_labels)
    print(f"Cases: {len(cases)}")
    print(f"Care-type macro-F1: {care_f1:.3f}")
    for label, score in care_per_class.items():
        print(f"  {label:22s} F1 {score:.3f}")
    print(f"Urgency macro-F1:   {urgency_f1:.3f}")
    print(f"Emergency recall:   {emergency_hit}/{emergency_total} (under-triage {emergency_total - emergency_hit})")
    print(f"False emergencies:  {false_emergency}")
    print(f"Follow-ups:         TP {follow_tp}, FP {follow_fp}, FN {follow_fn}")
    for language, counts in sorted(by_language.items()):
        total = counts["correct"] + counts["wrong"]
        print(f"  {language:9s} care accuracy {counts['correct'] / total:.1%} ({counts['correct']}/{total})")
    if match_cases:
        print(f"Matching vs reference ({match_cases} cases): top-1 {top1 / match_cases:.1%}, any reference in top-3 {top3 / match_cases:.1%}")
    else:
        print("Matching: no reference caregiver lists in this dataset.")
    print(f"Contract violations: {sum(contract.values())} {dict(contract) if contract else ''}")
    unique_failures = sorted(set(failures))
    if unique_failures:
        print(f"\nMisrouted unique inputs ({len(unique_failures)}):")
        for case_id, text, gold, predicted in unique_failures[:20]:
            print(f"  {case_id} {gold} -> {predicted}: {text}")
    return {"care_f1": care_f1, "urgency_f1": urgency_f1, "emergency_recall": emergency_hit / max(emergency_total, 1), "contract_violations": sum(contract.values())}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DATA_DIR / "triage_dataset.jsonl")
    parser.add_argument("--live", action="store_true", help="Allow Groq calls if GROQ_API_KEY is configured.")
    parser.add_argument("--now", type=datetime.fromisoformat, default=None)
    args = parser.parse_args()
    configure(offline=not args.live, now=args.now)
    rows = [json.loads(line) for line in args.data.read_text(encoding="utf-8").splitlines() if line.strip()]
    asyncio.run(evaluate(rows))
