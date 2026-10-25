import re
from typing import List, Optional, Any, Dict, Literal, Union
from pydantic import BaseModel, Field, model_validator, field_validator

class Location(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")

class Vitals(BaseModel):
    temperature_c: Optional[float] = Field(None, ge=30, le=45, allow_inf_nan=False)
    oxygen_percent: Optional[float] = Field(None, ge=1, le=100, allow_inf_nan=False)
    heart_rate: Optional[float] = Field(None, ge=1, le=300, allow_inf_nan=False)
    systolic_bp: Optional[float] = Field(None, ge=1, le=300, allow_inf_nan=False)
    diastolic_bp: Optional[float] = Field(None, ge=1, le=200, allow_inf_nan=False)
    respiratory_rate: Optional[float] = Field(None, ge=1, le=100, allow_inf_nan=False)

    @model_validator(mode="after")
    def check_blood_pressure(self):
        if self.systolic_bp is not None and self.diastolic_bp is not None and self.systolic_bp <= self.diastolic_bp:
            raise ValueError("Systolic blood pressure must be greater than diastolic pressure.")
        return self

class PatientContext(BaseModel):
    age_years: Optional[float] = Field(None, ge=0, le=120, allow_inf_nan=False)
    medical_history: str = Field("", max_length=4000)
    pregnant: bool = False
    immunocompromised: bool = False
    vitals: Vitals = Field(default_factory=Vitals)

class SafetyAssessment(BaseModel):
    level: Literal["emergency", "clinician_review", "self_care_support"]
    summary: str
    possible_categories: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)
    critical_signs: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    supportive_steps: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    requires_prompt_review: bool = False
    blocks_home_booking: bool = False
    viral_status: str = "Symptoms alone cannot distinguish viral, bacterial, or non-infectious causes. Examination or testing may be needed."
    disclaimer: str = "Rule-based demo guidance, not a diagnosis or medical clearance. Serious illness can be missed. Seek urgent help for severe, new, or worsening symptoms."

class TriageRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=8000, description="User's query in English, Hindi, or Hinglish")
    language: Optional[str] = Field("auto", description="Input language: auto, hi, en, hinglish")
    location: Optional[Location] = Field(None, description="User GPS coordinates")
    conversation_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Prior conversation turns")
    patient_context: PatientContext = Field(default_factory=PatientContext)
    answers: Dict[str, Union[str, List[str]]] = Field(
        default_factory=dict,
        description="Structured answers to the previous follow-up questions, keyed by question_id",
    )

    @field_validator("answers")
    @classmethod
    def check_answers(cls, value):
        if len(value) > 10:
            raise ValueError("Too many answers.")
        for key, answer in value.items():
            if not re.fullmatch(r"[a-z][a-z0-9_]{1,40}", key):
                raise ValueError("Invalid question id.")
            items = answer if isinstance(answer, list) else [answer]
            if len(items) > 12 or any(len(item) > 300 for item in items):
                raise ValueError("Answer is too long.")
        return value

    @field_validator("user_input")
    @classmethod
    def reject_blank_input(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Enter a symptom or service request.")
        return value.strip()

class FollowUpOption(BaseModel):
    value: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=1, max_length=120)
    # Canonical clinical phrase written into the transcript when this option is chosen,
    # so the safety rules see it whatever language the label is shown in.
    text: Optional[str] = Field(None, max_length=120)
    # Representative age (years) to remember for this chat; only set when the option implies one.
    age_years: Optional[float] = Field(None, ge=0, le=120)

class FollowUpQuestion(BaseModel):
    question_id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,40}$")
    question_text: str = Field(min_length=3, max_length=240)
    summary_label: str = Field(min_length=1, max_length=40)
    input_type: Literal["single_choice", "multi_choice", "text"]
    options: List[FollowUpOption] = Field(default_factory=list, max_length=10)
    required: bool = True
    allow_custom_input: bool = True

    @model_validator(mode="after")
    def check_options(self):
        if self.input_type == "text" and self.options:
            raise ValueError("Text questions cannot have options.")
        if self.input_type != "text" and len(self.options) < 2:
            raise ValueError("Choice questions need at least two options.")
        if len({option.value for option in self.options}) != len(self.options):
            raise ValueError("Option values must be unique.")
        return self

TriageAction = Literal["answer", "ask_followup", "urgent_guidance"]

class CaregiverMatch(BaseModel):
    caregiver_id: str
    score: float
    reason: str
    next_available: Optional[str] = None

class CrisisHelpline(BaseModel):
    name: str
    number: str
    description: str = ""
    tel: Optional[str] = None
    alt_number: Optional[str] = None

class CrisisInfo(BaseModel):
    """Present only when self-harm, overdose/poisoning or another life threat was detected."""
    kind: Literal["self_harm_ideation", "self_harm_imminent", "overdose_or_poisoning", "other_life_threat"]
    source: Literal["current", "history"] = "current"
    headline: str
    message: str
    actions: List[str] = Field(default_factory=list)
    helplines: List[CrisisHelpline] = Field(default_factory=list)
    language: Literal["English", "Hindi"] = "English"

class TriageResponse(BaseModel):
    follow_up_question: Optional[str] = None
    care_type: Optional[str] = None
    urgency: Optional[str] = None
    red_flags: List[str] = Field(default_factory=list)
    reasoning: Optional[str] = None
    matched_caregivers: List[CaregiverMatch] = Field(default_factory=list)
    matching_note: Optional[str] = None
    detected_language: Optional[str] = None
    assessment: Optional[SafetyAssessment] = None
    action: Optional[TriageAction] = None
    message: Optional[str] = None
    questions: List[FollowUpQuestion] = Field(default_factory=list, max_length=3)
    intent: Optional[str] = None
    answered_context: Dict[str, str] = Field(default_factory=dict)
    crisis: Optional[CrisisInfo] = None

class DemoHospital(BaseModel):
    hospital_id: str
    name: str
    area: str
    distance_km: Optional[float] = None
    availability: Literal["not_verified"] = "not_verified"
    is_demo: Literal[True] = True

class ExtractedEntities(BaseModel):
    patient: Optional[str] = Field(None, description="Who is the patient (e.g., father, self, mother, child)")
    symptoms: List[str] = Field(default_factory=list, description="List of recognized symptoms")
    duration: Optional[str] = Field(None, description="Duration of symptoms (e.g. 2 days)")
    is_complete: bool = Field(False, description="True if patient, symptoms, and duration are all identified")
    follow_up_question: Optional[str] = Field(None, description="Question asked if incomplete")
