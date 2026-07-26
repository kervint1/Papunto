from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr


class ComplaintCreate(BaseModel):
    tipo: Literal["reclamo", "queja"]

    consumidor_nombre: str
    consumidor_domicilio: str
    consumidor_documento_tipo: Literal["DNI", "CE", "Pasaporte"]
    consumidor_documento_numero: str
    consumidor_telefono: Optional[str] = None
    consumidor_email: EmailStr

    es_menor_edad: bool = False
    apoderado_nombre: Optional[str] = None

    bien_tipo: Literal["producto", "servicio"]
    bien_descripcion: str
    monto_reclamado: Optional[Decimal] = None

    detalle: str
    pedido: str


class ComplaintCreated(BaseModel):
    id: str
    number: int
    message: str
