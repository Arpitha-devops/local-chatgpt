# Local ChatGPT

A ChatGPT-style chat UI that runs entirely on your machine using Ollama.

- `backend/`: FastAPI. It proxies requests to Ollama (`localhost:11434`) and streams responses back.
- `frontend/`: React, Vite, and Tailwind CSS. Chats are saved in the browser's localStorage.

## Run

```bash
./start.sh
```

Then open http://localhost:5173.

Prerequisites: Ollama must be running, and you need at least one pulled model (`ollama pull llama3.2`).

## API

- `GET /api/models`: lists your local Ollama models.
- `POST /api/chat`: takes `{ model, messages: [{role, content}], system? }` and streams back plain-text chunks.
- `GET /api/health`: checks whether Ollama is reachable.

To point at a different Ollama host, set `OLLAMA_URL`.
