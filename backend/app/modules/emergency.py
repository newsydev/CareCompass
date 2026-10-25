from typing import List, Optional

from app.modules.matching import haversine_distance
from app.schemas import DemoHospital, Location

# Fictional coordinates exist only to demonstrate distance sorting, not real hospital locations.
DEMO_HOSPITALS = [
    ("demo-central", "Demo Central Emergency Hospital", "Fictional Delhi demo location", 28.54, 77.27),
    ("demo-community", "Demo Community Hospital", "Fictional South Delhi demo location", 28.51, 77.21),
    ("demo-city", "Demo City Medical Centre", "Fictional East Delhi demo location", 28.61, 77.30),
]

# Crisis helplines (India). VERIFY ALL NUMBERS BEFORE RELEASE and re-check them periodically:
#   112  national emergency number          102  ambulance
#   Tele-MANAS 14416 / 1-800-891-4416 (government tele-mental-health service)
#   KIRAN 1800-599-0019 (government mental-health rehabilitation helpline)
HELPLINES = {
    "emergency": {"number": "112", "tel": "tel:112"},
    "ambulance": {"number": "102", "tel": "tel:102"},
    "telemanas": {"number": "14416", "alt_number": "1-800-891-4416", "tel": "tel:14416"},
    "kiran": {"number": "1800-599-0019", "tel": "tel:18005990019"},
}
HELPLINE_NAMES = {
    "English": {
        "emergency": ("National emergency number", "Police, ambulance and fire"),
        "ambulance": ("Ambulance", "Medical emergency transport"),
        "telemanas": ("Tele-MANAS", "Free mental health support"),
        "kiran": ("KIRAN helpline", "Free mental health support"),
    },
    "Hindi": {
        "emergency": ("राष्ट्रीय आपातकालीन नंबर", "पुलिस, एम्बुलेंस और फायर"),
        "ambulance": ("एम्बुलेंस", "आपातकालीन चिकित्सा सहायता"),
        "telemanas": ("टेली-मानस", "मानसिक स्वास्थ्य के लिए निःशुल्क सहायता"),
        "kiran": ("किरण हेल्पलाइन", "मानसिक स्वास्थ्य के लिए निःशुल्क सहायता"),
    },
}

