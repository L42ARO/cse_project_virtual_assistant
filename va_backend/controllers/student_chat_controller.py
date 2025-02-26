import time
import threading
from flask import Blueprint, jsonify
from flask_socketio import SocketIO

# Create a Blueprint
socketio = None
bp = Blueprint("student_chat_controller", __name__)
prefix = "/sc"
sessions = []

@bp.route(f'{prefix}/start-chat')
def start_chat():
    # Get message from JSON: {user_Id, key, initial_message, course_id}
    # Generate UUID for session
    # Generate 

def register_socketio_events(_socketio: SocketIO):
    """Registers WebSocket event handlers."""
    global socketio
    socketio = _socketio
