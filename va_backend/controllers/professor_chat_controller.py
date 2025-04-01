import uuid
import os
from flask import Blueprint, request
from flask_socketio import SocketIO
from pydantic import ValidationError
from models.pcc_course_new_req import *
from models.pcc_chat_cont_req import *
from models.pcc_chat_start_req import *
from models.pcc_chat_intro_req import *
from datetime import datetime, timezone
from werkzeug.exceptions import BadRequest
from utils.utils import *
from dotenv import load_dotenv
from services.openai_service import *


# Create a Blueprint
socketio = None
bp = Blueprint("professor_chat_controller", __name__)
prefix = "/pcc"

load_dotenv()
api_key = os.getenv("AZURE_OPENAI_API_KEY_1")

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

openai_course_assistants ={
    "CAP6317":["asst_En49aHCQ2EoTjPpDZNu20TIH","vs_67e32e6c2f7c8191aca9c3497fcbad14"],
    "CDA4213":["asst_0Gad9IJGtpjrrhrtNE6bLCFV","vs_67e553465eb48191a316b7881d3db29c"]
}

openAiService = OpenAIService(user_role="professor")
sessions = {}

@bp.route(f'{prefix}/chat-intro', methods=["POST"])
def chat_intro():
    try:
        data = request.get_json()
        if data is None:
            raise BadRequest

        intro_request = pccChatIntroReq(**data)  # Validates input automatically
        course_id = intro_request.course_id
        token = intro_request.token

        if openai_course_assistants.get(course_id) is None:
            raise BadRequest

        
        assistant_id=openai_course_assistants[course_id][0]
        instructions = openAiService.get_assistant_instructions(assistant_id)

        username = decode_token(token)
        username = username if username is not None else ""

        message = f"Hello professor {username}. Here is my current configuration:\n{instructions}"
        timestamp = datetime.now(timezone.utc).isoformat()  # UTC timestamp in ISO format
        socketio.emit("ws_pcc_ai_res", {"message": message, "timestamp": timestamp})

        return http_response(
            message="Chat started successfully",
            status=200
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

@bp.route(f'{prefix}/chat-start', methods=["POST"])
def chat_start():
    global sessions
    try:
        data = request.get_json()
        if data is None:
            raise BadRequest

        chat_request = pccChatStartReq(**data)  # Validates input automatically
        message = chat_request.initial_message
        timestamp = datetime.now(timezone.utc).isoformat()  # UTC timestamp in ISO format
        socketio.emit("ws_pcc_user_res", {"message": message, "timestamp": timestamp})


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
        
        if openai_course_assistants.get(course_id) is None:
            raise BadRequest



        assistant_id=openai_course_assistants[course_id][0]
        vs_id=openai_course_assistants[course_id][1]


        # Emit user message to WebSocket
        thread_id = "000"
        initFailed = False
        # Call OpenAI service to get AI response
        try:
            socketio.emit("ws_pcc_ai_stdby", {
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            thread = openAiService.create_thread(vs_id)
            thread_id = thread.id
            message = "I am the instructor. " + message
            openAiService.add_message(thread_id, message)

            run = openAiService.run_thread(thread_id, assistant_id)
            print("L42: Waiting for run to complete")
            openAiService.wait_for_run(thread_id, run.id, assistant_id, course_id=course_id)
            print("L42: Run complete")
            ai_response = openAiService.get_latest_response(thread_id, run_id=run.id, assistant_id=assistant_id)

        except Exception as e:
            ai_response = "AI Service is down"
            initFailed = True
            initFailedMessage = str(e)


        sessions[session_id]={"thread_id":thread_id, "username":token, "course_id":course_id}
        # Emit AI response to WebSocket

        timestamp = datetime.now(timezone.utc).isoformat()  # UTC timestamp in ISO format
        socketio.emit("ws_pcc_ai_res", {"message": ai_response, "timestamp": timestamp})

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

    @socketio.on("ws_pcc_chat_cont")
    def handle_pcc_chat_cont(data):
        try:
            chat_request = pccChatContReq(**data)
            message = chat_request.message
            session_id = chat_request.session_id
            user_token = chat_request.token
        except Exception as e:
            return socketio.emit("ws_pcc_ai_res", {
                "message": f"Invalid request format.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "failed": True,
                "details": str(e)
            })

        # ✅ Always echo the user message back
        socketio.emit("ws_pcc_user_res", {
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
            socketio.emit("ws_pcc_ai_stdby", {
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            # ✅ AI logic
            message = "I am the instructor. " + message
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
        socketio.emit("ws_pcc_ai_res", {
            "message": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": details,
            "failed": failed,
        })


