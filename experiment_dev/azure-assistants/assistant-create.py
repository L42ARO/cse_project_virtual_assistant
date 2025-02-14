import os
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY_1")

if not api_key:
    raise ValueError("❌ API key not found! Check your .env file.")

endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")
if not endpoint:
    raise ValueError("❌ ENDPOINT not found! Check your .env file.")


subscription_key = api_key 
deployment = "gpt-4o"

# Initialize Azure OpenAI Service client with key-based authentication    
client = AzureOpenAI(  
    azure_endpoint=endpoint,  
    api_key=subscription_key,  
    api_version="2024-05-01-preview",
)

course_name = "Modern Physics"
course_description = "Special  relativity.  Interaction  of  radiation  with  matter.  Particle-wave duality. Atomic and x-ray spectra and Bohr model of atom. Schrodinger wave equation. Introduction to solid state physics."

assistant = client.beta.assistants.create(
  name="ProfessorAssistant001",
  instructions=f'You are an assistant for a professor of a {course_name}. Use your knowledge base to answer questions about {course_description}.',
  model=deployment,
  tools=[{"type": "file_search"}],
)
print(assistant.model_dump_json(indent=2))