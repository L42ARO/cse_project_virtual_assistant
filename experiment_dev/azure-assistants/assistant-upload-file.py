import os
from openai import AzureOpenAI
from dotenv import load_dotenv

assistant_id = "asst_QAA9ERdqNke90WjtS9iN0PI7"
course_id = "PHY3101.001S25"

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

# Create a vector store called "Financial Statements"
vector_store = client.beta.vector_stores.create(name=course_id+"-files")
 
# Ready the files for upload to OpenAI
file_paths = [
  "sample_syllabus.pdf", 
  "hw1.pdf",
  "chp1_textbook_questions.txt",
  "Lectures/Lecture_1.txt",
  "Lectures/Lecture_2.txt",
  "Lectures/Lecture_3.txt",
  "Lectures/Lecture_4.txt",
  "Lectures/Lecture_5.txt",
  "Lectures/Lecture_7.txt",
  "Lectures/Lecture_8.txt",
  "Lectures/Lecture_9.txt",
  "Lectures/Lecture_10.txt"
  ]
file_streams = [open(path, "rb") for path in file_paths]
 
# Use the upload and poll SDK helper to upload the files, add them to the vector store,
# and poll the status of the file batch for completion.
file_batch = client.beta.vector_stores.file_batches.upload_and_poll(
  vector_store_id=vector_store.id, files=file_streams
)
 
# You can print the status and the file counts of the batch to see the result of this operation.
print(file_batch.status)
print(file_batch.file_counts)
print(vector_store.id)

assistant = client.beta.assistants.update(
  assistant_id=assistant_id,
  tool_resources={"file_search": {"vector_store_ids": [vector_store.id]}},
)