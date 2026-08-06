import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from app.database import Base

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    raw_text = Column(Text, nullable=False)
    ats_view_text = Column(Text, nullable=True)
    parsed_json = Column(Text, nullable=True)
    has_parsing_issues = Column(Boolean, default=False)
    parsing_issues = Column(Text, nullable=True)
    file_type = Column(String(10), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
