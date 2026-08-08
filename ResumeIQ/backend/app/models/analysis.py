import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, JSON
from app.database import Base

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False, index=True)
    overall_score = Column(Float, default=0.0)
    category_scores = Column(JSON, nullable=True)
    category_feedback = Column(JSON, nullable=True)
    priority_fixes = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class JDAnalysis(Base):
    __tablename__ = "jd_analyses"
    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False, index=True)
    jd_text = Column(Text, nullable=False)
    jd_title = Column(String(255), nullable=True)
    jd_company = Column(String(255), nullable=True)
    match_score = Column(Float, default=0.0)
    matched_keywords = Column(JSON, nullable=True)
    missing_keywords = Column(JSON, nullable=True)
    hard_requirements = Column(JSON, nullable=True)
    nice_to_have = Column(JSON, nullable=True)
    semantic_gaps = Column(JSON, nullable=True)
    over_indexed = Column(JSON, nullable=True)
    raw_extracted = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class CoverLetter(Base):
    __tablename__ = "cover_letters"
    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False, index=True)
    jd_analysis_id = Column(Integer, ForeignKey("jd_analyses.id"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    tone = Column(String(50), default="formal")
    length = Column(String(20), default="medium")
    company_name = Column(String(255), nullable=True)
    role_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
