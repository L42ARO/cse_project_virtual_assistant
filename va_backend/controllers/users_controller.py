from flask import Blueprint, jsonify, request
from azure.data.tables import TableClient
import hashlib
from dotenv import load_dotenv
import os

load_dotenv()
api_key = os.getenv("STORAGE_KEY")

if not api_key:
    raise ValueError("❌ API key not found! Check your .env file.")

bp = Blueprint("users_controller", __name__)
prefix = "/users"

# Login route to check username and password
@bp.route(f'{prefix}/login', methods=["POST"])
def login():
    data = request.get_json()  # Get the username and password from the request body
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        
        return jsonify({"error": "Username and password are required."}), 400

    # Compare username and password with database
    if comparePassword(username, password):
        if isProfessor(username):
            return jsonify({"message": "professor"}), 200
        else:
            #print(f"{username},{password}")
            return jsonify({"message": "student"}), 200
    else:
        return jsonify({"message": "Invalid username or password."}), 200

def comparePassword(username, password):
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    my_filter = f"RowKey eq '{username}'"
    
    table_client = TableClient.from_connection_string(
        conn_str=f"DefaultEndpointsProtocol=https;AccountName=usfcapstone2025;AccountKey={api_key};EndpointSuffix=core.windows.net",
        table_name="userdata"
    )
    
    entity = next(table_client.query_entities(my_filter), None)
    return entity is not None and entity["Password"] == password_hash

def isProfessor(username):
    my_filter = "PartitionKey eq 'Professor'"
    
    table_client = TableClient.from_connection_string(
        conn_str=f"DefaultEndpointsProtocol=https;AccountName=usfcapstone2025;AccountKey={api_key};EndpointSuffix=core.windows.net",
        table_name="userdata"
    )
    
    entities = table_client.query_entities(my_filter)
    return any(entity["RowKey"] == username for entity in entities)

    
def register_socketio_events(socketio):
    pass
