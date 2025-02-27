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

# Replace with the actual vector store ID you want to delete
vector_store_id = "vector_store_id_here"

# Delete the vector store
client.beta.vector_stores.delete(vector_store_id=vector_store_id)

print(f"Deleted Vector Store ID: {vector_store_id}")
