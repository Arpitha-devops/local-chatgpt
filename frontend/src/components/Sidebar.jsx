export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onClose }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-gray-50 border-r border-gray-200">
      <div className="flex h-14 items-center justify-between px-3">
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-200"
          title="Close sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
          </svg>
        </button>
        <button onClick={onNew} className="rounded-lg p-2 text-gray-500 hover:bg-gray-200" title="New chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length > 0 && <p className="px-2 py-2 text-xs font-medium text-gray-500">Chats</p>}
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`group flex cursor-pointer items-center rounded-lg px-2 py-2 text-sm ${
              c.id === activeId ? 'bg-gray-200' : 'hover:bg-gray-100'
            }`}
          >
            <span className="flex-1 truncate">{c.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(c.id)
              }}
              className="ml-1 hidden rounded p-0.5 text-gray-400 hover:text-red-600 group-hover:block"
              title="Delete chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
        ))}
      </nav>
    </aside>
  )
}
