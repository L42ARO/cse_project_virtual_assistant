import os  
import base64
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


vs_id = "vs_6Qr6xy981oyGRnOi8Ncxa6Ab"
assistant_id = "asst_QAA9ERdqNke90WjtS9iN0PI7"

assistant = client.beta.assistants.update(
  assistant_id=assistant_id,
  tool_resources={"file_search": {"vector_store_ids": [vs_id]}},
)