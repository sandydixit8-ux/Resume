import json
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.resume import Resume
from app.services.exporter import export_resume
from app.api.deps import SESSION_TOKEN_HEADER, require_owner

router = APIRouter(tags=["Export"])


class ExportRequest(BaseModel):
    format: str = "pdf"
    country: str = "us"
    template: str = "professional"
    resume_id: int | None = None
    parsed_json: dict | None = None


@router.post("/export")
def export_file(
    request: ExportRequest,
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    parsed = request.parsed_json
    if parsed is None and request.resume_id is not None:
        resume = require_owner(db, request.resume_id, x_session_token)
        parsed = json.loads(resume.parsed_json) if resume.parsed_json else {}
    if not parsed:
        raise HTTPException(status_code=400, detail="No resume data provided")

    try:
        data, filename, media = export_resume(
            parsed, request.format, country_code=request.country, template=request.template
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return StreamingResponse(
        iter([data]),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
