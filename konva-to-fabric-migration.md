# Konva.js → Fabric.js 마이그레이션 진행 상황

## 개요
EditorPage에서 사용 중인 Konva.js 캔버스 라이브러리를 Fabric.js로 변경하는 프로젝트

## 분석 결과

### 현재 Konva.js 구현 상태
- **파일 위치**: `frontend/src/components/Canvas.jsx`
- **주요 기능**:
  - Stage/Layer 구조를 통한 캔버스 생성
  - 이미지 로드 및 표시 (자동 크기 조정 포함)
  - 마우스를 통한 자유곡선 드로잉
  - 드래그 가능한 사각형 요소

### 현재 의존성
```json
"konva": "^9.3.22",
"react-konva": "^19.0.7"
```

### 마이그레이션 대상 기능
1. **캔버스 초기화**: Stage/Layer → fabric.Canvas
2. **이미지 렌더링**: KonvaImage → fabric.Image
3. **자유곡선 그리기**: Line 객체 → fabric.Path
4. **이벤트 처리**: 마우스 이벤트 핸들링

## 진행 계획
1. [✅] 현재 Konva.js 구현 상태 파악
2. [✅] EditorPage에서 사용 중인 Konva.js 기능들 분석  
3. [✅] fabric.js로 마이그레이션 계획 수립
4. [🔄] 마이그레이션 진행 사항을 기록할 MD 파일 생성
5. [ ] fabric.js 의존성 추가 및 Konva.js 제거
6. [ ] Canvas 컴포넌트를 fabric.js로 재구현
7. [ ] 기능 테스트 및 동작 확인

---

## 진행 로그

### 2025-09-03
- ✅ 현재 코드베이스 분석 완료
- ✅ Konva.js 사용 패턴 및 기능 파악
- ✅ 마이그레이션 계획 수립
- ✅ 문서화 작업 완료
- ✅ 의존성 변경 (konva, react-konva → fabric)
- ✅ Canvas 컴포넌트 fabric.js로 재구현 완료
- ✅ fabric.js import 오류 수정 완료
- ✅ fabric.js v6 렌더링 및 그리기 기능 완료
- ✅ **마이그레이션 성공적으로 완료!** (개발 서버: http://localhost:5174)

#### 해결된 문제들
- ✅ fabric.js v6의 올바른 import 문법: `import { Canvas as FabricCanvas, Circle, Image as FabricImage, PencilBrush } from "fabric"`
- ✅ useLayoutEffect 사용으로 DOM 렌더링 타이밍 문제 해결
- ✅ PencilBrush 수동 설정으로 그리기 기능 활성화
- ✅ 이미지 로드 및 자동 크기 조정 기능 구현

#### 변경된 의존성
```json
// 제거됨
"konva": "^9.3.22",
"react-konva": "^19.0.7"

// 추가됨  
"fabric": "^6.7.1"
```

#### Canvas.jsx 주요 변경사항
- Konva의 Stage/Layer 구조 → fabric.Canvas로 변경
- react-konva 컴포넌트 → 네이티브 HTML canvas + fabric.js로 변경
- 이미지 렌더링: KonvaImage → FabricImage로 변경
- 자유곡선 그리기: Konva Line → fabric.js PencilBrush로 변경
- useEffect → useLayoutEffect로 DOM 렌더링 최적화

#### 최종 구현된 기능
✅ 캔버스 생성 및 배경색 설정  
✅ 마우스를 통한 자유 그리기  
✅ 이미지 업로드 및 자동 크기 조정  
✅ 외부 ref를 통한 캔버스 참조 전달  
✅ 기존 EditorPage와의 완벽한 호환성

---

## 참고사항
- 기존 기능을 그대로 유지하면서 라이브러리만 변경
- EditorPage.jsx는 Canvas 컴포넌트만 사용하므로 인터페이스 호환성 유지 필요
- stageRef 참조를 fabric.Canvas로 적절히 변환 필요