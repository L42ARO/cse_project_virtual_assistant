import traceback
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
from services.question_logging_service import QuestionLoggingService


# Create a Blueprint
socketio = None
bp = Blueprint("professor_chat_controller", __name__)
prefix = "/pcc"

load_dotenv()
api_key = os.getenv("AZURE_OPENAI_API_KEY_1")

if not api_key:
    raise ValueError("API key not found! Check your .env file.")

endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")
if not endpoint:
    raise ValueError("ENDPOINT not found! Check your .env file.")

client = AzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2024-05-01-preview",
)

# Replace with the actual vector store ID you want to update
vector_store_id = "vs_67e32e6c2f7c8191aca9c3497fcbad14"

openai_course_assistants ={
    "CAP6317":["asst_En49aHCQ2EoTjPpDZNu20TIH","vs_67e32e6c2f7c8191aca9c3497fcbad14"],
    "CDA4213":["asst_0Gad9IJGtpjrrhrtNE6bLCFV","vs_67e553465eb48191a316b7881d3db29c"]
}

openAiService = OpenAIService(user_role="professor")
questionReader = QuestionLoggingService() # Instantiate for reading insights
sessions = {}

@bp.route(f"{prefix}/question-insights", methods=["POST"])
def get_question_insights():
    try:
        data = request.get_json()
        course_id = data.get("course_id")

        if not course_id:
            return http_response("Missing course_id", 400)

        # Fetch insights using the new service
        insights = questionReader.get_weekly_insights(course_id)
        print(insights)

        return http_response(
            message="Weekly question insights retrieved successfully",
            status=200,
            data=insights # Return the insights data
        )
    except BadRequest:
         return http_response("Invalid request data format (must be JSON)", 400)
    except Exception as e:
        print(f"Error fetching question insights for {course_id}: {e}")
        # import traceback
        # traceback.print_exc()
        return http_response("Internal server error", 500, error=str(e))

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
    """Handles file uploads using OpenAIService functions and returns the file ID."""
    try:
        print("Request received:", request.files, request.form)

        if "file" not in request.files:
            return http_response("Invalid request data", 400, error="No file provided")

        file = request.files["file"]
        course_id = request.form.get("course_id")

        if not course_id:
            return http_response("Invalid request data", 400, error="Missing course_id")

        if course_id not in openai_course_assistants:
            return http_response("Invalid request data", 400, error="Unknown course_id")

        if file.filename == "":
            return http_response("Invalid request data", 400, error="Empty file name")

        # Ensure the file has a valid name and extension
        filename = file.filename
        name, ext = os.path.splitext(filename)
        if not ext:
            ext = ".txt"  # Default to .txt if no extension
            filename = f"{filename}{ext}"

        allowed_exts = {
            ".c", ".cs", ".cpp", ".doc", ".docx", ".html", ".java", ".json",
            ".md", ".pdf", ".php", ".pptx", ".py", ".rb", ".tex", ".txt",
            ".css", ".js", ".sh", ".ts"
        }
        if ext.lower() not in allowed_exts:
            return http_response("Unsupported file type", 400, error=f"Extension {ext} not supported.")

        vector_store_id = openai_course_assistants[course_id][1]

        # Pass the file as a tuple (filename, stream, content_type) if needed
        file_response = openAiService.add_file((filename, file.stream, file.content_type or "application/octet-stream"))
        file_id = file_response.id

        vector_response = openAiService.add_file_to_vector_store(file_id, vector_store_id)

        print(f"Updated Vector Store ID: {vector_store_id}")
        print("Upload Status:", getattr(vector_response, "status", "unknown"))
        print("File Counts:", getattr(vector_response, "file_counts", {}))

        return http_response("File uploaded successfully", 200, data={"file_id": file_id})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return http_response("Internal server error", 500, error=str(e))

