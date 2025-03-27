from pydantic import BaseModel
class pccChatStartReq(BaseModel):
    user_id: str
    token: str
    initial_message: str
    course_id: str