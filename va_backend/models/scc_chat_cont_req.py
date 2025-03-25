from pydantic import BaseModel
class sccChatContReq(BaseModel):
    key: str
    session_id: str
    message : str