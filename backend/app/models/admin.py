from sqlalchemy import Column, Integer, String, DateTime, Text
from app.database import Base
from datetime import datetime, timezone

class VisitorLog(Base):
    __tablename__ = "visitor_logs"
    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(500), nullable=False)
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    referer = Column(String(500))
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AdminSetting(Base):
    __tablename__ = "admin_settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=False)
