import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Message({ message, pending }) {
  if (message.role === 'user') {
    return (
      <div className="mb-6 flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-gray-100 px-5 py-2.5">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      {message.content ? (
        <div className="prose prose-gray max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      ) : pending ? (
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-gray-800" />
      ) : null}
    </div>
  )
}
