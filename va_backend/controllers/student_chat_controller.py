from flask import Blueprint, request
from flask_socketio import SocketIO
from pydantic import ValidationError
from werkzeug.exceptions import BadRequest
from models.scc_chat_start_req import *
from models.scc_chat_cont_req import *
import uuid
from datetime import datetime, timezone
from utils.utils import *
from services.openai_service import OpenAIService  # Import the OpenAI service

# Create a Blueprint
socketio = None
bp = Blueprint("student_chat_controller", __name__)
prefix = "/scc"

openai_course_assistants ={
    "CAP6317":["asst_En49aHCQ2EoTjPpDZNu20TIH","vs_67e32e6c2f7c8191aca9c3497fcbad14"],
    "CDA4213":["asst_xRwMoWY4BRyaRWx6Xyr0BInY","vs_67e553465eb48191a316b7881d3db29c"]
}

openAiService = OpenAIService()
sessions = {}
# azureAiService = OpenAIService("AZURE_OPENAI_API_KEY_1", "AZURE_OPENAI_API_ENDPOINT")


@bp.route(f'{prefix}/chat-start', methods=["POST"])
def chat_start():
    global sessions
    try:
        data = request.get_json()
        if data is None:
            raise BadRequest

        chat_request = sccChatStartReq(**data)  # Validates input automatically
        message = chat_request.initial_message
        timestamp = datetime.now(timezone.utc).isoformat()  # UTC timestamp in ISO format
        socketio.emit("ws_scc_user_res", {"message": message, "timestamp": timestamp})


        session_id = str(uuid.uuid4())  # Generate UUID for session
        course_id = chat_request.course_id
        token = chat_request.token

        
        if openai_course_assistants.get(course_id) is None:
            raise BadRequest



        assistant_id=openai_course_assistants[course_id][0]
        vs_id=openai_course_assistants[course_id][1]


        # Emit user message to WebSocket
        thread_id = "000"
        initFailed = False
        # Call OpenAI service to get AI response
        try:
            socketio.emit("ws_scc_ai_stdby", {
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            thread = openAiService.create_thread(vs_id)
            thread_id = thread.id
            message = f"I am a student. {message}. Again this is a student message, not the professor. Remember you have access to the class files."
            openAiService.add_message(thread_id, message)
            run = openAiService.run_thread(thread_id, assistant_id)
            openAiService.wait_for_run(thread_id, run.id, assistant_id, course_id)
            ai_response = openAiService.get_latest_response(thread_id)
        except Exception as e:
            ai_response = "AI Service is down"
            initFailed = True
            initFailedMessage = str(e)


        sessions[session_id]={"thread":thread_id, "user_token":token, "course_id":course_id}
        # Emit AI response to WebSocket

        timestamp = datetime.now(timezone.utc).isoformat()  # UTC timestamp in ISO format
        socketio.emit("ws_scc_ai_res", {"message": ai_response, "timestamp": timestamp})

        if initFailed:
            return http_response(
                message=initFailedMessage,
                status=400,
                data={"session_id": session_id}
            )

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
    
    @socketio.on("ws_scc_chat_cont")
    def handle_scc_chat_cont(data):
        try:
            chat_request = sccChatContReq(**data)
            message = chat_request.message
            session_id = chat_request.session_id
            user_token = chat_request.token
        except Exception as e:
            return socketio.emit("ws_scc_ai_res", {
                "message": f"Invalid request format.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "failed": True,
                "details": str(e)
            })

        # ✅ Always echo the user message back
        socketio.emit("ws_scc_user_res", {
            "message": chat_request.message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        details=""
        failed = False
        try:
            session = sessions[session_id]
            thread_id = session["thread"]
            course_id = session["course_id"]

            if thread_id == "000":
                raise ValueError("Session failed to initialize.")

            assistant_id = openai_course_assistants[course_id][0]
            if assistant_id is None:
                raise ValueError("Assistant not available for this course.")
            socketio.emit("ws_scc_ai_stdby", {
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            # ✅ AI logic
            message = f"I am a student. {message}. Again this is a student message, not the professor. Remember you have access to the class files."
            openAiService.add_message(thread_id, message)
            run = openAiService.run_thread(thread_id, assistant_id)
            openAiService.wait_for_run(thread_id, run.id, assistant_id, course_id)
            ai_response = openAiService.get_latest_response(thread_id)

        except KeyError as e:
            ai_response = f"Invalid session data."
            details = str(e)
            failed = True
        except ValueError as e:
            ai_response = "Invalid session data"
            details = str(e)
            failed = True
        except Exception as e:
            ai_response = f"AI Service is Down, sorry!"
            details = str(e)
            failed = True

        # ✅ Always emit AI response
        socketio.emit("ws_scc_ai_res", {
            "message": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": details,
            "failed": failed,
        })

