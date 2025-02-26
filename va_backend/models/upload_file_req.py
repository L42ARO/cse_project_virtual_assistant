from pydantic import BaseModel

class UploadFileReq(BaseModel):
    course_id: str
    file_name: str
