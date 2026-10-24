"""Non-diagnostic demo screening. Never use this module as clinical decision support."""
import re
from typing import List, Tuple

from app.modules.triage import detect_red_flags, is_negated_match
from app.schemas import PatientContext, SafetyAssessment, Vitals

CATEGORY_TERMS = {
    "Respiratory symptoms; infection, allergy, and other causes are possible": ["cough", "khansi", "cold", "sore throat", "खांसी"],
    "Fever or possible infection; the cause is undetermined": ["fever", "bukhar", "बुखार"],
    "Digestive symptoms; the cause is undetermined": ["vomiting", "diarrhea", "diarrhoea", "acidity", "nausea", "ulti"],
    "Skin symptoms or a wound-care concern": ["rash", "wound", "dressing", "bedsore"],
    "Pain requiring assessment; the cause is undetermined": ["pain", "dard", "headache", "दर्द"],
}

def has_current_term(text: str, terms: List[str]) -> bool:
    for term in terms:
        for match in re.finditer(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text.lower()):
            if not is_negated_match(text.lower(), match.start(), match.end()):
                return True
    return False

def reported_vitals(text: str) -> Tuple[List[Vitals], List[str]]:
    patterns = {
        "oxygen_percent": r"\b(?:spo2|oxygen(?: saturation)?|o2|sats)\s*(?:is|at|of|=|:)?\s*(\d{1,3}(?:\.\d+)?)",
        "heart_rate": r"\b(?:pulse|heart rate)\s*(?:is|at|of|=|:)?\s*(\d{1,3})",
        "respiratory_rate": r"\b(?:respiratory rate|breathing rate)\s*(?:is|at|of|=|:)?\s*(\d{1,3})",
        "temperature_c": r"\b(?:temperature|temp|fever)\s*(?:is|at|of|=|:)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:degrees?\s*)?[°]?\s*c(?:elsius)?\b",
    }
    limits = {"oxygen_percent": (1, 100), "heart_rate": (1, 300), "respiratory_rate": (1, 100), "temperature_c": (30, 45)}
    measurements = []
    warnings = []
    for field, pattern in patterns.items():
        matches = list(re.finditer(pattern, text, re.I))
        if matches:
            readings = [float(match.group(1)) for match in matches]
            low, high = limits[field]
            valid = [value for value in readings if low <= value <= high]
            if len(valid) != len(readings):
                warnings.append(f"A reported {field.replace('_', ' ')} value could not be interpreted; verify the value and units with a clinician.")
            measurements.extend(Vitals(**{field: value}) for value in valid)
    for fahrenheit in re.finditer(r"\b(?:temperature|temp|fever)\s*(?:is|at|of|=|:)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:degrees?\s*)?[°]?\s*f(?:ahrenheit)?\b", text, re.I):
        celsius = (float(fahrenheit.group(1)) - 32) * 5 / 9
        if 30 <= celsius <= 45:
            measurements.append(Vitals(temperature_c=round(celsius, 2)))
        else:
            warnings.append("The reported temperature could not be interpreted; verify the value and units.")
    for bp in re.finditer(r"\b(?:bp|blood pressure)\s*(?:is|at|of|=|:)?\s*(\d{2,3})\s*/\s*(\d{2,3})", text, re.I):
        systolic, diastolic = float(bp.group(1)), float(bp.group(2))
        if 1 <= diastolic < systolic <= 300 and diastolic <= 200:
            measurements.append(Vitals(systolic_bp=systolic, diastolic_bp=diastolic))
        else:
            warnings.append("The reported blood pressure is invalid; verify both readings.")
    return measurements, warnings