@bp.route(f"{prefix}/course-materials", methods=["GET"])
def get_course_materials():
    """Fetch all uploaded course materials for a given course."""
    try:
        # Read only from query string
        course_id = request.args.get("course_id")

        if not course_id:
            return http_response("Missing course_id", 400)


        if course_id not in openai_course_assistants:
            return http_response("Unknown course_id", 400, error="Course not found")

        vs_id = openai_course_assistants[course_id][1]

        # Use the official client and grab the 'data' list
        vec_files  = openAiService.client.vector_stores.files.list(vector_store_id=vs_id) # this is the list of file-objects
        materials = []
        # 2) for each, retrieve the actual file metadata to get its filename
        for item in vec_files:
            file_meta = openAiService.client.files.retrieve(file_id=item.id)
            materials.append({
                "fileId": item.id,
                "fileName": file_meta.filename
            })

        return http_response(
            message="Course materials retrieved successfully",
            status=200,
            data=materials
        )

    except Exception as e:
        traceback.print_exc()
        return http_response("Internal server error", 500, error=str(e))


@bp.route(f"{prefix}/course-materials", methods=["DELETE"])
def delete_course_material():
    """Delete a specific file from the course’s vector store."""
    try:
        course_id = request.args.get("course_id")
        file_id   = request.args.get("file_id")
        if not course_id or not file_id:
            return http_response("Missing course_id, file_id or token", 400)

        if course_id not in openai_course_assistants:
            return http_response("Unknown course_id", 400, error="Course not found")

        vs_id = openai_course_assistants[course_id][1]
        print(vs_id)

        # Delete the file association from the vector store
        deleted_vs_file = openAiService.client.vector_stores.files.delete(
            vector_store_id=vs_id,
            file_id=file_id
        )
        if deleted_vs_file.deleted:
            print(f"Successfully removed file {file_id} from vector store {vs_id}.")
            # Optionally, delete the file object itself from OpenAI to free up storage
            # Be cautious with this if the file might be used elsewhere.
            deleted_file = openAiService.client.files.delete(file_id=file_id)
            if deleted_file.deleted:
                print(f"Successfully deleted file object {file_id} from OpenAI.")
            else:
                print(
                    f"Warning: Failed to delete file object {file_id} from OpenAI after removing from vector store.")

        return http_response(
            message="File deleted successfully",
            status=200
        )
    except Exception as e:
        return http_response("Internal server error", 500, error=str(e))


@bp.route(f"{prefix}/ai-settings", methods=["GET"])
def get_ai_settings():
    """Fetch the base AI instructions for a given course’s assistant."""
    try:
        # 1) Read course_id directly from the query string
        course_id = request.args.get("course_id")
        if not course_id:
            return http_response("Missing course_id", 400)

        # 2) Validate you have an assistant for that course
        if course_id not in openai_course_assistants:
            return http_response("Unknown course_id", 400, error="Course not found")

        # 3) Retrieve via the standard client.assistants API
        assistant_id = openai_course_assistants[course_id][0]
        assistant = openAiService.client.beta.assistants.retrieve(assistant_id)
        instructions = assistant.instructions

        # 4) Return JSON via your helper
        return http_response(
            "AI settings retrieved successfully",
            200,
            data={"instructions": instructions}
        )
    except Exception as e:
        # print full traceback to your console so you can see the real error
        import traceback; traceback.print_exc()
        return http_response("Internal server error", 500, error=str(e))


from flask import request, jsonify
from werkzeug.exceptions import BadRequest
from pydantic import ValidationError

@bp.route(f"{prefix}/ai-settings", methods=["PUT"])
def update_ai_settings():
    """Update the base AI instructions for a given course’s assistant."""
    try:
        payload = request.get_json(force=True)
        course_id   = payload.get("course_id")
        instructions = payload.get("instructions")

        if not course_id or instructions is None:
            # missing one of the required fields
            return http_response("Invalid request data", 400, error="Both 'course_id' and 'instructions' are required")

        if course_id not in openai_course_assistants:
            return http_response("Unknown course_id", 400, error="Course not found")

        assistant_id = openai_course_assistants[course_id][0]

        openAiService.client.beta.assistants.update(
            assistant_id=assistant_id,
            instructions=instructions
        )
        print(f"Successfully updated instructions for assistant {assistant_id}")

        return http_response(
            "AI settings updated successfully",
            200,
            data=True
        )

    except BadRequest:
        # malformed JSON
        return http_response("Invalid request data", 400, error="Malformed JSON")

    except Exception as e:
        traceback.print_exc()
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


