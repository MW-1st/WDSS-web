import json # JSON 라이브러리 import
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

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

# --- 신규 추가: 테스트 데이터 전송을 위한 HTTP 엔드포인트 ---
@router.post("/test/broadcast")
async def broadcast_test_data():
    """
    연결된 모든 웹소켓 클라이언트에게 테스트용 JSON 데이터를 브로드캐스트합니다.
    """
    test_data = {
        "objectName": "PlayerCube",
        "action": "setColor",
        "value": "#FF0000" # 빨간색
    }
    
    # dict를 json 문자열로 변환하여 전송
    await manager.broadcast(json.dumps(test_data))
    
    return {"status": "ok", "message": "Test data broadcasted to all clients."}
# ---------------------------------------------------------


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
