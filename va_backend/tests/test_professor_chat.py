import sys
import os

# Add the root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import json
import io
from flask import Flask
from flask_socketio import SocketIO
from controllers.professor_chat_controller import bp, register_socketio_events

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


def test_new_course_valid(test_client, test_socket_client):
    """✅ Test valid new-course request"""
    client, socketio = test_client

    payload = {
        "professor_id": "prof123",
        "key": "secretkey",
        "initial_message": "Welcome to the course!",
        "course_name": "Intro to AI",
        "course_section": "A",
        "course_term": "Spring 2025"
    }

    response = client.post("/pcc/new-course", data=json.dumps(payload), content_type="application/json")

    assert response.status_code == 200
    data = response.get_json()

    assert data["status"] == 200
    assert "course_id" in data.get("data", {})

    received_messages = test_socket_client.get_received()

    assert any(event["name"] == "ws_course_res" for event in received_messages)
    assert any(event["name"] == "ws_course_reply" for event in received_messages)


def test_new_course_missing_professor_id(test_client):
    """❌ Test missing professor_id (400 Bad Request)"""
    client, _ = test_client

    payload = {
        "key": "secretkey",
        "initial_message": "Welcome to the course!",
        "course_name": "Intro to AI",
        "course_section": "A",
        "course_term": "Spring 2025"
    }

    response = client.post("/pcc/new-course", data=json.dumps(payload), content_type="application/json")

    assert response.status_code == 400
    data = response.get_json()

    assert data["status"] == 400
    assert "error" in data  # Ensure an error field exists


def test_new_course_invalid_data_format(test_client):
    """❌ Test invalid data format (400 Bad Request)"""
    client, _ = test_client

    payload = "This is not a JSON"  # Sending raw string instead of JSON

    response = client.post("/pcc/new-course", data=payload, content_type="application/json")

    assert response.status_code == 400
    data = response.get_json()

    assert data["status"] == 400


def test_upload_file_valid(test_client):
    """✅ Test valid file upload"""
    client, _ = test_client

    # Open the real file for testing
    with open("tests/lecture_notes.txt", "rb") as file_data:
        data = {
            "course_id": "course123"  # Send course_id as a string
        }
        files = {
            "file": (file_data, "lecture_notes.txt")  # Proper file format
        }

        # response = client.post("/pcc/upload-file", data=data, files=files, content_type="multipart/form-data")
        response = client.post("/pcc/upload-file", data={**data, "file": (file_data, "lecture_notes.txt")}, content_type="multipart/form-data")


    assert response.status_code == 200
    data = response.get_json()

    assert data["status"] == 200
    assert "file_id" in data.get("data", {})





def test_upload_file_missing_file(test_client):
    """❌ Test missing file (400 Bad Request)"""
    client, _ = test_client

    data = {
        "course_id": "course123"
    }

    response = client.post("/pcc/upload-file", data=data, content_type="multipart/form-data")

    assert response.status_code == 400
    data = response.get_json()

    assert data["status"] == 400
    assert "error" in data
