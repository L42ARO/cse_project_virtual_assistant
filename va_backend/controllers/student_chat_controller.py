from flask import Blueprint, request
from flask_socketio import SocketIO
from pydantic import ValidationError
from werkzeug.exceptions import BadRequest
from models.start_chat_req import *
import uuid
from datetime import datetime, timezone
from utils.utils import *
from services.openai_service import add_message  # Import the OpenAI service

# Create a Blueprint
socketio = None
bp = Blueprint("student_chat_controller", __name__)
prefix = "/scc"
sessions = []

@bp.route(f'{prefix}/start-chat', methods=["POST"])
def start_chat():
    try:
        data = request.get_json()
        if data is None:
            raise BadRequest

        chat_request = StartChatReq(**data)  # Validates input automatically

        session_id = str(uuid.uuid4())  # Generate UUID for session

        # TODO: Store this session ID in database related to the UserID and CourseID

        timestamp = datetime.now(timezone.utc).isoformat()  # UTC timestamp in ISO format

        # Emit user message to WebSocket
        socketio.emit("ws_user_res", {"message": chat_request.initial_message, "timestamp": timestamp})

        # Call OpenAI service to get AI response
        ai_response = add_message(user_id=session_id, user_message=chat_request.initial_message)

        # Emit AI response to WebSocket
        socketio.emit("ws_ai_res", {"message": ai_response, "timestamp": timestamp})

        return http_response(
            message="Chat started successfully",
            status=200,
            data={"session_id": session_id}
        )
    except ValidationError as e:
        return http_response(
            message="Invalid request data",
            status=400,
            error=e.errors()
        )
    except BadRequest:
        return http_response(
            message="Invalid request data",
            status=400,
        )
    except Exception as e:
        return http_response(
            message="Internal server error",
            status=500,
            error=str(e)
        )

def register_socketio_events(_socketio: SocketIO):
    """Registers WebSocket event handlers."""
    global socketio
    socketio = _socketio
    
    @socketio.on("student_chat_msg")
    def handle_student_msg_req(data):
        message = data.get("message", "")
        session_id = data.get("session_id", "") #get the session id for data
        # call the openai service and have it reply 

        timestamp = datetime.now(timezone.utc).isoformat()  # UTC timestamp in ISO format
        socketio.emit("ws_user_res", {"message": message, "timestamp": timestamp})
        ai_response = add_message(user_id=session_id, user_message=message)
        socketio.emit("ws_ai_res", {"message": ai_response, "timestamp": timestamp})
