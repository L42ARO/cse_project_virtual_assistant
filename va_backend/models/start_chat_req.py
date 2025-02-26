from pydantic import BaseModel
class StartChatReq(BaseModel):
    user_id: str
    key: str
    initial_message: str
    course_id: str