import os  
import time
from openai import AzureOpenAI  
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY_1")

if not api_key:
    raise ValueError("❌ API key not found! Check your .env file.")

endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")
if not endpoint:
    raise ValueError("❌ ENDPOINT not found! Check your .env file.")

deployment = "gpt-4o"
subscription_key = api_key 

# Initialize Azure OpenAI Service client with key-based authentication    
client = AzureOpenAI(  
    azure_endpoint=endpoint,  
    api_key=subscription_key,  
    api_version="2024-05-01-preview",
)


# vs_id = "vs_lgrVwcW8AAbOX3QCFzySgWXC"
vs_id = "vs_2MJjh2IcJ1ebI6Lu1z4B6gfq"
assistant_id = "asst_QAA9ERdqNke90WjtS9iN0PI7"
question = "Based on the questions on Homework 1, which lectures should I study?"

thread = client.beta.threads.create(
#   messages=[ { "role": "user", "content": question} ],
  tool_resources={
    "file_search": {
      "vector_store_ids": [vs_id]
    }
  }
)

# Create a thread
# thread = client.beta.threads.create()

# Add a user question to the thread
message = client.beta.threads.messages.create(
  thread_id=thread.id,
  role="user",
  content=question # Replace this with your prompt
)



# Run the thread
run = client.beta.threads.runs.create(
  thread_id=thread.id,
  assistant_id=assistant_id
)

# Looping until the run completes or fails
while run.status in ['queued', 'in_progress', 'cancelling']:
  time.sleep(1)
  run = client.beta.threads.runs.retrieve(
    thread_id=thread.id,
    run_id=run.id
  )

if run.status == 'completed':
  messages = client.beta.threads.messages.list(
    thread_id=thread.id
  )
  print(messages)
elif run.status == 'requires_action':
  # the assistant requires calling some functions
  # and submit the tool outputs back to the run
  pass
else:
  print(run.status)