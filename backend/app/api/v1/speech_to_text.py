"""Speech-to-text endpoint using ElevenLabs Scribe."""

import logging

from fastapi import APIRouter, HTTPException, UploadFile, File
from httpx import HTTPStatusError

from app.services.elevenlabs import elevenlabs_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/speech-to-text")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe an audio file using ElevenLabs Speech-to-Text.

    Accepts audio in webm, mp3, wav, m4a, ogg formats.
    Returns the transcribed text.
    """
    if not elevenlabs_service.api_key:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")

    audio_data = await file.read()

    if len(audio_data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # 25MB limit
    if len(audio_data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")

    try:
        result = await elevenlabs_service.speech_to_text(audio_data)
        return {"text": result.get("text", ""), "language_code": result.get("language_code", "en")}
    except HTTPStatusError as e:
        logger.error(
            "ElevenLabs STT error: status=%s body=%s key_prefix=%s",
            e.response.status_code,
            e.response.text[:200],
            elevenlabs_service.api_key[:8] + "..." if elevenlabs_service.api_key else "EMPTY",
        )
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs returned {e.response.status_code}: {e.response.text[:200]}",
        )
    except Exception as e:
        logger.error("Transcription error: %s", str(e))
        raise HTTPException(status_code=502, detail=f"Transcription failed: {str(e)}")
