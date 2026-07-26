from fastapi import APIRouter, Depends
from sqlmodel import Session

from database import get_session
from models import Complaint
from schemas.complaint import ComplaintCreate, ComplaintCreated

router = APIRouter(prefix="/api/v1/complaints", tags=["complaints"])


@router.post("", response_model=ComplaintCreated, status_code=201)
def create_complaint(body: ComplaintCreate, session: Session = Depends(get_session)):
    # Libro de Reclamaciones es de acceso público: no requiere autenticación
    complaint = Complaint(**body.model_dump())
    session.add(complaint)
    session.commit()
    session.refresh(complaint)
    return ComplaintCreated(
        id=str(complaint.id),
        number=complaint.number,
        message="Su reclamo ha sido registrado. Recibirá una respuesta en un plazo no mayor a 15 días hábiles.",
    )
