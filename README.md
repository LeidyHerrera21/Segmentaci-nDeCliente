# Sistema modular de segmentación de clientes

Aplicación React + TypeScript + Vite con una API REST en Python (FastAPI) que ejecuta K-Means con scikit-learn.

## Requisitos
- Node.js 20 o superior
- npm
- Python 3.10 o superior

## 1. Instalar y arrancar la API Python

Abre una terminal dentro de la carpeta `segmentacion-clientes/api`:

```bash
python -m venv .venv
```

Activa el entorno virtual:

**Windows (PowerShell):**
```powershell
.venv\\Scripts\\Activate.ps1
```

**Windows (CMD):**
```bat
.venv\\Scripts\\activate.bat
```

**Linux/macOS:**
```bash
source .venv/bin/activate
```

Instala las dependencias y arranca el servidor:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

La API estará disponible en `http://127.0.0.1:8000`. Puedes revisar la documentación interactiva en `http://127.0.0.1:8000/docs` y verificar el estado en `http://127.0.0.1:8000/api/health`.

## 2. Instalar y arrancar React

Abre otra terminal en la carpeta principal `segmentacion-clientes`:

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite, normalmente `http://localhost:5173`.

Vite reenvía las peticiones `/api` al servidor Python en el puerto 8000. Por eso, **debes mantener las dos terminales abiertas**: una para FastAPI y otra para React.

## Funcionalidades
- Dashboard con total de clientes, gasto promedio, visitas promedio y cantidad de segmentos.
- CRUD de clientes con búsqueda, edición, eliminación y confirmación.
- Validación de códigos únicos y números no negativos.
- Segmentación K-Means solicitada a la API REST Python.
- `StandardScaler` para estandarizar gasto, visitas y antigüedad.
- `KMeans(n_clusters=K, random_state=42, n_init=10)` con scikit-learn.
- Resultados con cantidad y promedios por grupo, filtro por segmento y ordenamiento.
- Recomendaciones comerciales orientativas por grupo.
- Datos iniciales desde `src/data/seed.json`.
- Los clientes continúan guardándose en `localStorage`; la segmentación se calcula en el backend Python.

## Endpoints
- `GET /api/health`: comprueba que la API está activa.
- `POST /api/segmentation/run`: recibe `k` y una lista de clientes; devuelve los clientes con su segmento y el resumen estadístico.

Ejemplo de petición:
```json
{
  "k": 3,
  "customers": [
    {
      "id": "C001",
      "nombre": "Ana Torres",
      "gastoAcumulado": 1800,
      "visitas6Meses": 12,
      "antiguedadMeses": 24
    }
  ]
}
```

El ejemplo anterior por sí solo no tiene suficientes registros para `k=3`; envía al menos tres clientes para ejecutar esa configuración.

## Persistencia y limitaciones
El CRUD todavía conserva los datos en el navegador mediante `localStorage`; no hay una base de datos central. La API se utiliza para ejecutar el algoritmo de segmentación. En un despliegue real, se recomienda proteger la API y almacenar los clientes en una base de datos.

## Variables de K-Means
El algoritmo utiliza gasto acumulado, visitas de los últimos seis meses y antigüedad en meses. El código y nombre identifican al cliente, pero no se usan para calcular distancias. Las variables se estandarizan antes de aplicar el agrupamiento.
