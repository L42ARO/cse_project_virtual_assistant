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

client = AzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2024-05-01-preview",
)

# List all vector stores
vector_stores = client.beta.vector_stores.list()

# Print vector store names and IDs
for vs in vector_stores:
    print(f"Name: {vs.name}, ID: {vs.id}")
