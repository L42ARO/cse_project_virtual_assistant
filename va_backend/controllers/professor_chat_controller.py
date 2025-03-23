import uuid
import os
from flask import Blueprint, request
from flask_socketio import SocketIO
from pydantic import ValidationError
from models.new_course_req import NewCourseReq
from datetime import datetime, timezone
from utils.utils import http_response

# Create a Blueprint
socketio = None
bp = Blueprint("professor_chat_controller", __name__)
prefix = "/pcc"


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
            course_request = NewCourseReq(**data)
        except ValidationError as e:
            return http_response("Invalid request data", 400, error=str(e))

        # Generate a new course_id (UUID for now)
        course_id = str(uuid.uuid4())

        timestamp = datetime.now(timezone.utc).isoformat()

        # Emit WebSocket events
        socketio.emit("ws_user_res", {"message": course_request.initial_message, "timestamp": timestamp})
        socketio.emit("ws_ai_res", {"message": "Hi please tell me more about my role as your assistant for CDA3103, Feel free to provide more instructions on the specific questions I should answer, or upload more class materials", "timestamp": timestamp})

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

        return http_response("File uploaded successfully", 200, data={"file_id": file_id})
    except Exception as e:
        return http_response("Internal server error", 500, error=str(e))



def register_socketio_events(_socketio: SocketIO):
    """Registers WebSocket event handlers."""
    global socketio
    socketio = _socketio
