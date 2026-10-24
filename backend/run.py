import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' is always resolvable
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from app.config import PORT, HOST

if __name__ == "__main__":
    print(f"Starting CareCompass Backend Server on http://{HOST}:{PORT}")
    print(f"Interactive Swagger Documentation available at http://127.0.0.1:{PORT}/docs")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)

