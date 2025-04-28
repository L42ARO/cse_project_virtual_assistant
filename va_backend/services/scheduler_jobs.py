import json
import os
import traceback
from datetime import datetime, timedelta, timezone
from openai import AzureOpenAI
from dotenv import load_dotenv
from services.question_logging_service import QuestionLoggingService


load_dotenv()
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY_1")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_API_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "4otest")

# Initialize Azure OpenAI Client ONLY
openai_client = None
openai_model = None
if AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT:
    print("Initializing Azure OpenAI client for scheduler job...")
    try:
        openai_client = AzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_version="2025-01-01-preview"
        )
        openai_model = AZURE_OPENAI_DEPLOYMENT_NAME
        print("Azure OpenAI client initialized.")
    except Exception as e:
        print(f"Failed to initialize Azure OpenAI client: {e}")
        traceback.print_exc()
else:
    print("Azure OpenAI API Key/Endpoint is missing. Cannot run analysis job.")

# Instantiate the service (uses Azure Tables internally)
# Ensure service initializes correctly before proceeding
question_service = None
try:
    question_service = QuestionLoggingService()
except Exception as service_init_e:
    print(f"Critical error initializing QuestionLoggingService: {service_init_e}")
    traceback.print_exc()

def analyze_weekly_questions():
    """
    Scheduled job function to analyze questions from the past week using Azure Table Storage.
    Uses print() instead of logging. Uses Azure OpenAI only.
    """
    job_start_time = datetime.now(timezone.utc)
    print(f"Starting weekly question analysis job at {job_start_time.isoformat()}...")

    if not openai_client:
        print("Azure OpenAI client not available (check credentials/initialization). Aborting analysis.")
        return
    if not question_service:
        print("QuestionLoggingService not available or failed to initialize. Aborting analysis.")
        return

    try:
        one_week_ago_dt = job_start_time - timedelta(days=7)
        one_week_ago_iso = one_week_ago_dt.isoformat()
        recent_questions = question_service.get_questions_since(one_week_ago_iso)

        if not recent_questions:
            print("No recent questions found in Azure Table Storage to analyze.")
            return

        print(f"Processing {len(recent_questions)} questions fetched from Azure Table Storage.")

    except Exception as e:
        print(f"Error fetching recent questions from Azure Table Storage: {e}")
        traceback.print_exc()
        return

    insights_by_course = {}
    courses = {q['course_id'] for q in recent_questions if 'course_id' in q and q['course_id']}

    for course_id in courses:
        print(f"Analyzing course: {course_id}")
        course_questions = [
            q['question_text'] for q in recent_questions
            if q.get('course_id') == course_id and q.get('question_text')
        ]

        if not course_questions:
            print(f"No valid questions found for course {course_id} this week.")
            insights_by_course[course_id] = []
            continue
        try:
            MAX_QUESTIONS_TO_SEND = 200
            questions_to_send = course_questions[:MAX_QUESTIONS_TO_SEND]
            if len(course_questions) > MAX_QUESTIONS_TO_SEND:
                print(f"Truncating questions sent to OpenAI for {course_id} from {len(course_questions)} to {MAX_QUESTIONS_TO_SEND}.")

            questions_block = "\n".join([f"- {q}" for q in questions_to_send])
            prompt = f"""
            Analyze the following student questions for the course '{course_id}'.
            Identify the top 5 most frequently asked themes or specific questions from the last week.
            Group semantically similar questions together under a single theme.
            For each theme/question, provide:
            1. A concise summary of the question/theme as "theme_summary".
            2. The frequency count as "count".
            3. Up to 3 examples of the original questions under this theme as "examples" (a list of strings).

            Output the result ONLY as a valid JSON list of objects, where each object
            has keys "theme_summary", "count", and "examples".
            Do not include any explanations, apologies, or text outside the JSON list structure.

            Example Output Format:
            [
              {{"theme_summary": "Assignment 1 Deadline Inquiry", "count": 15, "examples": ["When is assignment 1 due?", "Assignment 1 deadline?", "Due date for first assignment?"]}},
              {{"theme_summary": "Location of Lecture Slides", "count": 12, "examples": ["Lecture slides location?", "Where are the slides posted?", "Find lecture slides"]}}
            ]

            Student Questions:
            {questions_block}

            JSON Output:
            """

            print(f"Calling Azure OpenAI model '{openai_model}' for {course_id} with {len(questions_to_send)} questions...")
            response = openai_client.chat.completions.create(
                model=openai_model,
                messages=[
                    {"role": "system", "content": "You are an AI assistant analyzing student questions for patterns and frequency. Output only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=1500
            )

            ai_response_content = response.choices[0].message.content
            print(f"Azure OpenAI response received for {course_id}.")

            try:
                cleaned_content = ai_response_content.strip().strip('```json').strip('```').strip()
                insights = json.loads(cleaned_content)

                if isinstance(insights, list):
                    valid_insights = []
                    for item in insights:
                        if isinstance(item, dict) and 'theme_summary' in item and 'count' in item and 'examples' in item:
                            valid_insights.append(item)
                        else:
                            print(f"Skipping invalid insight item for {course_id}: {item}")
                    insights_by_course[course_id] = valid_insights
                    print(f"Parsed {len(valid_insights)} valid insights for {course_id}.")
                else:
                    print(f"Azure OpenAI response for {course_id} was not a JSON list as expected: {cleaned_content}")
                    insights_by_course[course_id] = [{"error": "Invalid format from AI: Expected a list.", "raw_response": cleaned_content[:500]}]

            except json.JSONDecodeError as json_e:
                print(f"Failed to decode JSON response from Azure OpenAI for {course_id}: {json_e}. Raw response: {ai_response_content}")
                insights_by_course[course_id] = [{"error": "Failed to parse AI response as JSON.", "raw_response": ai_response_content[:500]}]

        except Exception as openai_error:
            print(f"Error processing course {course_id} with Azure OpenAI: {openai_error}")
            traceback.print_exc()
            insights_by_course[course_id] = [{"error": f"Azure OpenAI processing error: {str(openai_error)}"}]

    try:
        question_service.save_weekly_insights(insights_by_course)
    except Exception as e:
        print(f"Failed to save weekly insights to Azure Table Storage: {e}")
        traceback.print_exc()

    job_end_time = datetime.now(timezone.utc)
    duration = job_end_time - job_start_time
    print(f"Weekly question analysis job finished at {job_end_time.isoformat()}. Duration: {duration}")

# Manual test
if __name__ == "__main__":
    print("Running manual analysis job (ensure Azure environment variables are set)...")
    if question_service:
        analyze_weekly_questions()
    else:
        print("Cannot run manual job: QuestionLoggingService or Azure OpenAI Client failed to initialize.")
    print("Manual analysis job complete.")
