# 🏫 삼현 수업나눔한마당 웹 애플리케이션 (Samhyun Class Sharing Web App)

> **Zero-Cost Serverless Architecture**  
> Google Apps Script (백엔드) + Google Sheets (DB) + Google Drive (파일저장소) + GitHub Pages (웹 호스팅)

---

## 📌 주요 특징 및 기능

1. **완전 무과금 Serverless 구축**: 유료 서버 호스팅 비용 없이 Google 플랫폼과 GitHub Pages로 구축.
2. **수업 참관 신청 & 선착순 정원 관리**:
   - 실시간 잔여석 계산 및 정원 마감 뱃지 표시 ("신청가능", "마감임박", "신청마감").
   - `LockService` 기반 동시성 제어로 정원 초과(Overbooking) 방지.
   - 동일 연락처 중복 신청 자동 검증.
3. **수업 자료 공유**:
   - 관리자가 수업 개설 시 PDF, HWP, PPT 지도안 첨부 시 Google Drive 자동 저장 및 공개 다운로드 URL 매핑.
4. **관리자 전용 대시보드**:
   - 관리자 암호 인증 (`admin1234!` 기본값, SHA-256 암호화).
   - 공개수업 개설 / 수정 / 삭제 관리.
   - 참관 신청자 전체 명단 조회, Excel CSV 다운로드, A4 명단 인쇄 지원.
   - 공지사항 등록 / 상단 고정 관리.
5. **참여 교사 나눔 게시판**:
   - 사전 질의응답, 참관 후기, 자유소통 게시판 및 비밀번호 기반 글 작성/삭제.

---

## 📂 파일 구성

```text
삼현 수업나눔한마당/
├── index.html              # SPA 메인 웹 애플리케이션 레이아웃
├── Code.gs                 # Google Apps Script 백엔드 소스코드
├── css/
│   └── custom.css          # 커스텀 애니메이션, 뱃지, 명단 인쇄 CSS
├── js/
│   ├── config.js           # 앱 설정 및 GAS 배포 URL 정의
│   ├── api.js              # Fetch 기반 백엔드 통신 & Mock Fallback 모듈
│   ├── app.js              # 프론트엔드 수업 목록, 검색, 신청 폼 로직
│   └── admin.js            # 관리자 대시보드, 수업/명단/공지 관리 로직
├── plan.md                 # 프로젝트 전체 아키텍처 계획서
└── README.md               # 가이드 문서
```

---

## 🚀 배포 및 구축 가이드

### 1단계: Google 스프레드시트 준비
1. [Google 스프레드시트](https://sheets.google.com)에서 새로운 스프레드시트를 생성합니다.
2. 시트 제목을 `2026 삼현 수업나눔한마당 DB`로 지정합니다.
3. *참고*: `Code.gs` 백엔드 최초 실행 시 `Classes`, `Applications`, `Notices`, `Board`, `Config` 5개 탭 및 헤더 컬럼이 자동으로 생성됩니다.

---

### 2단계: Google Apps Script 배포
1. 스프레드시트 상단 메뉴의 **[확장 프로그램] > [Apps Script]**를 클릭합니다.
2. 기존 `Code.gs` 내용을 지우고 프로젝트의 [`Code.gs`](Code.gs) 파일의 전체 소스코드를 복사하여 붙여넣습니다.
3. 상단 메뉴의 **[배포] > [새 배포]**를 클릭합니다.
4. **유형 선택**: `웹 앱 (Web App)` 선택
   - **설명**: `삼현 수업나눔한마당 API v1`
   - **다음 사용자 권한으로 실행**: `나 (내 계정)`
   - **액세스 권한이 있는 사용자**: `모든 사용자 (Anyone)` ⚠️ **(필수!)**
5. **[배포]** 버튼을 누르고 접근 권한 승인을 완료합니다.
6. 배포 완료 후 생성된 **웹 앱 URL** (`https://script.google.com/macros/s/.../exec`)을 복사합니다.

---

### 3단계: 프론트엔드 URL 설정
1. `js/config.js` 파일을 열고 복사한 웹 앱 URL을 설정합니다:

```javascript
const CONFIG = {
  GAS_API_URL: "https://script.google.com/macros/s/YOUR_DEPLOYED_GAS_ID/exec",
  // ...
};
```

---

### 4단계: GitHub Pages 호스팅 배포
1. GitHub에 새 저장소(`samhyun-class-sharing`)를 생성하고 이 프로젝트 파일들을 푸시합니다.
2. 저장소의 **[Settings] > [Pages]**로 이동합니다.
3. **Build and deployment** 항목의 Branch를 `main` (또는 `master`) / `/ (root)`로 지정하고 **Save**를 클릭합니다.
4. 약 1~2분 후 제공되는 GitHub Pages URL (`https://{user}.github.io/samhyun-class-sharing/`)로 접속하여 웹앱을 이용합니다.

---

## 🔐 기본 관리자 정보

- **기본 관리자 암호**: `admin1234!`
- **암호 변경 방법**: Google 스프레드시트의 `Config` 탭에서 `ADMIN_PASSWORD_HASH` 항목의 값에 원하는 암호의 SHA-256 해시값을 입력하면 변경됩니다.

---

## 💡 데모 모드 (Mock Fallback) 안내
`js/config.js`의 `GAS_API_URL`이 비어있거나 구글 앱스 스크립트와 연결되기 전 단계에서도, 로컬 브라우저에서 `index.html`을 오픈하면 **자동 데모 모드**로 동작합니다.
데모 모드에서는 샘플 수업 목록, 참관 신청 접수, 관리자 로그인(`admin1234!`), 엑셀 다운로드, 명단 인쇄 등 모든 기능을 미리 검증해 보실 수 있습니다.
