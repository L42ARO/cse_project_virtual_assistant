import json
import os
from openai_service import OpenAIService  # Your class module

# Temporary in-memory or JSON file state
STATE_FILE = "test_state.json"

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    return {}

def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

# === Simulate a Professor creating a course assistant ===
def setup_course(service, state, course_id):
    print(f"Setting up course assistant for: {course_id}")
    if course_id in state:
        print("Assistant already exists.")
        return state

    # Create vector store
    vector_store = service.client.beta.vector_stores.create(name=f"{course_id}_vector_store")
    vector_store_id = vector_store.id

    # Create assistant
    assistant_id = service.create_assistant(
        name=f"{course_id} Assistant",
        instructions="You are a course TA. Help students with questions about this class.",
        model="gpt-4-1106-preview",
        vector_store_id=vector_store_id
    )

    state[course_id] = {
        "assistant_id": assistant_id,
        "vector_store_id": vector_store_id,
        "threads": {}
    }

    print(f"✅ Assistant created: {assistant_id}")
    return state

# === Simulate professor uploading a file ===
def upload_course_file(service, state, course_id, filepath):
    print(f"Uploading file: {filepath}")
    with open(filepath, "rb") as f:
        file = service.add_file(f)

    service.client.beta.vector_stores.file_batches.create(
        vector_store_id=state[course_id]["vector_store_id"],
        file_ids=[file.id]
    )
    print(f"✅ File {file.filename} added to vector store.")

# === Simulate student asking a question ===
def student_asks_question(service, state, course_id, student_id, question):
    print(f"\n👩‍🎓 Student {student_id} asks: {question}")
    assistant_id = state[course_id]["assistant_id"]
    vector_store_id = state[course_id]["vector_store_id"]

    # Create thread if missing
    threads = state[course_id].get("threads", {})
    thread_id = threads.get(student_id)

    if not thread_id:
        thread = service.create_thread(vector_store_id)
        thread_id = thread.id
        state[course_id]["threads"][student_id] = thread_id
        print(f"🧵 New thread created: {thread_id}")
    else:
        print(f"🧵 Using existing thread: {thread_id}")

    # Add message
    service.add_message(thread_id, question)

    # Run the assistant
    run = service.run_thread(thread_id, assistant_id)
    service.wait_for_run(thread_id, run.id)
    response = service.get_latest_response(thread_id)

    print(f"\n🤖 Assistant says:\n{response}")
    return state

# === MAIN TEST RUN ===
if __name__ == "__main__":
    service = OpenAIService()  # Or pass Azure info here
    state = load_state()

    course_id = "CSE101"
    professor_id = "prof_01"
    student_id = "student_42"

    state = setup_course(service, state, course_id)

    # Only upload once
    if "file_uploaded" not in state[course_id]:
        upload_course_file(service, state, course_id, "Syllabus CAP 4773_6317 Social Media Mining.docx")
        state[course_id]["file_uploaded"] = True

    state = student_asks_question(service, state, course_id, student_id, "What topics will be on the first exam?")

    save_state(state)
