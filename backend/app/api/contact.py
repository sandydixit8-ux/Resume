from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.contact import ContactMessage
from app.schemas.contact import ContactSubmit
from app.api.admin import verify_admin

router = APIRouter(tags=["Contact"])


@router.post("/api/v1/contact")
def submit_contact(body: ContactSubmit, db: Session = Depends(get_db)):
    msg = ContactMessage(
        name=body.name,
        email=str(body.email),
        company=body.company,
        subject=body.subject,
        message=body.message,
        status="new",
    )
    db.add(msg)
    db.commit()
    return {"status": "ok", "message": "Thank you! Your message has been received. We'll get back to you within 1 business day."}


@router.get("/api/v1/admin/contact")
def list_contact_messages(limit: int = 50, db: Session = Depends(get_db), _=Depends(verify_admin)):
    if limit < 1:
        limit = 50
    messages = db.query(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(limit).all()
    return {
        "total": len(messages),
        "messages": [
            {
                "id": m.id,
                "name": m.name,
                "email": m.email,
                "company": m.company,
                "subject": m.subject,
                "message": m.message,
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


@router.delete("/api/v1/admin/contact/{message_id}")
def delete_contact_message(message_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    msg = db.query(ContactMessage).filter(ContactMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"status": "ok", "deleted": message_id}
