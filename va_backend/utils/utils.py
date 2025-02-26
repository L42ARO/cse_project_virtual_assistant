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
