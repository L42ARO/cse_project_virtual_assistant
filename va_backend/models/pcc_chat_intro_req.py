from pydantic import BaseModel
class pccChatIntroReq(BaseModel):
    token: str
    course_id: str