_CRISIS_TEXT = {
    "English": {
        "support": (
            "You are not alone, and help is available right now.",
            "I'm really sorry you are feeling this way. What you feel matters and you deserve support right now. Please reach out to someone who can help immediately.",
            [
                "Call or message Tele-MANAS (14416) or KIRAN (1800-599-0019) now. They are free helplines.",
                "If you might act on these thoughts, call 112 now, or 102 for an ambulance.",
                "Stay with someone you trust, or ask someone to come to you so you are not alone.",
                "If it is safe, move away from anything you could use to hurt yourself.",
                "No service has been contacted by this app.",
            ],
        ),
        "urgent": (
            "Call 112 or 102 right now.",
            "This sounds like an emergency. Please call 112, or 102 for an ambulance, right now. If someone is with you, ask them to stay with you and to call as well.",
            [
                "Call 112 now, or 102 for an ambulance. Say what happened and where you are.",
                "Do not stay alone. Ask a family member, neighbour or friend to come to you now.",
                "If it is safe, put away pills, sharp objects or anything you could use to hurt yourself.",
                "Tele-MANAS (14416) can also talk with you while help is on the way.",
                "No service has been contacted by this app.",
            ],
        ),
        "threat": (
            "This may be a life-threatening emergency.",
            "Please call 112, or 102 for an ambulance, right now. Your safety comes first.",
            [
                "Call 112 now, or 102 for an ambulance.",
                "If you can do so safely, move to a safer place or near other people and ask them for help.",
                "No service has been contacted by this app.",
            ],
        ),
        "disclaimer": "This app cannot provide crisis counselling or send help. If you are in danger, call 112 now.",
    },
    "Hindi": {
        "support": (
            "आप अकेले नहीं हैं, और अभी मदद उपलब्ध है।",
            "मुझे बहुत दुख है कि आप ऐसा महसूस कर रहे हैं। आपकी भावनाएँ मायने रखती हैं और आपको अभी सहारा मिलना चाहिए। कृपया तुरंत किसी ऐसे व्यक्ति से बात करें जो मदद कर सके।",
            [
                "अभी टेली-मानस (14416) या किरण (1800-599-0019) पर कॉल या मैसेज करें। ये निःशुल्क हेल्पलाइन हैं।",
                "अगर आपको इन विचारों पर अमल करने का डर है, तो अभी 112 पर कॉल करें, या एम्बुलेंस के लिए 102।",
                "किसी भरोसेमंद व्यक्ति के साथ रहें, या किसी को अपने पास बुला लें ताकि आप अकेले न रहें।",
                "अगर सुरक्षित हो, तो खुद को नुकसान पहुँचाने वाली चीज़ों से दूर हो जाएँ।",
                "इस ऐप ने किसी सेवा से संपर्क नहीं किया है।",
            ],
        ),
        "urgent": (
            "अभी 112 या 102 पर कॉल करें।",
            "यह आपातकाल जैसा लग रहा है। कृपया अभी 112 पर कॉल करें, या एम्बुलेंस के लिए 102। अगर कोई आपके पास है, तो उनसे रुकने और खुद भी कॉल करने के लिए कहें।",
            [
                "अभी 112 पर कॉल करें, या एम्बुलेंस के लिए 102। बताएँ कि क्या हुआ है और आप कहाँ हैं।",
                "अकेले न रहें। किसी परिवार के सदस्य, पड़ोसी या दोस्त को अभी अपने पास बुलाएँ।",
                "अगर सुरक्षित हो, तो गोलियाँ, नुकीली चीज़ें या खुद को नुकसान पहुँचाने वाली कोई भी चीज़ दूर रख दें।",
                "मदद आने तक टेली-मानस (14416) भी आपसे बात कर सकता है।",
                "इस ऐप ने किसी सेवा से संपर्क नहीं किया है।",
            ],
        ),
        "threat": (
            "यह जानलेवा आपातकाल हो सकता है।",
            "कृपया अभी 112 पर कॉल करें, या एम्बुलेंस के लिए 102। आपकी सुरक्षा सबसे पहले है।",
            [
                "अभी 112 पर कॉल करें, या एम्बुलेंस के लिए 102।",
                "अगर सुरक्षित हो, तो किसी सुरक्षित जगह या दूसरे लोगों के पास चले जाएँ और उनसे मदद माँगें।",
                "इस ऐप ने किसी सेवा से संपर्क नहीं किया है।",
            ],
        ),
        "disclaimer": "यह ऐप संकट में परामर्श या मदद भेजने की सुविधा नहीं देता। अगर आप खतरे में हैं, तो अभी 112 पर कॉल करें।",
    },
}
_CRISIS_FLAG = {
    "self_harm_ideation": "suicidal_ideation",
    "self_harm_imminent": "suicidal_ideation",
    "overdose_or_poisoning": "poisoning_or_overdose",
    "other_life_threat": "life_threatening_violence",
}


def build_crisis_response(signal, language: str = "English") -> dict:
    """Structured crisis guidance for the triage response (headline, message, actions, helplines).

    Hinglish uses the English text (Latin script). The ambulance numbers lead for imminent,
    overdose and other life-threatening situations; support lines lead for ideation.
    """
    lang = "Hindi" if language == "Hindi" else "English"
    block = {"self_harm_ideation": "support", "self_harm_imminent": "urgent",
             "overdose_or_poisoning": "urgent", "other_life_threat": "threat"}[signal.kind]
    headline, message, actions = _CRISIS_TEXT[lang][block]
    order = ["telemanas", "kiran", "emergency", "ambulance"] if block == "support" else \
        ["emergency", "ambulance", "telemanas", "kiran"]
    if signal.kind == "other_life_threat":
        order = ["emergency", "ambulance"]
    helplines = []
    for key in order:
        name, description = HELPLINE_NAMES[lang][key]
        helplines.append({"name": name, "description": description, **HELPLINES[key]})
    return {
        "kind": signal.kind,
        "source": signal.source,
        "red_flag": _CRISIS_FLAG[signal.kind],
        "headline": headline,
        "message": message,
        "actions": actions,
        "disclaimer": _CRISIS_TEXT[lang]["disclaimer"],
        "helplines": helplines,
        "language": lang,
    }


def list_demo_hospitals(location: Optional[Location]) -> List[DemoHospital]:
    hospitals = [
        DemoHospital(
            hospital_id=identifier, name=name, area=area,
            distance_km=round(haversine_distance(location.lat, location.lng, lat, lng), 1) if location else None,
        )
        for identifier, name, area, lat, lng in DEMO_HOSPITALS
    ]
    if location:
        hospitals.sort(key=lambda hospital: hospital.distance_km)
    return hospitals
