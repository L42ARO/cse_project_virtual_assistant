import json
import os
from datetime import datetime
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv

SESSION_LOG_FILE = "session_logs.json"
AZURE_BLOB_NAME = "session_logs.json"  # Remote blob name

class SessionLoggingService:
    def __init__(self, session_log_path=SESSION_LOG_FILE):
        load_dotenv()
        self.session_log_path = session_log_path
        self.api_key = os.getenv("STORAGE_KEY")

        if not self.api_key:
            raise ValueError("❌ API key not found! Check your .env file.")

        self.connection_string = (
            f"DefaultEndpointsProtocol=https;"
            f"AccountName=usfcapstone2025;"
            f"AccountKey={self.api_key};"
            f"EndpointSuffix=core.windows.net"
        )

        self.container_name = "chathistory"
        self.blob_name = AZURE_BLOB_NAME
        self.blob_service_client = BlobServiceClient.from_connection_string(self.connection_string)
        self.container_client = self.blob_service_client.get_container_client(self.container_name)

        # Ensure local file exists
        if not os.path.exists(self.session_log_path):
            with open(self.session_log_path, "w") as f:
                json.dump([], f)

    def _load_sessions(self):
        with open(self.session_log_path, "r") as f:
            return json.load(f)

    def _save_sessions(self, sessions):
        with open(self.session_log_path, "w") as f:
            json.dump(sessions, f, indent=2)
        self._upload_blob(json.dumps(sessions, indent=2))

    def _upload_blob(self, data):
        blob_client = self.container_client.get_blob_client(self.blob_name)
        blob_client.upload_blob(data, overwrite=True)
        print("☁️ Synced session log to Azure Blob Storage.")

    def _download_blob(self):
        try:
            blob_client = self.container_client.get_blob_client(self.blob_name)
            data = blob_client.download_blob().readall()
            return json.loads(data)
        except Exception as e:
            print(f"⚠️ Failed to download blob: {e}")
            return []

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

