"""
Advisory chat endpoints. Streams LLM tokens from Ollama back to the dashboard.

GET  /api/v1/advisory/health    Ollama reachability + model status
POST /api/v1/advisory/context   The DB snapshot the LLM will see (for debugging)
POST /api/v1/advisory/chat      Streamed chat completion (text/plain stream)
"""
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.advisory import (
    build_context, health_check, render_system_prompt, stream_chat,
)

router = APIRouter()


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    lang: Literal["en", "ms"] = "en"


@router.get("/health")
def health():
    return health_check()


@router.get("/context")
def context(db: Session = Depends(get_db)):
    """Return the live context snapshot + the rendered system prompt.
    Useful for debugging and for showing the user what the LLM sees."""
    ctx = build_context(db)
    return {
        "context": ctx,
        "system_prompt_en": render_system_prompt(ctx, "en"),
        "system_prompt_ms": render_system_prompt(ctx, "ms"),
    }


@router.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    """Stream LLM tokens as plain text. Each chunk is appended to the response
    body as it arrives from Ollama. Frontend reads via the Fetch ReadableStream."""
    messages = [m.model_dump() for m in req.messages]

    def generate():
        for chunk in stream_chat(messages, req.lang, db):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
        headers={"X-Accel-Buffering": "no"},  # disable nginx buffering if proxied
    )
