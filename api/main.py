from datetime import datetime, timezone
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

app = FastAPI(
    title="Comercial Nova API",
    description="API REST para segmentación de clientes mediante K-Means.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Customer(BaseModel):
    id: str = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=100)
    gastoAcumulado: float = Field(ge=0)
    visitas6Meses: int = Field(ge=0)
    antiguedadMeses: int = Field(ge=0)
    segmento: Optional[int] = None

    @field_validator("id", "nombre")
    @classmethod
    def no_vacio(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El código y el nombre son obligatorios.")
        return value.strip()


class SegmentationRequest(BaseModel):
    k: int = Field(ge=2, le=5)
    customers: List[Customer]


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Comercial Nova API"}


@app.post("/api/segmentation/run")
def run_segmentation(request: SegmentationRequest):
    customers = request.customers
    if len(customers) < request.k:
        raise HTTPException(
            status_code=400,
            detail=f"Hay {len(customers)} clientes; se necesitan al menos {request.k} para ejecutar K-Means.",
        )

    ids = [customer.id.strip().upper() for customer in customers]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Los códigos de cliente deben ser únicos.")

    values = np.array([
        [c.gastoAcumulado, c.visitas6Meses, c.antiguedadMeses]
        for c in customers
    ], dtype=float)

    if not np.isfinite(values).all():
        raise HTTPException(status_code=400, detail="Los datos numéricos deben ser válidos.")

    try:
        scaled = StandardScaler().fit_transform(values)
        model = KMeans(n_clusters=request.k, random_state=42, n_init=10)
        labels = model.fit_predict(scaled)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Ocurrió un error al calcular K-Means.") from exc

    updated_customers = []
    groups = []
    for index, customer in enumerate(customers):
        row = customer.model_dump()
        row["segmento"] = int(labels[index])
        updated_customers.append(row)

    for group_id in range(request.k):
        members = [customers[i] for i, label in enumerate(labels) if int(label) == group_id]
        groups.append({
            "id": group_id,
            "cantidad": len(members),
            "gastoPromedio": round(float(np.mean([c.gastoAcumulado for c in members])), 2) if members else 0,
            "visitasPromedio": round(float(np.mean([c.visitas6Meses for c in members])), 2) if members else 0,
            "antiguedadPromedio": round(float(np.mean([c.antiguedadMeses for c in members])), 2) if members else 0,
        })

    return {
        "customers": updated_customers,
        "summary": {
            "k": request.k,
            "fechaEjecucion": datetime.now(timezone.utc).isoformat(),
            "cantidadProcesada": len(customers),
            "grupos": groups,
            "iteraciones": int(model.n_iter_),
        },
    }
