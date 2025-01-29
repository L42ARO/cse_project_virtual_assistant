from flask import jsonify
def response(success, message, code = 200):
    return jsonify({'success': success, 'message': message})