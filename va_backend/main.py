import os
import eventlet
import atexit


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

from apscheduler.schedulers.background import BackgroundScheduler
from services.scheduler_jobs import analyze_weekly_questions # Import the job function

scheduler = BackgroundScheduler(daemon=True)

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

    # Ensure the job runs only once, not duplicated by Flask's reloader in debug mode
    if not scheduler.running:
        # Schedule the job to run every Sunday at 2:00 AM
        scheduler.add_job(
            func=analyze_weekly_questions,
            trigger='cron',
            day_of_week='sun',
            hour=2,
            minute=0,
            id='weekly_question_analysis',  # Give the job an ID
            replace_existing=True,
            misfire_grace_time=3600  # Allow job to run up to 1 hour late if missed
        )
        try:
            scheduler.start()
            print("⏰ APScheduler started successfully.")
            # Shut down the scheduler when exiting the app
            atexit.register(lambda: scheduler.shutdown())
        except Exception as e:
            print(f" Failed to start APScheduler: {e}")

    return app, socketio

if __name__ == "__main__":
    app, socketio = create_app()
    is_production = os.getenv("PRODUCTION", "false").lower() == "true"

    socketio.run(
        app,
        host="0.0.0.0" if is_production else "127.0.0.1",  # Bind to localhost in dev
        port=8000,
        debug=not is_production,  # Enable debug mode in dev
        use_reloader=False if not is_production else os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    )
