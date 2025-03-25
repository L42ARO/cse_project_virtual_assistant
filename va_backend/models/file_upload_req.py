from pydantic import BaseModel

class FileUploadReq(BaseModel):
    course_id: str
    file_name: str
