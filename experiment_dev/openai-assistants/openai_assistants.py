import openai
import os
import time
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

# === Step 1: Upload files and create a Vector Store ===
def upload_files_to_vector_store(folder_path):
    # Create a vector store
    vector_store = openai.beta.vector_stores.create(name="Class Files Store")

    file_ids = []
    for filename in os.listdir(folder_path):
        full_path = os.path.join(folder_path, filename)
        if os.path.isfile(full_path):
            with open(full_path, "rb") as f:
                uploaded = openai.files.create(file=f, purpose="assistants")
                print(f"Uploaded {filename} -> {uploaded.id}")
                file_ids.append(uploaded.id)

    # Link files to the vector store
    openai.beta.vector_stores.file_batches.create(
        vector_store_id=vector_store.id,
        file_ids=file_ids
    )

    return vector_store.id

# === Step 2: Create the Assistant with file_search tool ===
def create_assistant_with_vector(vector_store_id):
    assistant = openai.beta.assistants.create(
        name="usf-ta-001",
        instructions="""
You are a Teaching Assistant (TA) designed to help students with their coursework. 
You provide accurate, clear, and relevant information about past, current, and upcoming course topics, schedules, deadlines, lectures, and presentations. 
Your goal is to support students in understanding course material and staying on track with their academic responsibilities.

Limitations:
- If course materials, schedules, or deadlines are not available, politely inform the student and suggest checking with the instructor.
- Never provide direct solutions to assignments.
- Offer explanations and relevant concepts.
- Point students to the right resources to solve problems.
- Never provide sample code that solves assignment questions.
""",
        model="gpt-4o-mini",
        tools=[{"type": "file_search"}],
        tool_resources={
            "file_search": {
                "vector_store_ids": [vector_store_id]
            }
        }
    )
    return assistant.id

# === Step 3: Create a thread and ask a question ===
def ask_question(assistant_id, question):
    thread = openai.beta.threads.create()

    openai.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=question
    )

    run = openai.beta.threads.runs.create(
        thread_id=thread.id,
        assistant_id=assistant_id
    )

    print("Waiting for assistant to respond...")
    while True:
        status = openai.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)
        if status.status == "completed":
            break
        elif status.status in ["failed", "cancelled", "expired"]:
            print("Run failed.")
            return
        time.sleep(1)

    messages = openai.beta.threads.messages.list(thread_id=thread.id)
    for msg in reversed(messages.data):
        if msg.role == "assistant":
            print("\n--- Assistant Response ---\n")
            print(msg.content[0].text.value)
            print("\n--------------------------\n")
            break

# === Run Everything ===
if __name__ == "__main__":
    folder_path = "class_files"
    vector_store_id = upload_files_to_vector_store(folder_path)
    assistant_id = create_assistant_with_vector(vector_store_id)
    ask_question(assistant_id, "Can you summarize the important upcoming deadlines?")

