# Web README

## 개요

본 프로젝트의 웹(Web) 부분은 사용자가 업로드한 이미지나 직접 그린 그림을 기반으로 **드론 경로 자동 생성 및 시뮬레이션**을 지원하는 핵심 인터페이스 역할을 한다.
웹은 단순히 데이터 입력 창구를 넘어, 이미지 처리·경로 변환·시뮬레이션 서버와의 실시간 연동을 담당하며, 사용자가 직관적으로 드론 이동 경로를 설계할 수 있도록 한다.

---

cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

cd frontend
npm run dev


## 세팅

1. 백엔드 (Python / 가상환경)
```bash
cd backend
# 가상환경 생성 (윈도우라면)
python -m venv venv

# 가상환경 실행
venv\Scripts\activate   # 윈도우
# source venv/bin/activate   # 리눅스/맥

#백엔드 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 패키지 설치
pip install -r requirements.txt
```

2. 프론트엔드 (Node.js / npm)
```bash
cd frontend
npm install
```
3. 환경변수 설정
```bash
DATABASE_URL=your_db

# Gmail SMTP Settings (실제 이메일 발송용)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=your_password
SMTP_FROM=your@gmail.com
```
## 실행
1. 백엔드 실행
```bash
cd backend
venv\Scripts\activate   # (가상환경 실행, 이미 되어 있으면 생략)
uvicorn app.main:app --reload 
```

2. 프론트엔드 실행
```bash
cd frontend
npm run dev
```

---

## 주요 기능

1. **이미지 업로드 및 편집**

   * 대용량 이미지 업로드 지원
   * 다양한 포맷 호환 (JPEG, PNG 등)
   * 캔버스를 통한 이미지 편집 및 좌표계 정의

2. **실시간 미리보기 및 동기화**

   * 서버 전송 간 지연 최소화
   * 클라이언트-서버 간 실시간 반영

3. **데이터 파싱 및 통신**

   * JSON 기반 경로 데이터 스키마 관리
   * Web ↔ Unity 양방향 데이터 파싱
   * WebSocket / Socket.IO 기반 실시간 통신

4. **시뮬레이션 연동**

   * Web에서 GCS(Ground Control System)에 명령 전달
   * 명령은 JSON 형태로 정의된 프로토콜 기반
   * Unity 상의 GCS가 각 드론 오브젝트에 명령을 전송하여 실행

---

## 기술적 도전 과제 (Challenges)

* **대용량 이미지 처리 성능 최적화**

  * 캔버스 렌더링 성능 보장
  * 좌표계 일관성 확보

* **실시간성 확보**

  * 서버 전송 지연 및 동기화 문제
  * 제한된 리소스(WebGL 환경)에서의 최적화

* **데이터 변환 및 파싱**

  * OpenCV 기반 윤곽선 추출 및 점 변환
  * 다중 보양, 충돌 지점 교차 처리 등 안정성 확보

* **프로토콜 정의**

  * Web ↔ GCS 간 JSON 기반 커스텀 프로토콜 문서화
  * 향후 실제 드론 적용을 위한 확장 가능성 고려

---

## 기술 스택

* **Frontend**: React (웹툴 UI/UX)
* **Backend**: FastAPI (웹 서버 및 API)
* **통신**: WebSocket, Socket.IO
* **이미지 처리**: OpenCV
* **시뮬레이션 연동**: Unity + WebGL

---

## 기대 효과

* 실제 환경적 제약(공간, 장비) 없이 언제든지 시뮬레이션 가능
* 실제 드론 운용 이전에 유사 환경을 설정하여 사전 테스트 가능
* 사용자 정의 프로토콜을 통해 확장성 있는 GCS-드론 연동 시뮬레이션 구현
