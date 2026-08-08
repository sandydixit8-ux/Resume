from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class ResumeUploadResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    raw_text: str
    ats_view_text: Optional[str] = None
    parsed_json: Optional[Any] = None
    has_parsing_issues: bool = False
    parsing_issues: Optional[Any] = None
    file_type: str
    file_size_bytes: int
    created_at: Optional[str] = None
    class Config:
        from_attributes = True

class ResumeParsedSections(BaseModel):
    contact_info: Optional[dict] = None
    summary: Optional[str] = None
    skills: list[str] = []
    experience: list[dict] = []
    education: list[dict] = []
    certifications: list[str] = []
    projects: list[dict] = []
