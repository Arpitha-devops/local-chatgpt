import { useEffect, useRef, useState } from 'react'

export default function Composer({ onSend, onStop, streaming, disabled }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [text])

  function submit() {
    const t = text.trim()
    if (!t || streaming || disabled) return
    onSend(t)
    setText('')
  }

  return (
    <div className="flex items-end gap-2 rounded-3xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
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
        className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 focus:outline-none"
      />
      {streaming ? (
        <button
          onClick={onStop}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white hover:bg-gray-800"
          title="Stop"
        >
          <span className="h-3 w-3 rounded-sm bg-white" />
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-300"
          title="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
