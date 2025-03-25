from pydantic import BaseModel
class sccChatStartReq(BaseModel):
    user_id: str
    key: str
    initial_message: str
    course_id: str