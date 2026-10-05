from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import upload, validation, export, stats
from app.core.config import settings

app = FastAPI(
    title="CliMaScan API",
    description="Numérisation automatique des fiches climatologiques DGMN vers CLIDATA",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(validation.router, prefix="/api/validation", tags=["Validation"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])

@app.get("/")
def root():
    return {"status": "ok", "app": "CliMaScan", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}