def assess_safety(text: str, context: PatientContext) -> SafetyAssessment:
    text = text.replace("\u2019", "'")
    flags = detect_red_flags(text, [])
    if has_current_term(text, ["ambulance", "ambulace", "emergency", "emergency_112"]):
        flags.append("emergency_assistance_requested")
    if has_current_term(text, ["can't breathe", "cannot breathe", "not breathing", "trouble breathing", "chest tightness", "blue lips", "stiff neck", "non-blanching rash", "new confusion", "severe abdominal pain", "sudden severe headache", "vomiting blood", "swollen tongue", "severe allergic reaction", "anaphylaxis", "one-sided weakness", "face drooping"]):
        flags.append("urgent_danger_sign")

    risks = []
    age = context.age_years
    age_match = re.search(r"\b(\d{1,3}(?:\.\d+)?)\s*[- ]?(years?|months?|weeks?|days?)[ -]+old\b", text, re.I)
    if age_match:
        amount = float(age_match.group(1))
        unit = age_match.group(2).lower()
        reported_age = amount / (12 if unit.startswith("month") else 52 if unit.startswith("week") else 365 if unit.startswith("day") else 1)
        if 0 <= reported_age <= 120:
            if age is not None and age != reported_age:
                risks.append("Conflicting patient ages were reported; verify which patient needs care.")
            age = min(age, reported_age) if age is not None else reported_age
    if age is not None and (age < 5 or age >= 65):
        risks.append("Young child or older adult: professional assessment may be needed sooner.")
    if age is None and has_current_term(text, ["baby", "infant", "newborn", "child"]):
        risks.append("A child was described, but the exact age is unknown.")
    if context.pregnant or has_current_term(text, ["pregnant", "pregnancy"]):
        risks.append("Pregnancy reported.")
    if context.immunocompromised or has_current_term(text, ["immunocompromised", "reduced immunity", "chemotherapy"]):
        risks.append("Reduced immunity reported.")
    if has_current_term(f"{context.medical_history}\n{text}", ["diabetes", "asthma", "copd", "heart disease", "kidney disease", "cancer", "heart failure", "blood thinners", "transplant"]):
        risks.append("A potentially relevant long-term condition was reported in the patient history.")

    parsed, warnings = reported_vitals(text)
    measurements = [context.vitals, *parsed]
    missing = list(warnings)
    urgent = []
    combined = context.vitals.model_dump()
    for reported in parsed:
        for field, value in reported.model_dump().items():
            if value is not None:
                if combined[field] is not None and combined[field] != value:
                    urgent.append(f"Conflicting {field.replace('_', ' ')} readings were reported; do not rely only on the more reassuring value.")
                combined[field] = value
    if age is None:
        missing.append("Patient age is unknown; adult vital-sign ranges may not apply.")
    if not context.medical_history.strip():
        missing.append("Medical history, regular medicines, and allergies have not been provided.")
    if combined["temperature_c"] is None:
        missing.append("Temperature is unknown.")
    if combined["oxygen_percent"] is None:
        missing.append("Oxygen saturation is unknown.")
    if combined["heart_rate"] is None:
        missing.append("Pulse is unknown.")

    for vital in measurements:
        if vital.oxygen_percent is not None:
            if vital.oxygen_percent <= 92:
                flags.append("low_reported_oxygen")
            elif vital.oxygen_percent <= 94:
                urgent.append("Reported oxygen saturation is 93-94%; seek urgent medical advice now, especially if below the patient's usual baseline.")
        if vital.temperature_c is not None:
            if vital.temperature_c < 35:
                flags.append("very_low_temperature")
            elif age is not None and age < 0.25 and vital.temperature_c >= 38:
                urgent.append("A baby under 3 months with a temperature of 38 C or above needs urgent medical assessment now; do not rely on home remedies.")
            elif age is not None and age < 0.5 and vital.temperature_c >= 39:
                urgent.append("A baby under 6 months with a temperature of 39 C or above needs urgent medical assessment now.")
            elif vital.temperature_c >= 40:
                urgent.append("A very high reported temperature needs urgent professional assessment.")
        if age is None and (
            (vital.systolic_bp is not None and (vital.systolic_bp >= 180 or vital.systolic_bp < 90)) or
            (vital.diastolic_bp is not None and vital.diastolic_bp >= 120) or
            (vital.heart_rate is not None and (vital.heart_rate <= 40 or vital.heart_rate >= 130)) or
            (vital.respiratory_rate is not None and (vital.respiratory_rate <= 8 or vital.respiratory_rate >= 25))
        ):
            urgent.append("A potentially concerning vital reading was reported but the patient's age is unknown. Seek urgent age-appropriate clinical assessment; do not assume the reading is normal.")
        if age is not None and age >= 18:
            high_bp = (vital.systolic_bp is not None and vital.systolic_bp >= 180) or (vital.diastolic_bp is not None and vital.diastolic_bp >= 120)
            if high_bp:
                if flags or has_current_term(text, ["vision changes", "blurred vision", "back pain", "weakness", "numbness"]):
                    flags.append("very_high_bp_with_symptoms")
                else:
                    urgent.append("Very high adult blood pressure was reported. Contact a clinician urgently; with chest pain, breathing trouble, weakness, or vision changes, call 112 immediately.")
            if vital.systolic_bp is not None and vital.systolic_bp < 90:
                urgent.append("Low adult systolic blood pressure was reported; seek urgent professional advice, especially with dizziness or weakness.")
            if vital.heart_rate is not None and (vital.heart_rate <= 40 or vital.heart_rate >= 130):
                urgent.append("A markedly abnormal adult pulse was reported; seek urgent professional advice.")
            if vital.respiratory_rate is not None and (vital.respiratory_rate <= 8 or vital.respiratory_rate >= 25):
                urgent.append("A markedly abnormal adult breathing rate was reported; seek urgent assessment now.")

    categories = [label for label, terms in CATEGORY_TERMS.items() if has_current_term(text, terms)]
    if not categories:
        categories = ["No illness category can be established from this request."]

    if flags:
        return SafetyAssessment(
            level="emergency",
            summary="Emergency help is requested or a potentially serious warning sign was reported. Do not wait for this chat or a demo booking.",
            possible_categories=categories,
            risk_factors=risks,
            critical_signs=list(dict.fromkeys(flags)),
            next_steps=["Call 112 now, or 102 for ambulance assistance in India. No service has been contacted by this app.", "Tell the dispatcher the symptoms, exact pickup location, and any known conditions. Follow their instructions.", "Do not drive yourself if seriously unwell. Do not give food or drink to someone who is drowsy or cannot swallow."],
            supportive_steps=[],
            missing_information=list(dict.fromkeys(missing)),
            requires_prompt_review=True,
        )

    mild = has_current_term(text, ["mild", "minor", "runny nose", "sore throat", "cold"])
    # Comfort measures are not clearance to stay home; avoid offering them as infant or high-risk care.
    comfort_only = mild and age is not None and 18 <= age < 65 and not risks and not urgent and not warnings and not missing
    steps = list(dict.fromkeys(urgent))
    if risks:
        steps.append("Because of the patient's reported risk factors, contact a clinician promptly rather than relying on home care.")
    if not steps:
        steps.append("Arrange a clinician review if symptoms persist, worsen, or concern you. This demo cannot establish that home care alone is appropriate.")
    steps.append("Call 112 for new chest pain, severe breathing difficulty, collapse, severe bleeding, or other severe deterioration. Do not delay care to measure vitals.")
    support = []
    if age is not None and age >= 18 and not risks and not urgent and not warnings:
        support = ["Rest while arranging appropriate care and monitor for worsening symptoms.", "If fully awake and able to swallow, take small sips of fluid unless a clinician has restricted your fluids.", "Avoid unprescribed antibiotics or new medicines; ask a clinician or pharmacist about safe symptom relief and interactions."]
    return SafetyAssessment(
        level="self_care_support" if comfort_only else "clinician_review",
        summary="Comfort measures may help while monitoring mild symptoms; this is not a diagnosis or clearance to stay home." if comfort_only else "A clinician should assess the reported symptoms and context; this demo cannot determine whether home care is sufficient.",
        possible_categories=categories, risk_factors=risks,
        next_steps=steps, supportive_steps=support, missing_information=list(dict.fromkeys(missing)),
        requires_prompt_review=bool(urgent or warnings or (risks and any(has_current_term(text, terms) for terms in CATEGORY_TERMS.values()))),
        blocks_home_booking=bool(urgent or warnings),
    )
