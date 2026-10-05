import json
import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "chat.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    updated_at INTEGER NOT NULL  -- ms since epoch
);
CREATE TABLE IF NOT EXISTS messages (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    stats           TEXT,  -- JSON, assistant messages only
    documents       TEXT,  -- JSON list of {name, text}, user messages only
    PRIMARY KEY (conversation_id, position)
);
"""


@contextmanager
def connect():
    """Opens a connection, commits on success, rolls back on error."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init():
    with connect() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)
        # Databases created before document uploads lack this column.
        columns = [row["name"] for row in conn.execute("PRAGMA table_info(messages)")]
        if "documents" not in columns:
            conn.execute("ALTER TABLE messages ADD COLUMN documents TEXT")


def list_conversations():
    with connect() as conn:
        conversations = {
            row["id"]: {"id": row["id"], "title": row["title"], "updatedAt": row["updated_at"], "messages": []}
            for row in conn.execute("SELECT * FROM conversations ORDER BY updated_at DESC")
        }
        for row in conn.execute("SELECT * FROM messages ORDER BY conversation_id, position"):
            message = {"role": row["role"], "content": row["content"]}
            if row["stats"]:
                message["stats"] = json.loads(row["stats"])
            if row["documents"]:
                message["documents"] = json.loads(row["documents"])
            conversations[row["conversation_id"]]["messages"].append(message)
    return list(conversations.values())


def save_conversation(id, title, updated_at, messages):
    """Inserts or replaces a conversation along with all of its messages."""
    with connect() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at",
            (id, title, updated_at),
        )
        conn.execute("DELETE FROM messages WHERE conversation_id = ?", (id,))
        conn.executemany(
            "INSERT INTO messages (conversation_id, position, role, content, stats, documents) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [
                (
                    id,
                    i,
                    m["role"],
                    m["content"],
                    json.dumps(m["stats"]) if m.get("stats") else None,
                    json.dumps(m["documents"]) if m.get("documents") else None,
                )
                for i, m in enumerate(messages)
            ],
        )


def delete_conversation(id):
    with connect() as conn:
        conn.execute("DELETE FROM conversations WHERE id = ?", (id,))
