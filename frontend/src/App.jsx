import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Message from './components/Message.jsx'
import Composer from './components/Composer.jsx'

const STORAGE_KEY = 'local-chatgpt:conversations'

function loadConversations() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

function newConversation() {
  return { id: crypto.randomUUID(), title: 'New chat', messages: [], updatedAt: Date.now() }
}

export default function App() {
  const [conversations, setConversations] = useState(loadConversations)
  const [activeId, setActiveId] = useState(() => conversations[0]?.id ?? null)
  const [models, setModels] = useState([])
  const [model, setModel] = useState(() => localStorage.getItem('local-chatgpt:model') || '')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const abortRef = useRef(null)
  const bottomRef = useRef(null)

  const active = conversations.find((c) => c.id === activeId)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
    } catch {}
  }, [conversations])

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
    if (id === activeId) setActiveId(null)
  }

  async function handleSend(text) {
    if (!model || streaming) return
    setError('')

    let conv = active
    if (!conv) {
      conv = newConversation()
      setConversations((cs) => [conv, ...cs])
      setActiveId(conv.id)
    }
    const id = conv.id
    const history = [...conv.messages, { role: 'user', content: text }]

    updateConversation(id, (c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
      messages: [...history, { role: 'assistant', content: '' }],
    }))

    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: history }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        updateConversation(id, (c) => {
          const msgs = [...c.messages]
          const last = msgs[msgs.length - 1]
          msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
          return { ...c, messages: msgs }
        })
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex h-full text-gray-900">
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
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
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
            className="rounded-lg bg-transparent px-2 py-1.5 text-lg font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none"
          >
            {models.length === 0 && <option value="">No models</option>}
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!active || active.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4">
              <h1 className="text-3xl font-semibold text-gray-800">What can I help with?</h1>
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
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Composer onSend={handleSend} onStop={handleStop} streaming={streaming} disabled={!model} />
          <p className="mt-2 text-center text-xs text-gray-500">
            Running locally via Ollama. Responses can be inaccurate.
          </p>
        </div>
      </main>
    </div>
  )
}
