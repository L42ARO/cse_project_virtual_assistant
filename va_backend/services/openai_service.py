from openai import OpenAI, AzureOpenAI
import json
import os
import time
from dotenv import load_dotenv

from services.flagging_service import FlaggingService

fs = FlaggingService()

load_dotenv()

class OpenAIService:
    def __init__(
        self,
        api_key_env="OPENAI_API_KEY",
        endpoint=None,
        deployment_id=None,
        api_version="gpt-4o-mini",
        user_role="student"  # Default to student
    ):
        self.user_role = user_role
        self.api_key = os.getenv(api_key_env)
        if not self.api_key:
            raise ValueError(f"API key not found in env var: {api_key_env}")

        self.endpoint = endpoint
        self.is_azure = bool(endpoint)
        self.deployment_id = deployment_id

        if self.is_azure:
            self.client = AzureOpenAI(
                api_key=self.api_key,
                azure_endpoint=endpoint,
                api_version=api_version
            )
        else:
            self.client = OpenAI(api_key=self.api_key)

    # === Assistants ===

    def create_assistant(self, name, instructions, model="gpt-4o-mini", vector_store_id=None):
        tools = []
        tool_resources = {}

        if vector_store_id:
            tools.append({"type": "file_search"})
            tool_resources = {"file_search": {"vector_store_ids": [vector_store_id]}}

        return self.client.beta.assistants.create(
            name=name,
            instructions=instructions,
            model=model,
            tools=tools,
            tool_resources=tool_resources
        ).id

    def update_assistant(self, assistant_id, instructions=None, name=None, model=None):
        payload = {}

        if instructions is not None:
            payload["instructions"] = instructions
        if name is not None:
            payload["name"] = name
        if model is not None:
            payload["model"] = model

        return self.client.beta.assistants.update(assistant_id=assistant_id, **payload)


    # === Vector Store ===

    def create_vector_store(self, name="CourseStore"):
        store = self.client.beta.vector_stores.create(name=name)
        return store.id

    def add_file(self, file_obj):
        return self.client.files.create(file=file_obj, purpose="assistants")

    def add_file_to_vector_store(self, file_id, vector_store_id):
        return self.client.beta.vector_stores.file_batches.create(
            vector_store_id=vector_store_id,
            file_ids=[file_id]
        )

    def remove_file(self, file_id):
        return self.client.files.delete(file_id)

    def list_files_in_vector_store(self, vector_store_id):
        return self.client.beta.vector_stores.files.list(vector_store_id=vector_store_id)


    # === Threads & Messages ===

    def create_thread(self, vector_store_id=None):
        tool_resources = (
            {"file_search": {"vector_store_ids": [vector_store_id]}}
            if vector_store_id else None
        )
        return self.client.beta.threads.create(tool_resources=tool_resources)

    def add_message(self, thread_id, content, file_ids=None):
        message_payload = {
            "thread_id": thread_id,
            "role": "user",
            "content": content
        }
        if file_ids:
            message_payload["attachments"] = [{"file_id": fid, "tools": [{"type": "file_search"}]} for fid in file_ids]

        return self.client.beta.threads.messages.create(**message_payload)


    def run_thread(self, thread_id, assistant_id, stream=False, event_handler=None):
        if stream:
            return self.client.beta.threads.runs.stream(
                thread_id=thread_id,
                assistant_id=assistant_id,
                event_handler=event_handler
            )
        return self.client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id
        )

    def wait_for_run(self, thread_id, run_id, assistant_id=None, course_id=None, poll_interval=1):
        print(f"L42: Waiting for run {run_id} on thread {thread_id}")
    
        while True:
            run = self.client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run_id)
            print(f"L42: Current run status: {run.status}")

            if run.status == "completed":
                print("L42: Run completed")
                return run

            elif run.status == "requires_action":
                print("L42: Run requires action — tool call in progress")

                required_action = run.required_action
                if required_action.type == "submit_tool_outputs":
                    tool_outputs = []

                    for call in required_action.submit_tool_outputs.tool_calls:
                        function_name = call.function.name
                        print(f"L42: Tool call detected: {function_name}")

                        if function_name == "update_instructions":
                            if self.user_role == "professor":
                                args = json.loads(call.function.arguments)
                                new_instructions = args.get("new_instructions")

                                if new_instructions and assistant_id:
                                    self.update_assistant(assistant_id, instructions=new_instructions)
                                    tool_outputs.append({
                                        "tool_call_id": call.id,
                                        "output": f"Instructions updated to: {new_instructions}"
                                    })
                                    print("L42: Success")
                                else:
                                    tool_outputs.append({
                                        "tool_call_id": call.id,
                                        "output": "Missing new_instructions or assistant_id"
                                    })
                                    print("L42: Unsuccessful")
                            else:
                                print("L42: Student tried to call update_instructions — blocked")
                                tool_outputs.append({
                                    "tool_call_id": call.id,
                                    "output": "Unauthorized"
                                })
                        elif function_name == "flag_question_mandatory":
                            args = json.loads(call.function.arguments)
                            reason = args.get("reason")
                            question = args.get("question")

                            print("L42: 🚩 FLAGGED STUDENT QUESTION 🚩")
                            print(f"L42: Reason: {reason}")
                            print(f"L42: Question: {question}")

                            if course_id is not None:
                                flag = fs.log_flagged_question(course_id, question, reason)
                                print(f"L42: Logged flag ID: {flag['id']}")
                            else:
                                print("L42: ⚠️ course_id is None — could not log flag properly")

                            tool_outputs.append({
                                "tool_call_id": call.id,
                                "output": "Flag received and logged"
                            })
                        elif function_name == "flag_question_voluntary":
                            args = json.loads(call.function.arguments)
                            reason = args.get("reason")
                            question = args.get("question")

                            print("L42: 📩 Voluntary question flag submitted")
                            print(f"L42: Reason: {reason}")
                            print(f"L42: Question: {question}")

                            if course_id is not None:
                                flag = fs.log_flagged_question(course_id, question, reason, flag_type="voluntary")
                                print(f"L42: Logged voluntary flag ID: {flag['id']}")
                            else:
                                print("L42: ⚠️ course_id is None — could not log voluntary flag properly")

                            tool_outputs.append({
                                "tool_call_id": call.id,
                                "output": "Voluntary flag received and logged"
                            })
                        elif function_name == "get_flagged_questions":
                            args = json.loads(call.function.arguments)
                            include_seen = args.get("include_seen", False)
                            flag_type = args.get("flag_type", "all")

                            print("L42: 🧑‍🏫 Professor requested flagged questions")
                            print(f"L42: Injected course_id={course_id}, include_seen={include_seen}, flag_type={flag_type}")

                            if self.user_role != "professor":
                                print("L42: ❌ Unauthorized flag query by non-professor")
                                tool_outputs.append({
                                    "tool_call_id": call.id,
                                    "output": "Only professors are allowed to view flagged questions."
                                })
                                continue

                            result = []

                            if flag_type in ["mandatory", "all"]:
                                result.extend(fs.read_flagged_questions(course_id, flag_type="mandatory", include_seen=include_seen))

                            if flag_type in ["voluntary", "all"]:
                                result.extend(fs.read_flagged_questions(course_id, flag_type="voluntary", include_seen=include_seen))

                            result.sort(key=lambda x: x["timestamp"], reverse=True)

                            summary = "\n\n".join(
                                f"📝 [{f['reason']}] {f['question']} (Seen: {'✅' if f['seen'] else '❌'}, Type: {flag_type})"
                                for f in result
                            ) or "No flagged questions found."

                            tool_outputs.append({
                                "tool_call_id": call.id,
                                "output": summary
                            })


                    if tool_outputs:
                        print("L42: Submitting tool outputs")
                        self.client.beta.threads.runs.submit_tool_outputs(
                            thread_id=thread_id,
                            run_id=run_id,
                            tool_outputs=tool_outputs
                        )
                    else:
                        print("L42: No valid tool outputs to submit")

            elif run.status in ["failed", "cancelled", "expired"]:
                raise RuntimeError(f"Run failed with status: {run.status}")

            time.sleep(poll_interval)


    def get_latest_response(self, thread_id, run_id=None, assistant_id=None):
        messages = self.client.beta.threads.messages.list(thread_id=thread_id)

        for msg in messages.data:
            if msg.role == "assistant":
                # If assistant used a tool
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        if tool_call.function.name == "update_instructions":
                            if self.user_role == "professor":
                                import json
                                args = json.loads(tool_call.function.arguments)
                                new_instructions = args.get("new_instructions")
                                if new_instructions and assistant_id:
                                    self.update_assistant(assistant_id, instructions=new_instructions)
                                    return f"✅ Assistant instructions updated to: {new_instructions}"
                            else:
                                return "⚠️ You are not authorized to change the assistant instructions."
                else:
                    return msg.content[0].text.value
        return None



    def get_assistant_instructions(self, assistant_id):
        assistant = self.client.beta.assistants.retrieve(assistant_id)
        return assistant.instructions

    def get_thread_messages(self, thread_id):
        try:
            messages = self.client.beta.threads.messages.list(thread_id=thread_id)
            history = []

            # Reverse to get chronological order (oldest first)
            for msg in reversed(messages.data):
                if msg.role == "user":
                    history.append({
                        "sender": "User",
                        "message": msg.content[0].text.value,
                        "timestamp": msg.created_at
                    })
                elif msg.role == "assistant":
                    history.append({
                        "sender": "AI",
                        "message": msg.content[0].text.value,
                        "timestamp": msg.created_at
                    })

            return history
        except Exception as e:
            print(f"L42: Failed to fetch messages for thread {thread_id}: {str(e)}")
            return []
 