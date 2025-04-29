import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from azure.data.tables import TableServiceClient, TableClient, UpdateMode

load_dotenv()
api_key = os.getenv("STORAGE_KEY")

if not api_key:
    raise ValueError("API key not found! Check your .env file.")

STORAGE_CONNECTION_STRING = (
    f"DefaultEndpointsProtocol=https;"
    f"AccountName=usfcapstone2025;"
    f"AccountKey={api_key};"
    f"EndpointSuffix=core.windows.net"
)
QUESTIONS_TABLE_NAME = 'studentquestions'
INSIGHTS_TABLE_NAME = 'questioninsights'

# Fallback to JSON logging for testing
USE_JSON_FALLBACK = False  # Set to False if using Azure
QUESTIONS_LOG_FILE = "all_student_questions.json"
INSIGHTS_FILE = "weekly_insights.json"


class QuestionLoggingService:
    def __init__(self, use_json=USE_JSON_FALLBACK):
        self.use_json = use_json
        if not self.use_json:
            pass
            try:
                self.table_service_client = TableServiceClient.from_connection_string(conn_str=STORAGE_CONNECTION_STRING)
                self.questions_client = self.table_service_client.get_table_client(QUESTIONS_TABLE_NAME)
                self.insights_client = self.table_service_client.get_table_client(INSIGHTS_TABLE_NAME)
                print("Azure Table Storage configured for question logging.")
            except Exception as e:
                print(f"Azure Table Storage connection failed: {e}. Falling back to JSON.")
                self.use_json = True
                self._init_json_files()

        else:
            self._init_json_files()
            print("Using JSON files for question logging.")

    def _init_json_files(self):
        if not os.path.exists(QUESTIONS_LOG_FILE):
            with open(QUESTIONS_LOG_FILE, "w") as f:
                json.dump([], f)
        if not os.path.exists(INSIGHTS_FILE):
             with open(INSIGHTS_FILE, "w") as f:
                dummy_insights = {
                    "CAP6317": [
                        {"question": "What is the deadline for assignment 1?", "count": 15, "examples": ["When is assignment 1 due?", "Assignment 1 deadline?"]},
                        {"question": "Where can I find the lecture slides?", "count": 12, "examples": ["Lecture slides location?", "Where are the slides posted?"]}
                    ],
                     "CDA4213": [
                        {"question": "How does pipelining work?", "count": 8, "examples": ["Explain pipelining", "Pipelining concept?"]},
                    ]
                }
                json.dump(dummy_insights, f, indent=2)


    def _load_questions_json(self):
        with open(QUESTIONS_LOG_FILE, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []  # Return empty list if file is empty or invalid

    def _save_questions_json(self, questions):
        with open(QUESTIONS_LOG_FILE, "w") as f:
            json.dump(questions, f, indent=2)

    def log_question(self, course_id, session_id, question_text):
        timestamp = datetime.now().isoformat()
        question_id = str(uuid.uuid4())

        new_question_data = {
            "id": question_id,
            "course_id": course_id,
            "session_id": session_id,
            "question_text": question_text,
            "timestamp": timestamp
        }

        if self.use_json:
            questions = self._load_questions_json()
            questions.append(new_question_data)
            self._save_questions_json(questions)
        else:
            entity = {
                'PartitionKey': course_id,
                'RowKey': f"{timestamp}_{question_id}",
                'SessionId': session_id,
                'QuestionText': question_text,
                'Timestamp': timestamp,
                'QuestionId': question_id
            }
            try:
                self.questions_client.create_entity(entity=entity)
            except Exception as e:
                print(f"Failed to log question to Azure Table: {e}")
            pass

        print(f"Logged question: {question_text[:50]}... (Course: {course_id})")
        return new_question_data

    def get_weekly_insights(self, course_id):
        print(f"Fetching weekly insights for course: {course_id}")
        if self.use_json:
            try:
                with open(INSIGHTS_FILE, "r") as f:
                    all_insights = json.load(f)
                    return all_insights.get(course_id, [])
            except (FileNotFoundError, json.JSONDecodeError):
                print(f"Insights file '{INSIGHTS_FILE}' not found or invalid.")
                return []
        else:
            try:
                filter_query = f"PartitionKey eq '{course_id}'"
                entities = list(self.insights_client.query_entities(filter_query))
                if entities:
                    latest_insight = json.loads(entities[-1]['InsightsData'])
                    return latest_insight
                else:
                    return []
            except Exception as e:
                 print(f"Failed to fetch insights from Azure Table: {e}")
                 return []  # Return empty on error

    def save_weekly_insights(self, insights_by_course):
        """
        Saves the generated weekly insights to the 'weeklyinsights' Azure Table.
        Uses course_id as PartitionKey and the week's ending date (Sunday) as RowKey.
        Overwrites existing data for the same course and week using upsert_entity.
        """

        if not insights_by_course:
            print("No insights data provided to save.")
            return

        print(f"Saving weekly insights for {len(insights_by_course)} courses to Azure Table...")
        try:
            today = datetime.now(timezone.utc).date()
            days_until_sunday = (6 - today.weekday() + 7) % 7
            week_ending_date_obj = today + timedelta(days=days_until_sunday)
            week_ending_date = week_ending_date_obj.strftime('%Y-%m-%d')  # Format as YYYY-MM-DD

            generated_timestamp = datetime.now(timezone.utc)

            for course_id, insights in insights_by_course.items():
                entity = {
                    'PartitionKey': course_id,
                    'RowKey': week_ending_date,  # Use week ending date as RowKey
                    'InsightsData': json.dumps(insights),  # Store insights list as JSON string
                    'GeneratedTimestamp': generated_timestamp  # Store as Edm.DateTime
                }
                # Use upsert_entity to create or update the record for the week
                self.insights_client.upsert_entity(entity=entity, mode=UpdateMode.REPLACE)
                print(f"Saved/Updated insights for course '{course_id}' for week ending {week_ending_date}.")

            print("All insights saved to Azure Table Storage.")

        except Exception as e:
            print(f"Failed to save insights to Azure Table: {e}")

    def get_questions_since(self, start_date_iso):
        """
        Retrieves questions logged since a specific ISO 8601 timestamp from the 'studentquestions' table.
        Uses Azure Table Storage query filter.
        """

        try:
            start_date = datetime.fromisoformat(start_date_iso.replace('Z', '+00:00'))
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)  # Assume UTC if no tz
        except ValueError:
            print(f"Invalid start_date_iso format: {start_date_iso}. Use ISO 8601 format.")
            return []

        print(f"Retrieving questions from Azure Table since {start_date.isoformat()}...")

        try:
            filter_query = f"Timestamp ge datetime'{start_date.isoformat()}'"

            entities = list(self.questions_client.query_entities(query_filter=filter_query))

            questions = []
            for e in entities:
                timestamp_str = e['Timestamp'].isoformat() if isinstance(e.get('Timestamp'), datetime) else str(e.get('Timestamp'))
                questions.append({
                    'id': e.get('QuestionId'),
                    'course_id': e.get('PartitionKey'),
                    'session_id': e.get('SessionId'),
                    'question_text': e.get('QuestionText'),
                    'timestamp': timestamp_str
                })

            print(f"Found {len(questions)} questions since {start_date_iso} from Azure.")
            return questions

        except Exception as e:
            print(f"Failed to fetch questions from Azure since {start_date_iso}: {e}")
            return []
