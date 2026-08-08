from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class ATSAnalysisResponse(BaseModel):
    id: int
    resume_id: int
    overall_score: float
    category_scores: Optional[Any] = None
    category_feedback: Optional[Any] = None
    priority_fixes: Optional[list] = None
    created_at: Optional[str] = None
    class Config:
        from_attributes = True

class JDAnalysisResponse(BaseModel):
    id: int
    resume_id: int
    jd_text: str
    jd_title: Optional[str] = None
    jd_company: Optional[str] = None
    match_score: float
    matched_keywords: Optional[list] = None
    missing_keywords: Optional[list] = None
    hard_requirements: Optional[list] = None
    nice_to_have: Optional[list] = None
    semantic_gaps: Optional[list] = None
    over_indexed: Optional[list] = None
    created_at: Optional[str] = None
    class Config:
        from_attributes = True

class RewriteSuggestion(BaseModel):
    section: str
    original: str
    suggestion: str
    explanation: str
    type: str = "rewrite"

class RewriteResponse(BaseModel):
    resume_id: int
    suggestions: list[RewriteSuggestion]
