"""Speech-to-text endpoint using ElevenLabs Scribe."""

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.services.elevenlabs import elevenlabs_service

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
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {str(e)}")
