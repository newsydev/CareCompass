"""Deterministic crisis detection: self-harm, overdose/poisoning and other life threats.

Runs before every other triage step (no LLM, no network). It is deliberately biased towards
alerting: a false alarm costs one extra screen, a miss can cost a life. English, Hindi
(Devanagari), Roman Hindi/Hinglish and common misspellings are covered.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

SELF_HARM_IDEATION = "self_harm_ideation"
SELF_HARM_IMMINENT = "self_harm_imminent"
OVERDOSE = "overdose_or_poisoning"
OTHER_THREAT = "other_life_threat"
HISTORY_TURNS = 4


@dataclass
class CrisisSignal:
    kind: str
    matched: List[str] = field(default_factory=list)
    source: str = "current"  # 'current' message or an earlier 'history' turn


# ---------------------------------------------------------------- normalisation

_CLAUSE = re.compile(r"[,.;:!?।—\-()\[\]\"“”]+")
_SLANG = (
    (r"\bwanna\b", "want to"), (r"\bgonna\b", "going to"), (r"\bgotta\b", "got to"),
    (r"\bnhi\b|\bnahin\b|\bnai\b|\bnahii\b", "nahi"), (r"\bmy\s+self\b", "myself"),
    (r"\bdo\s+not\b", "dont"), (r"\bdoes\s+not\b", "doesnt"), (r"\bcan\s+not\b", "cant"),
    (r"\bi\s*m\b", "im"), (r"\bu\b", "you"),
)


def _normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "").lower()
    text = re.sub(r"[‌‍़]", "", text)  # joiners, nukta
    text = text.replace("ँ", "ं").replace("’", "").replace("'", "").replace("`", "")
    text = _CLAUSE.sub(" | ", text)
    text = re.sub(r"[^\wऀ-ॿ|]+", " ", text)
    text = re.sub(r"(.)\1{2,}", r"\1", text)  # sooo -> so, suiciiide -> suicide
    for pattern, replacement in _SLANG:
        text = re.sub(pattern, replacement, text)
    return re.sub(r"\s+", " ", text).strip()


def _distance(a: str, b: str) -> int:
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        for j, cb in enumerate(b, 1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ca != cb)))
        previous = current
    return previous[-1]


# Long key words whose misspellings should still match (same first letter, small edit distance).
FUZZY_KEYS = ("suicide", "suicidal", "khudkushi", "aatmhatya", "atmahatya", "overdose", "swallowed", "poison")
STEM = re.compile(r"\b(?:suicide|suicidal|khudkushi|aatmhatya|atmahatya)\b|सुसाइड|सुइसाइड|सुसाईड|सूसाइड|आत्महत्या|आत्म हत्या|आतमहत्या|खुदकुशी|खुद कुशी|खुदखुशी")


def _canonical(text: str) -> str:
    words = []
    for token in text.split(" "):
        if re.match(r"(?:suicid|sucid|suisid|suiscid|sucied)", token):
            token = "suicide"  # suicidality, suicides, sucidal...
        elif len(token) >= 6 and token.isascii() and token.isalpha():
            for key in FUZZY_KEYS:
                if token[0] == key[0] and abs(len(token) - len(key)) <= 2 and _distance(token, key) <= (2 if len(key) >= 8 else 1):
                    token = key
                    break
        words.append(token)
    return " ".join(words)


# ---------------------------------------------------------------- patterns

W = r"\s+"  # whitespace between words; '|' (clause break) is never matched across

IDEATION = [
    # English
    r"\b(?:kill|killing|hurt|hurting|harm|harming|cut|cutting|hang|hanging|stab|stabbing|drown|drowning|shoot|shooting)" + W + r"(?:myself|my\s?se?lf|myslf)\b",
    r"\bend(?:ing)?" + W + r"(?:my|me|it)" + W + r"(?:life|all)\b|\bend(?:ing)? my own life\b",
    r"\b(?:take|taking)" + W + r"my" + W + r"(?:own" + W + r")?life\b",
    r"\b(?:want|wish|hope)(?:\s+(?:i|to))*" + W + r"(?:to" + W + r")?(?:die|be dead|disappear forever|not wake up)\b",
    r"\bwish" + W + r"(?:i|im)" + W + r"(?:was|were|am)?" + W + r"(?:dead|never born|gone)\b|\bwish" + W + r"i" + W + r"(?:was|were)" + W + r"dead\b",
    r"\bbetter off dead\b|\bbetter off without me\b|\bno one would miss me\b|\bnobody would miss me\b",
    r"\bno" + W + r"(?:reason|point)" + W + r"(?:to|in)" + W + r"(?:live|living|go on|being alive)\b|\bnothing to live for\b",
    r"\b(?:dont|doesnt)" + W + r"(?:want|wanna)" + W + r"to" + W + r"(?:live|be alive|exist|go on|wake up)\b",
    r"\bcant" + W + r"(?:go on|do this anymore|take it anymore|live like this|live anymore)\b",
    r"\b(?:self" + r"\s*harm\w*|selfharm\w*)\b|\bslit(?:ting)? my (?:wrist|wrists|throat)\b|\bgive up on life\b|\bsuicide note\b",
    r"\b(?:overdose|od)" + W + r"on purpose\b",
    # Roman Hindi / Hinglish
    r"\bmarna" + W + r"(?:chah|chaa)\w*",
    r"\bmarne" + W + r"(?:ka|ki|ke)" + W + r"(?:mann?|man|mood|vichar|khayal|soch|iraada|irada)\b",
    r"\bmar" + r"\s*(?:ja|jaa)(?:na|ana)" + W + r"(?:chah|chaa)\w*",
    r"\b(?:apni" + W + r")?jaa?n" + W + r"(?:de|dena|dene|le|lena|lene)\b",
    r"\bkhud" + r"\s*ko" + W + r"(?:khatam|khtm|maar|nuksan|hurt|harm|chot|jala|kaat|mita)\w*",
    r"\bj(?:ee?|i)ne" + W + r"(?:ka|ki|ke)" + W + r"(?:mann?|man|iccha|ichha|maksad|matlab)" + W + r"(?:nahi|khatam)\b",
    r"\bj(?:ee?|i)ne" + W + r"ka" + W + r"koi" + W + r"(?:matlab|maksad|reason)\b",
    r"\bj(?:ee?|i)na" + W + r"nahi" + W + r"chah\w*",
    r"\b(?:zindagi|zindgi|jindagi|life)" + W + r"(?:khatam|khtm|se" + W + r"(?:thak|tang)|barbaad)\w*",
    r"\bsab(?:kuch)?" + W + r"khatam" + W + r"kar\w*",
    r"\bkhud\s*(?:kushi|khushi)\b|\baa?tm\s*a?\s*hatya\b",
    # Devanagari (after nukta/chandrabindu normalisation)
    r"मरना" + W + r"चाह",
    r"मर" + r"\s*जाना" + W + r"चाह",
    r"मरने" + W + r"(?:का|की|के)" + W + r"(?:मन|ख्याल|खयाल|विचार|इरादा|सोच)",
    r"(?:अपनी" + W + r")?जान" + W + r"(?:दे|देना|देने|ले|लेना|लेने)(?:\s|$)",
    r"मर\s*जाना\s*(?:है|ही|हैं)(?:\s|$)",
    r"\bmar\s*jaa?na\s+(?:hai|h)\b",
    r"खुद" + r"\s*को" + W + r"(?:खत्म|खतम|मार|नुकसान|चोट|काट|जला|हानि|मिटा)",
    r"जीने" + W + r"(?:का|की)" + W + r"(?:मन|इच्छा|मकसद|मतलब)" + W + r"(?:ही" + W + r")?(?:नहीं|नही|खत्म)",
    r"जीने" + W + r"का" + W + r"कोई" + W + r"(?:मतलब|मकसद)",
    r"जीना" + W + r"(?:नहीं|नही)" + W + r"चाह",
    r"(?:ज़िंदगी|जिंदगी|जिन्दगी|जिंदगी)" + W + r"(?:खत्म|खतम|से" + W + r"(?:थक|तंग)|बर्बाद)",
    r"सब" + W + r"(?:कुछ" + W + r")?खत्म" + W + r"कर",
]

OVERDOSE_PATTERNS = [
    r"\boverdose\w*\b|\bod(?:ed|d)\b",
    r"\b(?:swallowed|ate|eaten|drank|drunk|took|taken|consumed|ingested|downed)\b[^|]{0,15}\b(?:poison\w*|pesticide|bleach|kerosene|phenyl|acid|insecticide)\b",
    r"\b(?:swallowed|ate|eaten|took|taken|consumed|ingested|downed)\b[^|]{0,15}\b(?:too" + W + r"many|handful of|whole" + W + r"bottle of|all (?:my|the|of my)|lots of)\b[^|]{0,12}\b(?:pills?|tablets?|capsules?|medicines?|meds|drugs|painkillers|paracetamol)\b",
    r"\b(?:poison\w*|pesticide|bleach|kerosene|phenyl|insecticide)\b[^|]{0,25}\b(?:swallowed|drank|drunk|ate|took|ingested|pee|pi|piya|pi" + W + r"li)\b",
    r"\b(?:zeher|jahar|zahar|zehar|poison|phenyl|kerosene|acid|pesticide)\b[^|]{0,30}\b(?:kha|khaya|khaa|khali|khai|khayi|pi|piya|pee|pili|pilo|nigal\w*|gatak\w*)\b",
    r"\b(?:sleeping" + W + r"(?:pills?|tablets?)|neend" + W + r"(?:ki|ke)" + W + r"(?:goli|goliyan|tablets?|dawai)|tablets?|goli|goliyan|pills?|dawai|dawa|medicine)\b[^|]{0,30}\b(?:zyada|bahut|saari|sari|sab|poori|puri|all|many|too many|whole bottle)\b[^|]{0,15}\b(?:kha|khali|khaa|khai|khayi|khaya|le|li|liya|taken|took|swallow\w*)\b",
    r"\b(?:sleeping" + W + r"(?:pills?|tablets?)|neend" + W + r"(?:ki|ke)" + W + r"(?:goli|goliyan|tablets?))\b[^|]{0,20}\b(?:kha|khali|khaa|khai|khayi|khaya|le" + W + r"li|liya|swallow\w*|took|taken)\b",
    r"\b(?:zyada|bahut|saari|sari|sab|poori|puri|all|too" + W + r"many)" + W + r"(?:goli|goliyan|tablets?|dawai|dawa|medicines?|pills?)\b[^|]{0,15}\b(?:kha|khali|khaa|khai|khayi|khaya|le|li|liya|swallow\w*|took|taken)\b",
    r"\bnas" + W + r"kaat\w*|\bwrists?" + W + r"(?:cut|slit)\b|\bkaat" + W + r"li" + W + r"(?:nas|hath|wrist)\b",
    r"(?:ज़हर|जहर)[^|]{0,30}(?:खा|पी|पिया|खाया|निगल)",
    r"(?:नींद|नीद)" + W + r"(?:की|के)" + W + r"(?:गोली|गोलियां|गोलियाँ|टैबलेट)[^|]{0,25}(?:खा|ले" + W + r"ली|निगल)",
    r"(?:सारी|सब|ज्यादा|ज़्यादा|बहुत)" + W + r"(?:गोलियां|गोलियाँ|गोली|दवाई|दवा|टैबलेट)[^|]{0,15}(?:खा|ले" + W + r"ली|निगल)",
    r"नस" + W + r"काट",
    r"(?:बच्चे|बच्ची|बेटे|बेटी)[^|]{0,25}(?:दवाई|दवा|गोली|ज़हर|जहर|फिनाइल|मिट्टी का तेल)[^|]{0,15}(?:खा|पी|निगल)",
]

THREAT_PATTERNS = [
    r"\b(?:going|trying|tried|wants?|threatening|threatened)" + W + r"to" + W + r"(?:kill|murder|stab|shoot|strangle|burn)" + W + r"me\b",
    r"\b(?:i|im|i" + W + r"was|i" + W + r"have" + W + r"been)" + W + r"(?:stabbed|shot|strangled|set on fire|attacked with)\b|\bgot" + W + r"(?:stabbed|shot)\b",
    r"\bacid" + W + r"attack\w*|\bhe" + W + r"has" + W + r"a" + W + r"(?:gun|knife)\b",
    r"\bmujhe" + W + r"(?:maar|jaan se maar)\w*" + W + r"(?:dega|dalega|denge|dalenge|doonga)\b|\bmujhe" + W + r"(?:chaku|chaaku|goli)" + W + r"(?:lag|mar)\w*",
    r"(?:मुझे|हमें)" + W + r"(?:मार|जान से मार)\w*" + W + r"(?:देगा|डालेगा|देंगे|डालेंगे)",
    r"(?:चाकू|गोली)" + W + r"(?:लग|मार)",
]

# Weak "I will die" phrases: self-harm when said alone, plain life-threat when physical symptoms are present.
FEAR_DYING = [
    r"\bmar" + r"\s*(?:ja|jaa)u+n?(?:ga|gi)?\b",
    r"मर" + r"\s*जा(?:ऊं|उं|ऊ|उ)(?:गा|गी|ंगा|ंगी)?",
    r"\bmar\s*(?:ja|jaa)u+n?(?:ga|gi)?\b",
    r"मर\s*जा(?:ऊं|उं|ऊ|उ)(?:गा|गी|ंगा|ंगी)?",
    r"\bim" + W + r"(?:going to|gonna)" + W + r"die\b|\bi" + W + r"(?:will|am going to)" + W + r"die\b",
    r"\b(?:im|i am|i feel like im)" + W + r"dying\b(?!" + W + r"(?:to|of|for|laughing|from laughing|inside)\b)",
    r"\bi" + W + r"(?:think|feel)" + W + r"(?:im|i am)" + W + r"(?:going to )?(?:die|dying)\b",
]
SYMPTOMS = re.compile(
    r"\b(?:pain|dard|chest|saans|breath\w*|bukhar|fever|sar|pet|bleeding|khoon|blood|dizzy|chakkar|fainting|behosh|vomit\w*|ulti|seizure|"
    r"heart|dil|stroke|accident|burn\w*|jal)\b|दर्द|सीने|सांस|बुखार|खून|चक्कर|बेहोश|उल्टी|दिल|दौरा|जल",
)

IMMINENT = re.compile(
    r"\b(?:going to|about to|tonight|right now|this moment|im ready|will do it|plan to|planning to|made a plan)\b|"
    r"\b(?:have|got|holding|bought)" + W + r"(?:the" + W + r")?(?:pills|tablets|rope|knife|gun|blade|poison)\b|"
    r"\b(?:already|just)" + W + r"(?:took|taken|swallowed|cut|drank)\b|\bwrote" + W + r"(?:a" + W + r")?(?:suicide" + W + r")?note\b|"
    r"\b(?:on|at)" + W + r"(?:the" + W + r")?(?:roof|terrace|bridge|balcony|track|tracks)\b|\bjump(?:ing)?" + W + r"(?:off|from)\b|"
    r"\b(?:abhi|aaj" + W + r"raat|aaj" + W + r"hi|kar" + W + r"(?:lunga|lungi|lun|loon)|karne" + W + r"(?:ja|wala|wali)|de" + W + r"(?:dunga|dungi|doon)|"
    r"le" + W + r"(?:lunga|lungi)|chhat" + W + r"se|terrace|balcony|phanda|rassi|rope|tablets?|blade|chaku|chaaku|alvida)\b|"
    r"अभी|आज" + W + r"रात|आज" + W + r"ही|कर" + W + r"लू(?:ं)?(?:गा|गी)?|दे" + W + r"दू(?:ं)?(?:गा|गी)?|ले" + W + r"लू(?:ं)?(?:गा|गी)?|"
    r"छत" + W + r"से|फंदा|रस्सी|गोली|गोलियां|ब्लेड|चाकू|नोट" + W + r"लिख|अलविदा|कूद",
)

NEGATIONS = {"not", "never", "dont", "doesnt", "didnt", "isnt", "wasnt", "arent", "wont", "nahi", "mat", "without",
             "नहीं", "नही", "मत"}

_IDEATION = [re.compile(p) for p in IDEATION]
_OVERDOSE = [re.compile(p) for p in OVERDOSE_PATTERNS]
_THREAT = [re.compile(p) for p in THREAT_PATTERNS]
_FEAR = [re.compile(p) for p in FEAR_DYING]


def _negated(text: str, start: int, end: int, stem: bool) -> bool:
    """'I am not suicidal', 'never kill myself', 'suicidal thoughts nahi aa rahe'.

    Only negations in the same clause count. A bare 'no' counts only when directly adjacent,
    so 'no, I want to die' and 'no i want to die' still alert.
    """
    before = [token for token in text[:start].split(" ") if token][-3:]
    clause = []
    for token in reversed(before):
        if token == "|":
            break
        clause.append(token)
    if any(token in NEGATIONS for token in clause):
        return True
    if before and before[-1] == "no":
        return True
    if stem:  # Hinglish puts the negation after the noun
        for token in [token for token in text[end:].split(" ") if token][:3]:
            if token == "|":
                break
            if token in NEGATIONS:
                return True
    return False


def _hits(patterns, text: str) -> List[str]:
    return [match.group(0) for pattern in patterns for match in pattern.finditer(text)
            if not _negated(text, match.start(), match.end(), False)]


def _scan(raw: str) -> Optional[CrisisSignal]:
    text = _canonical(_normalise(raw))
    if not text:
        return None
    ideation = _hits(_IDEATION, text)
    ideation += [match.group(0) for match in STEM.finditer(text) if not _negated(text, match.start(), match.end(), True)]
    overdose = _hits(_OVERDOSE, text)
    threat = _hits(_THREAT, text)
    fear = _hits(_FEAR, text)
    if overdose:
        return CrisisSignal(OVERDOSE, list(dict.fromkeys(overdose + ideation)))
    if ideation:
        kind = SELF_HARM_IMMINENT if IMMINENT.search(text) else SELF_HARM_IDEATION
        return CrisisSignal(kind, list(dict.fromkeys(ideation)))
    if threat:
        return CrisisSignal(OTHER_THREAT, list(dict.fromkeys(threat)))
    if fear:
        kind = OTHER_THREAT if SYMPTOMS.search(text) else SELF_HARM_IDEATION
        return CrisisSignal(kind, list(dict.fromkeys(fear)))
    return None


_RANK = {OVERDOSE: 4, SELF_HARM_IMMINENT: 3, SELF_HARM_IDEATION: 2, OTHER_THREAT: 1}


def detect_crisis(text: str, history: Optional[List[Dict[str, Any]]] = None) -> Optional[CrisisSignal]:
    """Return the most serious crisis in this message or the last few user turns, else None."""
    current = _scan(text)
    if current:
        return current
    best: Optional[CrisisSignal] = None
    users = [str(turn.get("content") or turn.get("text") or "") for turn in (history or [])
             if isinstance(turn, dict) and turn.get("role") == "user"]
    for earlier in users[-HISTORY_TURNS:]:
        found = _scan(earlier)
        if found and (best is None or _RANK[found.kind] > _RANK[best.kind]):
            best = found
    if best:
        best.source = "history"
    return best
