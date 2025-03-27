import os
import time
from openai import OpenAI, AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

class OpenAIService:
    def __init__(
        self,
        api_key_env="OPENAI_API_KEY",
        endpoint=None,
        deployment_id=None,
        vector_store_id=None,
        create_vector_store_if_missing=True,
        api_version="gpt-4o-mini"
    ):
        self.api_key = os.getenv(api_key_env)
        if not self.api_key:
            raise ValueError(f"API key not found in environment variable: {api_key_env}")

        self.endpoint = endpoint
        self.is_azure = bool(endpoint)
        self.deployment_id = deployment_id

        # Choose correct client
        if self.is_azure:
            self.client = AzureOpenAI(
                api_key=self.api_key,
                azure_endpoint=endpoint,
                api_version=api_version
            )
        else:
            self.client = OpenAI(api_key=self.api_key)

        # Vector store logic
        if vector_store_id:
            self.vector_store_id = vector_store_id
        elif create_vector_store_if_missing:
            store = self.client.beta.vector_stores.create(name="AutoStore")
            self.vector_store_id = store.id
        else:
            self.vector_store_id = None

    # === Thread Management ===

    def new_thread(self):
        tool_resources = (
            {"file_search": {"vector_store_ids": [self.vector_store_id]}}
            if self.vector_store_id else None
        )
        return self.client.beta.threads.create(tool_resources=tool_resources)

    def add_message(self, thread_id, content, file_ids=None):
        return self.client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=content,
            file_ids=file_ids
        )

    def run_thread(self, thread_id, assistant_id, stream=False, event_handler=None):
        if stream:
            return self.client.beta.threads.runs.stream(
                thread_id=thread_id,
                assistant_id=assistant_id,
                event_handler=event_handler
            )
        else:
            return self.client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=assistant_id
            )

    def wait_for_run(self, thread_id, run_id, poll_interval=1):
        while True:
            run = self.client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run_id)
            if run.status == "completed":
                return run
            elif run.status in ["failed", "cancelled", "expired"]:
                raise RuntimeError(f"Run failed with status: {run.status}")
            time.sleep(poll_interval)

    def get_latest_response(self, thread_id):
        messages = self.client.beta.threads.messages.list(thread_id=thread_id)
        for msg in reversed(messages.data):
            if msg.role == "assistant":
                return msg.content[0].text.value
        return None

    # === File Handling ===

    def add_file(self, filepath):
        with open(filepath, "rb") as f:
            return self.client.files.create(file=f, purpose="assistants")

    def remove_file(self, file_id):
        return self.client.files.delete(file_id)

    def upload_files_to_vector_store(self, filepaths):
        if not self.vector_store_id:
            raise RuntimeError("No vector store initialized.")
        file_ids = []
        for path in filepaths:
            file = self.add_file(path)
            file_ids.append(file.id)
        self.client.beta.vector_stores.file_batches.create(
            vector_store_id=self.vector_store_id,
            file_ids=file_ids
        )
        return file_ids

    # === Assistant Creation (optional helper) ===

    def create_assistant(self, name, instructions, model="gpt-4-1106-preview"):
        tools = [{"type": "file_search"}] if self.vector_store_id else []
        tool_resources = {
            "file_search": {"vector_store_ids": [self.vector_store_id]}
        } if self.vector_store_id else {}

        return self.client.beta.assistants.create(
            name=name,
            instructions=instructions,
            model=model,
            tools=tools,
            tool_resources=tool_resources
        )
