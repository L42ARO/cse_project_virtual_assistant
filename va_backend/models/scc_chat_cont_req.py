from pydantic import BaseModel
class sccChatContReq(BaseModel):
    token: str
    session_id: str
    message : str