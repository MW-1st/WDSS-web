import json  # JSON 라이브러리 import
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
            # 수신 페이로드(raw) 로그 출력
            print("[웹소켓] 수신된 원문 메시지:", data)
            # JSON으로 파싱 가능하면 보기 좋게 출력
            try:
                parsed = json.loads(data)
                print("[웹소켓] 파싱된 JSON:")
                print(json.dumps(parsed, ensure_ascii=False, indent=2))
            except Exception:
                # JSON이 아니면 무시
                pass

            # 브로드캐스트 메시지 준비 및 로그
            broadcast_msg = f"A client says: {data}"
            print("[웹소켓] 브로드캐스트 전송 메시지:", broadcast_msg)
            await manager.broadcast(broadcast_msg)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast("A client has left the chat")


@router.post("/test/broadcast")
async def test_broadcast():
    test_message = "Test message from backend"
    await manager.broadcast(test_message)
    return {
        "status": "success",
        "message": "Test message broadcasted to all connected Unity clients",
    }
