import uuid
import os
from flask import Blueprint, request
from flask_socketio import SocketIO
from pydantic import ValidationError
from models.pcc_course_new_req import *
from models.pcc_chat_cont_req import *
from datetime import datetime, timezone
from utils.utils import http_response
from dotenv import load_dotenv
from services.openai_service import *


# Create a Blueprint
socketio = None
bp = Blueprint("professor_chat_controller", __name__)
prefix = "/pcc"

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY_1")

if not api_key:
    raise ValueError("❌ API key not found! Check your .env file.")

endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")
if not endpoint:
    raise ValueError("❌ ENDPOINT not found! Check your .env file.")

client = AzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2024-05-01-preview",
)

# Replace with the actual vector store ID you want to update
vector_store_id = "vs_vHqsM3doZ4TqM8RYAAuUpLUe"


@bp.route(f"{prefix}/new-course", methods=["POST"])
def new_course():
    """Creates a new course and sends initial WebSocket messages."""
    try:
        # Handle invalid JSON
        data = request.get_json(silent=True)
        if data is None:
            return http_response("Invalid request data", 400, error="Malformed JSON")

        # Validate input with Pydantic
        try:
            course_request = pccCourseNewReq(**data)
        except ValidationError as e:
            return http_response("Invalid request data", 400, error=str(e))

        # Generate a new course_id (UUID for now)
        course_id = str(uuid.uuid4())

        timestamp = datetime.now(timezone.utc).isoformat()

        # Emit WebSocket events
        socketio.emit("ws_pcc_user_res", {"message": course_request.initial_message, "timestamp": timestamp})
        socketio.emit("ws_pcc_ai_res", {"message": "Hi please tell me more about my role as your assistant for CDA3103, Feel free to provide more instructions on the specific questions I should answer, or upload more class materials", "timestamp": timestamp})

        return http_response("Course created successfully", 200, data={"course_id": course_id})

    except Exception as e:
        return http_response("Internal server error", 500, error=str(e))



@bp.route(f"{prefix}/upload-file", methods=["POST"])
def upload_file():
    """Handles file uploads and returns a randomly generated file ID."""
    try:
        print("Request received:", request.files, request.form)  # Debugging

        if "file" not in request.files:
            return http_response("Invalid request data", 400, error="No file provided")

        file = request.files["file"]
        course_id = request.form.get("course_id")

        if not course_id:
            return http_response("Invalid request data", 400, error="Missing course_id")

        if file.filename == "":
            return http_response("Invalid request data", 400, error="Empty file name")

        # Ensure the uploads directory exists
        upload_dir = "./uploads"
        os.makedirs(upload_dir, exist_ok=True)  # Creates if it doesn't exist

        # Generate a mock Cloud File ID
        file_id = str(uuid.uuid4())

        # Save the file
        file_path = os.path.join(upload_dir, f"{file_id}_{file.filename}")
        file.save(file_path)

        # Update the vector store with the uploaded file
        file_streams = [open(file_path, "rb")]
        file_batch = client.beta.vector_stores.file_batches.upload_and_poll(
            vector_store_id=vector_store_id, files=file_streams
        )

        print(f"Updated Vector Store ID: {vector_store_id}")
        print("Upload Status:", file_batch.status)
        print("File Counts:", file_batch.file_counts)

        return http_response("File uploaded successfully", 200, data={"file_id": file_id})
    except Exception as e:
        return http_response("Internal server error", 500, error=str(e))



def register_socketio_events(_socketio: SocketIO):
    """Registers WebSocket event handlers."""
    global socketio
    socketio = _socketio

    @socketio.on("ws_pcc_chat_req")
    def handle_student_msg_req(data):
        chat_request = pccChatContReq(**data)
        message = chat_request.message #data.get("message", "")
        session_id = chat_request.session_id #data.get("session_id", "") #get the session id for data
        # call the openai service and have it reply 

        timestamp = datetime.now(timezone.utc).isoformat()  # UTC timestamp in ISO format
        socketio.emit("ws_pcc_user_res", {"message": message, "timestamp": timestamp})
        try:
            ai_response = add_message(user_id=session_id, user_message=message)
        except:
            ai_response = "Professor Azure is Down sorry!"

        socketio.emit("ws_pcc_ai_res", {"message": ai_response, "timestamp": timestamp})
