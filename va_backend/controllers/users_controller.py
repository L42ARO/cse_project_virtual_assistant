from flask import Blueprint, jsonify, request
from azure.data.tables import TableClient
import hashlib
from dotenv import load_dotenv
import os
import datetime
import jwt
import json
import re

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

    is_dev = devOverride(username, password)
    valid_credentials = comparePassword(username, password)

    if not (is_dev or valid_credentials):
        return jsonify({"message": "Invalid username or password."}), 401

    # Determine role
    role = "dev" if is_dev else ("professor" if isProfessor(username) else "student")

    # Fetch enrolled courses from table
    courses = get_user_courses(username)
    print(f"Enrolled courses:{courses}")

    # Generate JWT token (includes courses)
    payload = {
        "username": username,
        "role": role,
        "courses": courses,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    return jsonify({
        "token": token,
        "role": role,
        "courses": courses
    }), 200


def devOverride(username, password):
    return username == "haliday" and password == "2011"


def comparePassword(username, password):
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    my_filter = f"RowKey eq '{username}'"

    table_client = TableClient.from_connection_string(
        conn_str=(
            f"DefaultEndpointsProtocol=https;"
            f"AccountName=usfcapstone2025;"
            f"AccountKey={api_key};"
            f"EndpointSuffix=core.windows.net"
        ),
        table_name="userdata"
    )

    entity = next(table_client.query_entities(my_filter), None)
    return entity is not None and entity.get("Password") == password_hash


def isProfessor(username):
    # you already had this logic; unchanged
    my_filter = "PartitionKey eq 'Professor'"
    table_client = TableClient.from_connection_string(
        conn_str=(
            f"DefaultEndpointsProtocol=https;"
            f"AccountName=usfcapstone2025;"
            f"AccountKey={api_key};"
            f"EndpointSuffix=core.windows.net"
        ),
        table_name="userdata"
    )
    entities = table_client.query_entities(my_filter)
    return any(entity["RowKey"] == username for entity in entities)


def get_user_courses(username):
    """
    Fetches and returns the list of courses from the 'EnrolledCourses' property.
    If none is found, returns an empty list.
    """
    my_filter = f"RowKey eq '{username}'"
    table_client = TableClient.from_connection_string(
        conn_str=(
            f"DefaultEndpointsProtocol=https;"
            f"AccountName=usfcapstone2025;"
            f"AccountKey={api_key};"
            f"EndpointSuffix=core.windows.net"
        ),
        table_name="userdata"
    )
    entity = next(table_client.query_entities(my_filter), None)
    if not entity:
        return []
    raw = entity.get("EnrolledCourses", "[]")
    print(raw)
    try:
        courses = json.loads(raw)
        if isinstance(courses, list):
            return courses
    except json.JSONDecodeError:
        pass

    # 2) Cleanup and extract via regex
    #    Remove backslashes and square brackets
    cleaned = raw.replace("\\", "").strip("[]")
    #    Find sequences of letters+digits (e.g. CAP6317)
    return re.findall(r"[A-Za-z]+[0-9]+", cleaned)


def register_socketio_events(socketio):
    pass
