from flask import Blueprint, jsonify, request
from azure.data.tables import TableClient
import hashlib
from dotenv import load_dotenv
import os
import datetime
import jwt


SECRET_KEY = "your_secret_key"  # Change this to a secure key

load_dotenv()
api_key = os.getenv("STORAGE_KEY")

if not api_key:
    raise ValueError("❌ API key not found! Check your .env file.")

bp = Blueprint("users_controller", __name__)
prefix = "/users"

# Login route to check username and password
@bp.route(f'{prefix}/login', methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    # Validate username and password with database
    if comparePassword(username, password):
        role = "professor" if isProfessor(username) else "student"

        # Generate JWT token
        token = jwt.encode(
            {
                "username": username,
                "role": role,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)  # Token expiration time
            },
            SECRET_KEY,
            algorithm="HS256"
        )

        return jsonify({"token": token, "role": role}), 200
    else:
        return jsonify({"message": "Invalid username or password."}), 401

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
