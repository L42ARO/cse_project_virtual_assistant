from flask import Blueprint, jsonify, request
from azure.data.tables import TableClient
import hashlib

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
        conn_str="DefaultEndpointsProtocol=https;AccountName=usfcapstone2025;AccountKey=wsIxrj3w52BcxjwVHn/ynTgCZAgNDCMDL0KPFkIeYSfNO/L8R31/SR8Xvu6Y7/gv2ld8iQhRsMdO+ASteolgaw==;EndpointSuffix=core.windows.net",
        table_name="userdata"
    )
    
    entity = next(table_client.query_entities(my_filter), None)
    return entity is not None and entity["Password"] == password_hash

def isProfessor(username):
    my_filter = "PartitionKey eq 'Professor'"
    
    table_client = TableClient.from_connection_string(
        conn_str="DefaultEndpointsProtocol=https;AccountName=usfcapstone2025;AccountKey=wsIxrj3w52BcxjwVHn/ynTgCZAgNDCMDL0KPFkIeYSfNO/L8R31/SR8Xvu6Y7/gv2ld8iQhRsMdO+ASteolgaw==;EndpointSuffix=core.windows.net",
        table_name="userdata"
    )
    
    entities = table_client.query_entities(my_filter)
    return any(entity["RowKey"] == username for entity in entities)

    
def register_socketio_events(socketio):
    pass
