# 나오시마 비전트립 가이드

## Project Overview
교회 비전트립팀(15명, 50~60대)을 위한 나오시마 섬 사전 가이드 웹사이트.
모바일 우선, 데스크톱 프레젠테이션 겸용. Vercel/GitHub Pages 배포.

상세 기획: specs/PRD.md 참조.

## Architecture

정적 사이트. 서버 없음. 빌드 도구 없음.

```
브라우저 → index.html → CSS (style.css) → JS (app.js)
                     → 콘텐츠 데이터 (sections/*.json)
                     → 이미지 (images/)
```

## Directory Structure

```
harness_test/
├── CLAUDE.md                # 이 파일 (하네스)
├── specs/
│   └── PRD.md               # 기획서
├── src/
│   ├── index.html           # 단일 진입점
│   ├── css/
│   │   └── style.css        # 전체 스타일 (1파일)
│   ├── js/
│   │   └── app.js           # 전체 로직 (1파일)
│   ├── data/
│   │   ├── sections.json    # 모든 섹션 콘텐츠 데이터
│   │   └── artists.json     # 작가별 상세 데이터
│   └── images/              # 이미지 에셋
│       └── .gitkeep
├── scripts/
│   └── check_structure.py   # 구조 검증 스크립트
└── .gitignore
```

## Design Constraints

### 콘텐츠와 표현의 분리
- **콘텐츠 데이터**는 반드시 `data/*.json`에 저장
- **HTML**은 구조(시맨틱 태그)만 담당 — 콘텐츠 텍스트를 HTML에 하드코딩 금지
- **CSS**는 표현만 담당
- **JS**는 JSON을 읽어 DOM에 렌더링
- 이유: 콘텐츠 수정 시 JSON만 편집하면 됨. 비개발자도 텍스트 수정 가능

### 파일 규칙
- HTML 파일: 1개 (index.html) — SPA 방식으로 상세 뷰는 JS 라우팅 처리
- CSS 파일: 1개 (style.css)
- JS 파일: 1개 (app.js)
- 외부 CDN 사용 금지 — 오프라인 열람 보장
- 이미지: WebP/JPG, 폴백 없이 최신 브라우저 대상

### SPA 라우팅 규칙
- URL 해시로 뷰 전환: #sections (메인), #artist/{id} (작가 상세)
- 뒤로가기 버튼 지원 (popstate)
- 작가 상세 뷰: 작가 사진 + 작품 이미지 + 상세 텍스트
- 전환 시 부드러운 애니메이션

### 반응형 규칙
- Mobile-first: 기본 스타일이 모바일
- Breakpoint: 768px (모바일 ↔ 데스크톱)
- 모바일: 단일 컬럼, 하단 탭 네비게이션
- 데스크톱: 좌측 사이드바 + 메인 콘텐츠

### 접근성 규칙 (50~60대 사용자 대상)
- 본문 폰트: 18px 이상
- 줄간격: 1.8 이상
- 터치 타겟: 48px 이상
- 색상 대비: WCAG AA 이상
- 이미지에 alt 텍스트 필수

## Tech Stack

| Component | Technology | 비고 |
|-----------|-----------|------|
| 마크업 | HTML5 시맨틱 태그 | section, article, nav, figure |
| 스타일 | CSS3 (vanilla) | CSS 변수, Grid/Flexbox |
| 로직 | Vanilla JS (ES2020+) | 모듈 없이 단일 파일 |
| 데이터 | JSON | fetch()로 로딩 |
| 배포 | Vercel 또는 GitHub Pages | src/ 폴더가 루트 |

## Coding Conventions

### HTML
- 시맨틱 태그 사용 (div 남용 금지)
- 섹션마다 id 부여 (앵커 네비게이션용)
- lang="ko" 명시

### CSS
- CSS 변수로 디자인 토큰 관리 (--color-*, --font-*, --space-*)
- BEM-like 네이밍: .section__title, .card--artist
- 미디어 쿼리는 파일 하단에 모아서 작성
- 다크모드 불필요

### JavaScript
- 'use strict'
- const/let만 사용 (var 금지)
- async/await로 JSON 로딩
- DOM 조작: template literal → innerHTML (보안 이슈 없음, 정적 데이터)
- 이벤트 위임 패턴 사용

## Implementation Phases

| Phase | 내용 | 검증 기준 |
|-------|------|-----------|
| 1 | 데이터 설계: sections.json, artists.json 스키마 정의 및 콘텐츠 작성 | JSON 유효성, 필수 필드 존재 |
| 2 | HTML 뼈대: 시맨틱 구조, 네비게이션, 섹션 컨테이너 | 구조 검증 스크립트 통과 |
| 3 | CSS 스타일: 모바일 기본 + 데스크톱 반응형 | 접근성 규칙 충족 |
| 4 | JS 렌더링: JSON → DOM, 네비게이션, 스크롤 | 브라우저에서 콘텐츠 표시 확인 |
| 5 | 마무리: 이미지, 메타태그, 인쇄 스타일, PWA 기본 | Lighthouse 접근성 90+ |

## Commands

```bash
# 로컬 개발 서버 (Python 내장)
cd src && python3 -m http.server 8000

# 구조 검증
python3 scripts/check_structure.py

# JSON 유효성 검사
python3 -c "import json; json.load(open('src/data/sections.json'))"
```
