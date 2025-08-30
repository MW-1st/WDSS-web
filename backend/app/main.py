from fastapi import FastAPI
from app.routers import auth, websocket

app = FastAPI()

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(websocket.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
