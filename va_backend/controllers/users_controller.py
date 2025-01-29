from flask import Blueprint, jsonify

# Create a Blueprint
bp = Blueprint("users_controller", __name__)

# Dummy users list
dummy_users = [
    {"id": 1, "name": "Alice", "email": "alice@example.com"},
    {"id": 2, "name": "Bob", "email": "bob@example.com"},
    {"id": 3, "name": "Charlie", "email": "charlie@example.com"}
]

@bp.route('/get-users')
def get_users():
    """
    Return a list of dummy users as JSON.
    """
    return jsonify(dummy_users)

    
def register_socketio_events(socketio):
    pass
