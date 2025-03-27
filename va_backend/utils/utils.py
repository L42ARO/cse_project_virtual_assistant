import jwt
from flask import jsonify
def http_response(message: str, status: int, data: dict = None, error: str = None):
    response = {
        "message": message,
        "status": status
    }
    if data:
        response["data"] = data
    if error:
        response["error"] = error
    return jsonify(response), status


SECRET_KEY = "your_secret_key"  # Change this to a secure key

def decode_token(token):
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username = decoded.get("username")
        return username
    except jwt.ExpiredSignatureError:
        print("Token has expired")
    except jwt.InvalidTokenError:
        print("Invalid token")
    return None
