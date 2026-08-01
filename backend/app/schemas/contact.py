from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional

class ContactSubmit(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    company: Optional[str] = Field(default=None, max_length=255)
    subject: Optional[str] = Field(default="Sales Inquiry", max_length=255)
    message: str = Field(min_length=10, max_length=5000)

    @field_validator("name", "message")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("field cannot be blank")
        return v

    @field_validator("subject")
    @classmethod
    def _subject_default(cls, v: Optional[str]) -> str:
        v = (v or "").strip()
        return v or "Sales Inquiry"
