# Local ChatGPT

A ChatGPT-style chat UI that runs entirely on your machine using Ollama.

- `backend/`: FastAPI. It proxies requests to Ollama (`localhost:11434`), streams responses back, and stores chats in a SQLite database (`backend/chat.db`).
- `frontend/`: React, Vite, and Tailwind CSS.

## Run

```bash
./start.sh
```

Then open http://localhost:5173.

Prerequisites: Ollama must be running, and you need at least one pulled model (`ollama pull llama3.2`).

## API

- `GET /api/models`: lists your local Ollama models.
- `POST /api/chat`: takes `{ model, messages: [{role, content}], system? }` and streams back NDJSON events:
  - `{"type": "token", "content": "..."}`: a piece of the reply.
  - `{"type": "done", "stats": {...}}`: sent once at the end, with the model name, token counts, timings, tokens per second and cost.
  - `{"type": "error", "message": "..."}`: sent if something goes wrong.
- `GET /api/health`: checks whether Ollama is reachable.
- `POST /api/documents`: takes an uploaded PDF, Word (.docx) or text file (up to 20 MB) and returns `{ name, text }`. Pass these as a message's `documents` in `/api/chat` to give the model the file's contents.
- `GET /api/conversations`: lists saved chats with their messages, newest first.
- `PUT /api/conversations/{id}`: saves a chat, taking `{ title, updatedAt, messages }`.
- `DELETE /api/conversations/{id}`: deletes a chat.

To point at a different Ollama host, set `OLLAMA_URL`. To keep the database somewhere else, set `DB_PATH`.
