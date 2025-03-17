import os
import threading
from openai import AzureOpenAI
from dotenv import load_dotenv
from typing_extensions import override
from openai import AssistantEventHandler

class OpenAIService:
    def __init__(self):
        load_dotenv()
        api_key = os.getenv("OPENAI_API_KEY_1")
        endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")

        if not api_key:
            raise ValueError("❌ API key not found! Check your .env file.")
        if not endpoint:
            raise ValueError("❌ ENDPOINT not found! Check your .env file.")

        self.client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version="2024-05-01-preview",
        )
        self.threads = {}

    def InitializeThread(self, assistant_id, vs_id, init_message=""):

        thread = self.client.beta.threads.create(
            # messages=[{"role": "user", "content": init_message}],
            tool_resources={"file_search": {"vector_store_ids": [vs_id]}},
        )
        self.threads[thread.id] = {
            "assistant_id": assistant_id,
            # "messages": [{"role": "user", "content": init_message}],
        }
        return thread.id

    def AddMessage(self, thread_id, new_message):
        if thread_id not in self.threads:
            raise ValueError("❌ Invalid thread_id")
        self.threads[thread_id]["messages"].append({"role": "user", "content": new_message})

    class EventHandler(AssistantEventHandler):
        def set_client(self, client):
            self.client = client
            
        @override
        def on_text_created(self, text) -> None:
            print(f"\nassistant > {text}", end="", flush=True)

        @override
        def on_tool_call_created(self, tool_call):
            print(f"\nassistant > {tool_call.type}\n", flush=True)

        @override
        def on_message_done(self, message) -> None:
            message_content = message.content[0].text
            annotations = message_content.annotations
            citations = []
            for index, annotation in enumerate(annotations):
                message_content.value = message_content.value.replace(
                    annotation.text, f"[{index}]"
                )
                if file_citation := getattr(annotation, "file_citation", None):
                    cited_file = self.client.files.retrieve(file_citation.file_id)
                    citations.append(f"[{index}] {cited_file.filename}")

            print(message_content.value)
            print("\n".join(citations))

    def RunThread(self, thread_id):
        if thread_id not in self.threads:
            raise ValueError("❌ Invalid thread_id")

        assistant_id = self.threads[thread_id]["assistant_id"]

        evh = self.EventHandler()
        evh.set_client(self.client)
        def run():
            with self.client.beta.threads.runs.stream(
                thread_id=thread_id,
                assistant_id=assistant_id,
                event_handler=evh,  # Pass the client
            ) as stream:
                stream.until_done()

        thread = threading.Thread(target=run, daemon=False)
        thread.start()


if __name__ == "__main__":
    import time

    # Initialize the OpenAI service
    openai_service = OpenAIService()

    # Define your assistant ID and vector store ID (replace these with your actual IDs)
    assistant_id = "asst_QAA9ERdqNke90WjtS9iN0PI7"
    vs_id = "vs_lgrVwcW8AAbOX3QCFzySgWXC"

    # Initialize a new thread with an initial message
    thread_id = openai_service.InitializeThread(
        assistant_id, 
        vs_id, 
        "What are the qeustions in Homework 1?"
    )
    print(f"✅ Thread initialized with ID: {thread_id}")

    # Add another message to the same thread
    openai_service.AddMessage(thread_id, "Can you summarize each topic in 5 words?")
    print("✅ Message added to thread.")

    # Run the thread (this will stream responses in a separate thread)
    print("🚀 Running thread (responses will stream asynchronously)...")
    openai_service.RunThread(thread_id)

# Since `RunThread` is non-blocking, we can do other tasks here.
# Just an example: simulate waiting for responses
# print("✅ Done! You can continue using the thread.")
