import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function Stats({ stats }) {
  const parts = [stats.model]
  if (stats.total_tokens != null) {
    parts.push(`${stats.total_tokens} tokens (${stats.prompt_tokens} in · ${stats.output_tokens} out)`)
  }
  parts.push(`${stats.total_seconds}s`)
  if (stats.tokens_per_second) parts.push(`${stats.tokens_per_second} tok/s`)
  parts.push(`$${(stats.cost_usd ?? 0).toFixed(2)}`)
  if (stats.stopped) parts.push('stopped')

  const title = stats.load_seconds ? `Includes ${stats.load_seconds}s to load the model into memory` : undefined

  return (
    <p title={title} className="mt-2 text-xs text-gray-400 dark:text-gray-500">
      {parts.join(' · ')}
    </p>
  )
}

export function DocumentChip({ name, onRemove }) {
  return (
    <span className="flex max-w-[240px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-[#212121]">
      <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
      </svg>
      <span className="truncate" title={name}>
        {name}
      </span>
      {onRemove && (
        <button onClick={onRemove} className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" title="Remove">
          ✕
        </button>
      )}
    </span>
  )
}

export default function Message({ message, pending }) {
  if (message.role === 'user') {
    return (
      <div className="mb-6 flex flex-col items-end gap-2">
        {message.documents?.length > 0 && (
          <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
            {message.documents.map((d, i) => (
              <DocumentChip key={i} name={d.name} />
            ))}
          </div>
        )}
        {message.content && (
          <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-gray-100 px-5 py-2.5 dark:bg-[#303030]">
            {message.content}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mb-6">
      {message.content ? (
        <div className="prose prose-gray max-w-none dark:prose-invert prose-pre:bg-gray-900 prose-pre:text-gray-100 dark:prose-pre:bg-black/50">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      ) : pending ? (
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-gray-800 dark:bg-gray-200" />
      ) : null}
      {message.stats && !pending && <Stats stats={message.stats} />}
    </div>
  )
}
