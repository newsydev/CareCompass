import os
from typing import Tuple, Optional
from groq import Groq
from app.config import GROQ_API_KEY

def get_groq_client() -> Groq:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured. Please set it in backend/.env")
    return Groq(api_key=GROQ_API_KEY)

async def transcribe_audio_bytes(
    file_bytes: bytes,
    filename: str = "audio.wav",
    language_hint: Optional[str] = None
) -> Tuple[str, str]:
    """
    Transcribes audio bytes using Groq's whisper-large-v3 model.
    Returns (transcription_text, detected_language).
    """
    client = get_groq_client()

    # Pass audio file directly as a tuple (filename, bytes)
    audio_file = (filename, file_bytes)

    kwargs = {
        "file": audio_file,
        "model": "whisper-large-v3",
        "response_format": "verbose_json",
        "temperature": 0.0
    }
    if language_hint and language_hint != "auto":
        kwargs["language"] = language_hint

    transcription = client.audio.transcriptions.create(**kwargs)

    text = getattr(transcription, "text", "")
    detected_lang = getattr(transcription, "language", "en")

    return text.strip(), detected_lang
