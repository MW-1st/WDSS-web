import json # JSON 라이브러리 import
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

# (ConnectionManager 클래스는 변경 없음)
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

router = APIRouter(
    prefix="/ws",
    tags=["websocket"],
)



@router.websocket("/unity")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f"A client says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast("A client has left the chat")


@router.post("/test/broadcast")
async def test_broadcast():
    test_message = "Test message from backend"
    await manager.broadcast(test_message)
    return {"status": "success", "message": "Test message broadcasted to all connected Unity clients"}
