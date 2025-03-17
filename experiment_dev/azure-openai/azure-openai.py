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
    
    

#Prepare the chat prompt 
chat_prompt = [
    {"role": "system", "content": "You are a virtual assistant for a professor teaching english The syllabus for this semester is the followig: Week 1: English Verbs, Week 2: English literature, Week 3: English Pronunciation, Week 4: English Spelling, Week 5: Writing in english."},
    {"role": "user", "content": "Hi, what is the content we will see on week 4"}
] 
    
# Include speech result if speech is enabled  
messages = chat_prompt  
    
# Generate the completion  
completion = client.chat.completions.create(  
    model=deployment,
    messages=messages,
    max_tokens=800,  
    temperature=0.7,  
    top_p=0.95,  
    frequency_penalty=0,  
    presence_penalty=0,
    stop=None,  
    stream=False
)

print(completion.choices[0].message.content)
    