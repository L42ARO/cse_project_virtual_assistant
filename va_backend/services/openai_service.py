import os
from openai import AzureOpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY_1")
endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")

if not api_key:
    raise ValueError("❌ API key not found! Check your .env file.")
if not endpoint:
    raise ValueError("❌ ENDPOINT not found! Check your .env file.")

deployment = "gpt-4o"

# Initialize Azure OpenAI client
client = AzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2024-05-01-preview",
)

# Dictionary to store user conversations (simulates session storage)
conversation_history = {}

def add_message(user_id: str, user_message: str):
    """
    Adds a user message to the conversation history and gets a response from Azure OpenAI.
    """
    if user_id not in conversation_history:
        conversation_history[user_id] = [
            {"role": "system", "content": "You are a virtual assistant for a professor teaching English. The syllabus for this semester is: Week 1: English Verbs, Week 2: English literature, Week 3: English Pronunciation, Week 4: English Spelling, Week 5: Writing in English."}
        ]
    
    # Append the user's message to the conversation history
    conversation_history[user_id].append({"role": "user", "content": user_message})

    # Generate response from Azure OpenAI
    completion = client.chat.completions.create(
        model=deployment,
        messages=conversation_history[user_id],  # Pass full history
        max_tokens=800,
        temperature=0.7,
        top_p=0.95,
        frequency_penalty=0,
        presence_penalty=0,
    )

    # Get response
    response_message = completion.choices[0].message.content

    # Append the assistant's response to the conversation history
    conversation_history[user_id].append({"role": "assistant", "content": response_message})

    return response_message
