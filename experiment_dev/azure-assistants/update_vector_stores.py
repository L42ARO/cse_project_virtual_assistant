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

# Replace with the actual vector store ID you want to update
vector_store_id = "vector_store_id_here"

file_paths = [
    "new_lecture_notes.txt",
    "updated_hw.txt",
]
file_streams = [open(path, "rb") for path in file_paths]

# Upload new files to the existing vector store
file_batch = client.beta.vector_stores.file_batches.upload_and_poll(
    vector_store_id=vector_store_id, files=file_streams
)

print(f"Updated Vector Store ID: {vector_store_id}")
print("Upload Status:", file_batch.status)
print("File Counts:", file_batch.file_counts)
