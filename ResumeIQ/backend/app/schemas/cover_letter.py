from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CoverLetterResponse(BaseModel):
    id: int
    resume_id: int
    content: str
    tone: str
    length: str
    company_name: Optional[str] = None
    role_name: Optional[str] = None
    created_at: Optional[str] = None
    class Config:
        from_attributes = True
