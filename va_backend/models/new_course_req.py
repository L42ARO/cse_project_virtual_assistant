from pydantic import BaseModel
class NewCourseReq(BaseModel):
    professor_id: str
    key: str
    initial_message: str
    course_name: str
    course_section: str
    course_term: str