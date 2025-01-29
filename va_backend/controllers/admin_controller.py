from flask import Blueprint, render_template, send_from_directory
from flask_socketio import emit
import os

bp = Blueprint("admin_controller", __name__)
socketio = None

@bp.route("/ping")
def ping():
    return "pong"
@bp.route("/")
def default():
    return render_template("index.html")
@bp.route("/ui/<path:subpath>")
def serve_tab(subpath):
    return render_template("index.html")

@bp.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join('templates', 'assets'), filename)

@bp.route('/manifest.webmanifest')
def serve_manifest():
    return send_from_directory('templates', 'manifest.webmanifest')

@bp.route('/<path:filename>')
def serve_static(filename):
    """
    Serve static assets like PNG, ICO, SVG, JS, and CSS files
    without interfering with API routes.
    """
    static_folder = 'templates'

    # Only allow specific file types to be served dynamically
    allowed_extensions = {'.png', '.ico', '.svg', '.jpg', '.jpeg', '.css', '.js'}
    
    # Extract file extension
    ext = os.path.splitext(filename)[1]

    if ext in allowed_extensions and os.path.exists(os.path.join(static_folder, filename)):
        return send_from_directory(static_folder, filename)

    return "File not found", 404


def register_socketio_events(_socketio):
    global socketio
    socketio = _socketio
    @_socketio.on('ping')
    def handle_ping():
        print("Ping received")
        emit('pong', {'message': 'pong'})
