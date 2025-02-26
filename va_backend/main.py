import os
import eventlet

# Only monkey patch if running in production
if os.getenv("PRODUCTION", "false").lower() == "true":
    eventlet.monkey_patch()

from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from controllers import admin_controller
from controllers import users_controller
from controllers import student_chat_controller
from controllers import professor_chat_controller
from controllers import api_example_controller

def create_app():
    app = Flask(__name__)
    CORS(app)  # Enable CORS for the entire app

    # Check if we are running in production mode
    is_production = os.getenv("PRODUCTION", "false").lower() == "true"

    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet" if is_production else "threading")

    app.register_blueprint(api_example_controller.bp)
    app.register_blueprint(admin_controller.bp)
    app.register_blueprint(users_controller.bp)
    app.register_blueprint(student_chat_controller.bp)
    app.register_blueprint(professor_chat_controller.bp)

    # Register Socket.IO events
    admin_controller.register_socketio_events(socketio)
    users_controller.register_socketio_events(socketio)
    student_chat_controller.register_socketio_events(socketio)
    api_example_controller.register_socketio_events(socketio)
    professor_chat_controller.register_socketio_events(socketio)

    return app, socketio

if __name__ == "__main__":
    app, socketio = create_app()
    is_production = os.getenv("PRODUCTION", "false").lower() == "true"

    socketio.run(
        app,
        host="0.0.0.0" if is_production else "127.0.0.1",  # Bind to localhost in dev
        port=8000,
        debug=not is_production,  # Enable debug mode in dev
    )
