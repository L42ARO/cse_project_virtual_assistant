import json
import os
from datetime import datetime

SESSION_LOG_FILE = "session_logs.json"

class SessionLoggingService:
    def __init__(self, session_log_path=SESSION_LOG_FILE):
        self.session_log_path = session_log_path
        if not os.path.exists(self.session_log_path):
            with open(self.session_log_path, "w") as f:
                json.dump([], f)

    def _load_sessions(self):
        with open(self.session_log_path, "r") as f:
            return json.load(f)

    def _save_sessions(self, sessions):
        with open(self.session_log_path, "w") as f:
            json.dump(sessions, f, indent=2)

    def log_session(self, session_id, thread_id, username, course_id):
        sessions = self._load_sessions()
        new_session = {
            "session_id": session_id,
            "thread_id": thread_id,
            "username": username,
            "course_id": course_id,
            "timestamp": datetime.now().isoformat()
        }
        sessions.append(new_session)
        self._save_sessions(sessions)
        print(f"📝 Logged session: {new_session}")
        return new_session

    def get_sessions(self, course_id=None, username=None):
        sessions = self._load_sessions()
        filtered = sessions

        if course_id:
            filtered = [s for s in filtered if s["course_id"] == course_id]
        if username:
            filtered = [s for s in filtered if s["username"] == username]

        print(f"🔍 Returning {len(filtered)} sessions (course_id={course_id}, username={username})")
        return filtered
