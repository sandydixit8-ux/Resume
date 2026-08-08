from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from app.database import Base
from datetime import datetime, timezone

class ContactMessage(Base):
    __tablename__ = "contact_messages"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    company = Column(String(255))
    subject = Column(String(255), default="Sales Inquiry")
    message = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="new")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
