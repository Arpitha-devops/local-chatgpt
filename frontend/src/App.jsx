import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Message from './components/Message.jsx'
import Composer from './components/Composer.jsx'
import ThemeSettings, { useTheme } from './components/ThemeSettings.jsx'

// Chats used to live in localStorage; anything still there is imported into the database on load.
const LEGACY_STORAGE_KEY = 'local-chatgpt:conversations'

function loadLegacyConversations() {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)) || []
  } catch {
    return []
  }
}

async function saveConversation({ id, title, updatedAt, messages }) {
  const res = await fetch(`/api/conversations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, updatedAt, messages }),
  })
  if (!res.ok) throw new Error(`Server error ${res.status}`)
}

function newConversation() {
  return { id: crypto.randomUUID(), title: 'New chat', messages: [], updatedAt: Date.now() }
}

export default function App() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [models, setModels] = useState([])
  const [model, setModel] = useState(() => localStorage.getItem('local-chatgpt:model') || '')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [theme, setTheme] = useTheme()
  const abortRef = useRef(null)
  const bottomRef = useRef(null)
  const savedRef = useRef(new Map()) // id -> conversation object as last written to the database

  const active = conversations.find((c) => c.id === activeId)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/conversations')
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const stored = (await res.json()).conversations
      const legacy = loadLegacyConversations().filter(
        (c) => c.messages?.length && !stored.some((s) => s.id === c.id),
      )
      await Promise.all(legacy.map(saveConversation))
      localStorage.removeItem(LEGACY_STORAGE_KEY)

      const loaded = [...stored, ...legacy]
      loaded.forEach((c) => savedRef.current.set(c.id, c))
      setConversations((cs) => [...cs, ...loaded.filter((c) => !cs.some((x) => x.id === c.id))])
      setActiveId((id) => id ?? loaded[0]?.id ?? null)
    }
    load().catch((e) => setError(`Could not load saved chats: ${e.message}`))
  }, [])

  // Write changed conversations to the database. Skipped mid-stream so we don't save on every token.
  useEffect(() => {
    if (streaming) return
    for (const c of conversations) {
      if (c.messages.length === 0 || savedRef.current.get(c.id) === c) continue
      savedRef.current.set(c.id, c)
      saveConversation(c).catch((e) => {
        savedRef.current.delete(c.id)
        setError(`Could not save chat: ${e.message}`)
      })
    }
  }, [conversations, streaming])

  useEffect(() => {
    if (model) localStorage.setItem('local-chatgpt:model', model)
  }, [model])

  useEffect(() => {
    fetch('/api/models')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load models from Ollama'))))
      .then((data) => {
        setModels(data.models)
        setModel((m) => (data.models.includes(m) ? m : data.models[0] || ''))
        if (!data.models.length) setError('No Ollama models found. Run e.g. `ollama pull llama3.2`.')
      })
      .catch((e) => setError(`${e.message}. Is Ollama running on localhost:11434?`))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [active?.messages])

  function updateConversation(id, fn) {
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)))
  }

  function handleNewChat() {
    if (active && active.messages.length === 0) return
    const c = newConversation()
    setConversations((cs) => [c, ...cs])
    setActiveId(c.id)
  }

  function handleDelete(id) {
    setConversations((cs) => cs.filter((c) => c.id !== id))
    savedRef.current.delete(id)
    fetch(`/api/conversations/${id}`, { method: 'DELETE' }).catch((e) =>
      setError(`Could not delete chat: ${e.message}`),
    )
    if (id === activeId) setActiveId(null)
  }

  async function handleSend(text, documents = []) {
    if (!model || streaming) return
    setError('')

    let conv = active
    if (!conv) {
      conv = newConversation()
      setConversations((cs) => [conv, ...cs])
      setActiveId(conv.id)
    }
    const id = conv.id
    const userMessage = { role: 'user', content: text }
    if (documents.length) userMessage.documents = documents
    const history = [...conv.messages, userMessage]

    const title = conv.messages.length === 0 ? (text || documents[0].name).slice(0, 40) : conv.title

    updateConversation(id, (c) => ({
      ...c,
      title,
      messages: [...history, { role: 'assistant', content: '' }],
    }))
    // Save the question now so it survives a reload mid-reply; the reply is saved when streaming ends.
    saveConversation({ ...conv, title, messages: history, updatedAt: Date.now() }).catch(() => {})

    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)

    const updateLast = (fn) =>
      updateConversation(id, (c) => {
        const msgs = [...c.messages]
        msgs[msgs.length - 1] = fn(msgs[msgs.length - 1])
        return { ...c, messages: msgs }
      })
    const startedAt = performance.now()
    let gotStats = false

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: history.map(({ role, content, documents }) => ({ role, content, documents })) }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`)

      // The backend streams NDJSON: one {"type": ...} event per line.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line)
          if (evt.type === 'token') {
            updateLast((m) => ({ ...m, content: m.content + evt.content }))
          } else if (evt.type === 'done') {
            gotStats = true
            updateLast((m) => ({ ...m, stats: evt.stats }))
          } else if (evt.type === 'error') {
            setError(evt.message)
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      if (!gotStats) {
        // Stopped or failed before Ollama sent its stats; keep what we can measure here.
        const total_seconds = Math.round((performance.now() - startedAt) / 10) / 100
        updateLast((m) => ({ ...m, stats: { model, total_seconds, cost_usd: 0, stopped: true } }))
      }
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex h-full text-gray-900 dark:text-gray-100">
      {sidebarOpen && (
        <Sidebar
          conversations={sorted}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={handleNewChat}
          onDelete={handleDelete}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 px-3">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              title="Open sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
              </svg>
            </button>
          )}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg bg-transparent px-2 py-1.5 text-lg font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none dark:text-gray-200 dark:hover:bg-white/10"
          >
            {models.length === 0 && <option value="">No models</option>}
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="ml-auto">
            <ThemeSettings theme={theme} onChange={setTheme} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!active || active.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4">
              <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">What can I help with?</h1>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-6">
              {active.messages.map((m, i) => (
                <Message
                  key={i}
                  message={m}
                  pending={streaming && i === active.messages.length - 1 && m.role === 'assistant'}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          {error && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          <Composer
            onSend={handleSend}
            onStop={handleStop}
            onError={setError}
            streaming={streaming}
            disabled={!model}
          />
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            Running locally via Ollama. Responses can be inaccurate.
          </p>
        </div>
      </main>
    </div>
  )
}
