from flask import Blueprint, request
from flask_socketio import SocketIO
from pydantic import ValidationError
from werkzeug.exceptions import BadRequest
from models.scc_chat_start_req import *
from models.scc_chat_cont_req import *
import uuid
from datetime import datetime, timezone
from utils.utils import *
from services.openai_service import OpenAIService
from services.session_logging_service import *
from services.question_logging_service import QuestionLoggingService


# Create a Blueprint
socketio = None
bp = Blueprint("student_chat_controller", __name__)
prefix = "/scc"

openai_course_assistants ={
    "CAP6317":["asst_En49aHCQ2EoTjPpDZNu20TIH","vs_67e32e6c2f7c8191aca9c3497fcbad14"],
    "CDA4213":["asst_0Gad9IJGtpjrrhrtNE6bLCFV","vs_67e553465eb48191a316b7881d3db29c"]
}

openAiService = OpenAIService()
sessionsService = SessionLoggingService()
questionLogger = QuestionLoggingService()

stored_sessions = sessionsService.get_sessions()
sessions = {
    session["session_id"]: {
        "thread_id": session["thread_id"],
        "username": session["username"],
        "course_id": session["course_id"]
    }
    for session in stored_sessions
}
# azureAiService = OpenAIService("AZURE_OPENAI_API_KEY_1", "AZURE_OPENAI_API_ENDPOINT")

@bp.route(f"{prefix}/chat-history-search", methods=["POST"])
def search_chat_history():
    try:
        data = request.get_json()
        token = data.get("token")
        search_query = data.get("search_query")
        if not token or not search_query:
            return http_response("Missing token or search query", 400)

        username = decode_token(token)
        if not username:
            return http_response("Unauthorized", 401, "Invalid or expired token")

        # Search through the sessions for matching text
        matching_sessions = []
        for session_id, session_data in sessions.items():
            # Retrieve messages for each session and filter based on the search query
            history = openAiService.get_thread_messages(session_data["thread_id"])
            filtered_history = [msg for msg in history if search_query.lower() in msg["message"].lower()]

            if filtered_history:
                matching_sessions.append({
                    "session_id": session_id,
                    "course_id": session_data["course_id"],
                    "thread_id": session_data["thread_id"],
                    "messages": filtered_history
                })
        print(matching_sessions)
        return http_response("Search completed successfully", 200, data=matching_sessions)

    except Exception as e:
        return http_response("Internal server error", 500, error=str(e))


@bp.route(f"{prefix}/sessions-get", methods=["POST"])
def get_sessions():
    try:
        data = request.get_json()
        if not data or "token" not in data:
            raise BadRequest("Missing token")

        token = data["token"]
        username = decode_token(token)
        if not username:
            return http_response(
                message="Unauthorized",
                status=401,
                error="Invalid or expired token"
            )

        course_id = data.get("course_id", None)

        sessions_data = sessionsService.get_sessions(course_id=course_id, username=username)

        return http_response(
            message="Sessions retrieved successfully",
            status=200,
            data=sessions_data
        )
    except Exception as e:
        return http_response(
            message="Failed to retrieve sessions",
            status=500,
            error=str(e)
        )



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
        username = decode_token(token)
        if username is None:
            return http_response(
                message="Unauthorized",
                status=503,
                error="No username, token probably expired"
            )


        # --- Log the initial student question ---
        try:
            questionLogger.log_question(
                course_id=course_id,
                session_id=session_id,
                question_text=message
            )
        except Exception as log_e:
            print(f"⚠️ Failed to log question: {log_e}")

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


        sessions[session_id]={"thread_id":thread_id, "username":username, "course_id":course_id}
        sessionsService.log_session(session_id, thread_id, username, course_id)
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

@bp.route(f"{prefix}/session-messages-get", methods=["POST"])
def get_chat_history():
    try:
        data = request.get_json()
        token = data.get("token")
        thread_id = data.get("thread_id")

        username = decode_token(token)
        if not username:
            return http_response("Unauthorized", 401, "Invalid or expired token")

        if not thread_id:
            return http_response("Missing thread_id", 400)

        history = openAiService.get_thread_messages(thread_id)
        return http_response("Chat history retrieved", 200, data=history)
    except Exception as e:
        return http_response("Internal server error", 500, error=str(e))


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
            thread_id = session["thread_id"]
            course_id = session["course_id"]

            if thread_id == "000":
                raise ValueError("Session failed to initialize.")

            assistant_id = openai_course_assistants[course_id][0]
            if assistant_id is None:
                raise ValueError("Assistant not available for this course.")

            # Log question
            try:
                # Make sure username and course_id were retrieved successfully
                if course_id and session_id:
                     questionLogger.log_question(
                         course_id=course_id,
                         session_id=session_id,
                         question_text=message
                     )
                else:
                     print("⚠️ Skipping question log due to missing data (user/course/session).")
            except Exception as log_e:
                print(f"⚠️ Failed to log question: {log_e}")

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

