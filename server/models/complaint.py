from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, Identity, Integer
from sqlmodel import Field, SQLModel


class Complaint(SQLModel, table=True):
    """Libro de Reclamaciones Virtual (Indecopi, DS N° 101-2022-PCM)."""

    __tablename__ = "complaints"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    # numeración correlativa de la hoja de reclamación (exigida por la norma)
    number: Optional[int] = Field(
        default=None, sa_column=Column(Integer, Identity(), unique=True, index=True)
    )

    tipo: str  # "reclamo" | "queja"

    consumidor_nombre: str
    consumidor_domicilio: str
    consumidor_documento_tipo: str  # "DNI" | "CE" | "Pasaporte"
    consumidor_documento_numero: str
    consumidor_telefono: Optional[str] = None
    consumidor_email: str

    es_menor_edad: bool = False
    apoderado_nombre: Optional[str] = None

    bien_tipo: str  # "producto" | "servicio"
    bien_descripcion: str
    monto_reclamado: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2)

    detalle: str
    pedido: str

    status: str = Field(default="pendiente")  # pendiente | respondido
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
