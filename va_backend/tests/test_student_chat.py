import sys
import os

# Add the root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import json
from flask import Flask
from flask_socketio import SocketIO
from controllers.student_chat_controller import bp, register_socketio_events

@pytest.fixture
def test_client():
    """Fixture to create a Flask test client."""
    app = Flask(__name__)
    app.register_blueprint(bp)

    socketio = SocketIO(app, cors_allowed_origins="*")
    register_socketio_events(socketio)

    return app.test_client(), socketio

@pytest.fixture
def test_socket_client():
    """Fixture to create a WebSocket test client."""
    app = Flask(__name__)
    socketio = SocketIO(app, cors_allowed_origins="*")
    register_socketio_events(socketio)
    return socketio.test_client(app)


def test_start_chat_valid(test_client, test_socket_client):
    """✅ Test valid start-chat request"""
    client, socketio = test_client

    payload = {
        "user_id": "123",
        "key": "abc123",
        "initial_message": "Hello, AI!",
        "course_id": "course_1"
    }

    response = client.post("/scc/start-chat", data=json.dumps(payload), content_type="application/json")

    assert response.status_code == 200
    data = response.get_json()

    assert data["status"] == 200
    assert "session_id" in data.get("data", {})

    received_messages = test_socket_client.get_received()

    assert any(event["name"] == "ws_user_res" for event in received_messages)
    assert any(event["name"] == "ws_ai_res" for event in received_messages)


def test_start_chat_missing_user_id(test_client):
    """❌ Test missing user_id (400 Bad Request)"""
    client, _ = test_client

    payload = {
        # "user_id" is missing
        "key": "abc123",
        "initial_message": "Hello, AI!",
        "course_id": "course_1"
    }

    response = client.post("/scc/start-chat", data=json.dumps(payload), content_type="application/json")

    assert response.status_code == 400
    data = response.get_json()
    
    assert data["status"] == 400
    assert "error" in data  # Ensure an error field exists

    print(f"Test Missing User ID Response: {data}")  # Debugging output


def test_start_chat_invalid_data_format(test_client):
    """❌ Test invalid data format (400 Bad Request)"""
    client, _ = test_client

    payload = "This is not a JSON"  # Sending raw string instead of JSON

    response = client.post("/scc/start-chat", data=payload, content_type="application/json")

    assert response.status_code == 400
    data = response.get_json()

    assert data["status"] == 400

    print(f"Test Invalid Data Format Response: {data}")  # Debugging output

