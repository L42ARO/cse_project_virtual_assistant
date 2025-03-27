from openai import OpenAI, AzureOpenAI
import os
import time
from dotenv import load_dotenv

load_dotenv()

class OpenAIService:
    def __init__(
        self,
        api_key_env="OPENAI_API_KEY",
        endpoint=None,
        deployment_id=None,
        api_version="2024-05-01-preview"
    ):
        self.api_key = os.getenv(api_key_env)
        if not self.api_key:
            raise ValueError(f"API key not found in env var: {api_key_env}")

        self.endpoint = endpoint
        self.is_azure = bool(endpoint)
        self.deployment_id = deployment_id

        if self.is_azure:
            self.client = AzureOpenAI(
                api_key=self.api_key,
                azure_endpoint=endpoint,
                api_version=api_version
            )
        else:
            self.client = OpenAI(api_key=self.api_key)

    # === Assistants ===

    def create_assistant(self, name, instructions, model="gpt-4-1106-preview", vector_store_id=None):
        tools = []
        tool_resources = {}

        if vector_store_id:
            tools.append({"type": "file_search"})
            tool_resources = {"file_search": {"vector_store_ids": [vector_store_id]}}

        return self.client.beta.assistants.create(
            name=name,
            instructions=instructions,
            model=model,
            tools=tools,
            tool_resources=tool_resources
        ).id

    def update_assistant(self, assistant_id, instructions=None, name=None, model=None):
        return self.client.beta.assistants.update(
            assistant_id=assistant_id,
            instructions=instructions,
            name=name,
            model=model
        )

    # === Vector Store ===

    def create_vector_store(self, name="CourseStore"):
        store = self.client.beta.vector_stores.create(name=name)
        return store.id

    def add_file(self, file_obj):
        return self.client.files.create(file=file_obj, purpose="assistants")

    def add_file_to_vector_store(self, file_id, vector_store_id):
        return self.client.beta.vector_stores.file_batches.create(
            vector_store_id=vector_store_id,
            file_ids=[file_id]
        )

    def remove_file(self, file_id):
        return self.client.files.delete(file_id)

    def list_files_in_vector_store(self, vector_store_id):
        return self.client.beta.vector_stores.files.list(vector_store_id=vector_store_id)

    # === Threads & Messages ===

    def create_thread(self, vector_store_id=None):
        tool_resources = (
            {"file_search": {"vector_store_ids": [vector_store_id]}}
            if vector_store_id else None
        )
        return self.client.beta.threads.create(tool_resources=tool_resources)

    def add_message(self, thread_id, content, file_ids=None):
        message_payload = {
            "thread_id": thread_id,
            "role": "user",
            "content": content
        }
        if file_ids:
            message_payload["attachments"] = [{"file_id": fid, "tools": [{"type": "file_search"}]} for fid in file_ids]

        return self.client.beta.threads.messages.create(**message_payload)


    def run_thread(self, thread_id, assistant_id, stream=False, event_handler=None):
        if stream:
            return self.client.beta.threads.runs.stream(
                thread_id=thread_id,
                assistant_id=assistant_id,
                event_handler=event_handler
            )
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
