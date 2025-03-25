from pydantic import BaseModel
class pccChatContReq(BaseModel):
    key: str
    session_id: str
    message : str