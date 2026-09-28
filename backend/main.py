import json
import os
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

app = FastAPI(title="Local ChatGPT")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: List[Message]
    system: Optional[str] = None


@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{OLLAMA_URL}/api/version")
            r.raise_for_status()
            return {"ok": True, "ollama": r.json().get("version")}
    except httpx.HTTPError:
        return {"ok": False, "ollama": None}


@app.get("/api/models")
async def models():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Cannot reach Ollama at {OLLAMA_URL}: {e}")
    return {"models": [m["name"] for m in r.json().get("models", [])]}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    messages = [m.dict() for m in req.messages]
    if req.system:
        messages.insert(0, {"role": "system", "content": req.system})
    payload = {"model": req.model, "messages": messages, "stream": True}

    async def stream():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as r:
                    if r.status_code != 200:
                        body = (await r.aread()).decode(errors="ignore")
                        yield f"\n\n[Error from Ollama: {body}]"
                        return
                    async for line in r.aiter_lines():
                        if not line:
                            continue
                        data = json.loads(line)
                        if data.get("error"):
                            yield f"\n\n[Error: {data['error']}]"
                            return
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                        if data.get("done"):
                            return
        except httpx.HTTPError as e:
            yield f"\n\n[Cannot reach Ollama at {OLLAMA_URL}: {e}]"

    return StreamingResponse(
        stream(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
