from pydantic import BaseModel
class pccChatContReq(BaseModel):
    token: str
    session_id: str
    message : str