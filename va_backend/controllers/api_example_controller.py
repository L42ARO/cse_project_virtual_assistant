import time
import random
import threading
from flask import Blueprint, jsonify
from flask_socketio import SocketIO, emit

socketio = None
bp = Blueprint("api_example_controller", __name__)

@bp.route('/simple-http')
def simple_http():
    """Returns a simple JSON response."""
    return jsonify({"message": "This is an immediate HTTP response"})


@bp.route('/delayed-http')
def delayed_http():
    """Triggers a response that sends a message word-by-word over WebSocket."""
    if not socketio:
        return jsonify({"error": "WebSocket not initialized"}), 500

    def send_delayed_response():
        quotes = ["I find your lack of faith disturbing", " Do or do not. There is no try.", "There’s always a bigger fish.", "Your focus determines your reality"]
        words = random.choice(quotes).split()
        for word in words:
            socketio.emit("delayed_message", {"word": word})
            time.sleep(0.5)

    threading.Thread(target=send_delayed_response, daemon=True).start()

    return jsonify({"status": "Streaming response started"}), 200

def register_socketio_events(_socketio: SocketIO):
    """Registers WebSocket event handlers."""
    global socketio
    socketio = _socketio

    @socketio.on("send_chat")
    def handle_chat(data):
        """Echos back the received chat message."""
        message = data.get("message", "")
        emit("chat_response", {"reply": f"YOU: {message}"}, broadcast=True)
        time.sleep(1)
        emit("chat_response", {"reply": f"SERVER: Hello there. You just tested a websocket"}, broadcast=True)
        time.sleep(1)
        emit("chat_response", {"reply": f"SERVER: Unlike an HTTP request, this is a 2 way communication"}, broadcast=True)
        time.sleep(1)
        emit("chat_response", {"reply": f"SERVER: So a server can send data back without the need of a trigger from the client"}, broadcast=True)
