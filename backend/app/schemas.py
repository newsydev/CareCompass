from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class Location(BaseModel):
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")

class TriageRequest(BaseModel):
    user_input: str = Field(..., description="User's query in English, Hindi, or Hinglish")
    language: Optional[str] = Field("auto", description="Input language: auto, hi, en, hinglish")
    location: Optional[Location] = Field(None, description="User GPS coordinates")
    conversation_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Prior conversation turns")

class CaregiverMatch(BaseModel):
    caregiver_id: str
    score: float
    reason: str

class TriageResponse(BaseModel):
    follow_up_question: Optional[str] = None
    care_type: Optional[str] = None
    urgency: Optional[str] = None
    red_flags: List[str] = Field(default_factory=list)
    reasoning: Optional[str] = None
    matched_caregivers: List[CaregiverMatch] = Field(default_factory=list)

class ExtractedEntities(BaseModel):
    patient: Optional[str] = Field(None, description="Who is the patient (e.g., father, self, mother, child)")
    symptoms: List[str] = Field(default_factory=list, description="List of recognized symptoms")
    duration: Optional[str] = Field(None, description="Duration of symptoms (e.g. 2 days)")
    is_complete: bool = Field(False, description="True if patient, symptoms, and duration are all identified")
    follow_up_question: Optional[str] = Field(None, description="Question asked if incomplete")
