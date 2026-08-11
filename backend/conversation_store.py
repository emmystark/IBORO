import sqlite3
import json
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "app.db"
LEGACY_JSON = Path(__file__).parent / "conversations.json"


class ConversationStore:
    def __init__(self):
        self.db_path = DB_PATH
        self._init_db()
        self._migrate_from_json()

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self):
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    title TEXT DEFAULT 'New Conversation',
                    created_at TEXT NOT NULL,
                    deleted_at TEXT,
                    scope TEXT DEFAULT 'general'
                )
            """)
            # Lightweight migration for DBs created before `scope` existed.
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN scope TEXT DEFAULT 'general'")
            except sqlite3.OperationalError:
                pass
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TEXT,
                    sources TEXT DEFAULT '[]',
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id)")

    def _migrate_from_json(self):
        if not LEGACY_JSON.exists():
            return
        with self._conn() as conn:
            if conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0] > 0:
                return
        try:
            with open(LEGACY_JSON) as f:
                data = json.load(f)
            with self._conn() as conn:
                for conv_id, conv in data.items():
                    conn.execute(
                        "INSERT OR IGNORE INTO conversations (id, user_id, title, created_at, deleted_at) VALUES (?,?,?,?,?)",
                        (conv_id, conv.get("user_id"), conv.get("title", "Conversation"),
                         conv.get("createdAt", datetime.utcnow().isoformat() + "Z"),
                         conv.get("deletedAt")),
                    )
                    for msg in conv.get("messages", []):
                        msg_id = msg.get("id") or f"{msg['role']}_{msg.get('timestamp','')}"
                        conn.execute(
                            "INSERT OR IGNORE INTO messages (id, conversation_id, role, content, timestamp, sources) VALUES (?,?,?,?,?,?)",
                            (msg_id, conv_id, msg["role"], msg["content"],
                             msg.get("timestamp"), json.dumps(msg.get("sources", []))),
                        )
            print(f"✓ Migrated {len(data)} conversations from JSON to SQLite")
        except Exception as e:
            print(f"Migration warning: {e}")

    def _row_to_conv(self, conn, row) -> Dict[str, Any]:
        conv = dict(row)
        msgs = conn.execute(
            "SELECT * FROM messages WHERE conversation_id=? ORDER BY rowid", (conv["id"],)
        ).fetchall()
        conv["messages"] = [
            {**dict(m), "sources": json.loads(m["sources"] or "[]")}
            for m in msgs
        ]
        conv["createdAt"] = conv.pop("created_at")
        conv["is_deleted"] = conv["deleted_at"] is not None
        return conv

    def get_all_conversations(self) -> Dict[str, Any]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM conversations").fetchall()
            return {r["id"]: self._row_to_conv(conn, r) for r in rows}

    def get_user_conversations(self, user_id: str, include_deleted: bool = False) -> Dict[str, Any]:
        with self._conn() as conn:
            if include_deleted:
                rows = conn.execute("SELECT * FROM conversations WHERE user_id=?", (user_id,)).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM conversations WHERE user_id=? AND deleted_at IS NULL", (user_id,)
                ).fetchall()
            return {r["id"]: self._row_to_conv(conn, r) for r in rows}

    def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM conversations WHERE id=?", (conversation_id,)).fetchone()
            return self._row_to_conv(conn, row) if row else None

    def create_conversation(self, conversation_id: str, title: str = "New Conversation", user_id: str = None, scope: str = "general") -> Dict[str, Any]:
        now = datetime.utcnow().isoformat() + "Z"
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO conversations (id, user_id, title, created_at, scope) VALUES (?,?,?,?,?)",
                (conversation_id, user_id, title, now, scope),
            )
        return {"id": conversation_id, "user_id": user_id, "title": title, "messages": [], "createdAt": now, "is_deleted": False, "scope": scope}

    def add_message(self, conversation_id: str, message: Dict[str, Any]):
        with self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO messages (id, conversation_id, role, content, timestamp, sources) VALUES (?,?,?,?,?,?)",
                (message.get("id"), conversation_id, message["role"], message["content"],
                 message.get("timestamp"), json.dumps(message.get("sources", []))),
            )

    def update_conversation_title(self, conversation_id: str, title: str):
        with self._conn() as conn:
            conn.execute("UPDATE conversations SET title=? WHERE id=?", (title, conversation_id))

    def delete_conversation(self, conversation_id: str):
        now = datetime.utcnow().isoformat() + "Z"
        with self._conn() as conn:
            conn.execute("UPDATE conversations SET deleted_at=? WHERE id=?", (now, conversation_id))

    def get_all_user_conversations_including_deleted(self, user_id: str) -> Dict[str, Any]:
        return self.get_user_conversations(user_id, include_deleted=True)
