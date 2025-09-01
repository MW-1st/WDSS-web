import uuid
from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects.postgresql import UUID  # PostgreSQL의 UUID 타입
from .database import Base


class Scene(Base):
    __tablename__ = "scene"

    # 테이블 컬럼 정의
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    s3_key = Column(String(1024), nullable=True)  # 이미지가 없을 수도 있으므로 nullable=True
    scene_num = Column(Integer)

    # project_id 등 다른 테이블과의 관계(FK)가 있다면 여기에 추가합니다.
    # 예: project_id = Column(Integer, ForeignKey("projects.id"))