import { useEffect, useRef, useState } from 'react'
import { DocumentChip } from './Message.jsx'

async function uploadDocument(file) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/documents', { method: 'POST', body })
  if (!res.ok) {
    const detail = (await res.json().catch(() => null))?.detail
    throw new Error(typeof detail === 'string' ? detail : `Could not upload ${file.name}`)
  }
  return res.json()
}

export default function Composer({ onSend, onStop, onError, streaming, disabled }) {
  const [text, setText] = useState('')
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const ref = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [text])

  const canSend = (text.trim() || documents.length > 0) && !uploading && !disabled

  function submit() {
    if (!canSend || streaming) return
    onSend(text.trim(), documents)
    setText('')
    setDocuments([])
  }

  async function handleFiles(files) {
    if (!files.length) return
    onError('')
    setUploading(true)
    const results = await Promise.allSettled(files.map(uploadDocument))
    setDocuments((docs) => [...docs, ...results.filter((r) => r.status === 'fulfilled').map((r) => r.value)])
    const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message)
    if (failed.length) onError(failed.join(' · '))
    setUploading(false)
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#303030]">
      {(documents.length > 0 || uploading) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {documents.map((d, i) => (
            <DocumentChip
              key={i}
              name={d.name}
              onRemove={() => setDocuments((docs) => docs.filter((_, j) => j !== i))}
            />
          ))}
          {uploading && <span className="text-sm text-gray-500 dark:text-gray-400">Reading document…</span>}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.docx,.txt,.md,.csv,.json,text/*"
          onChange={(e) => {
            handleFiles([...e.target.files])
            e.target.value = ''
          }}
        />
        <button
          onClick={() => fileRef.current.click()}
          disabled={uploading}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10"
          title="Attach a document (PDF, Word or text)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" />
          </svg>
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          autoFocus
          placeholder="Ask anything"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 placeholder:text-gray-400 focus:outline-none"
        />
        {streaming ? (
          <button
            onClick={onStop}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            title="Stop"
          >
            <span className="h-3 w-3 rounded-sm bg-white dark:bg-black" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canSend}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
            title="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
