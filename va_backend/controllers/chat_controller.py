import time
import threading
from flask import Blueprint, jsonify
from flask_socketio import SocketIO

# Create a Blueprint
socketio = None
bp = Blueprint("chat_controller", __name__)


def register_socketio_events(_socketio: SocketIO):
    """Registers WebSocket event handlers."""
    global socketio
    socketio = _socketio
