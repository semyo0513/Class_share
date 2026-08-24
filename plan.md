# 🏫 삼현 수업나눔한마당 웹 애플리케이션 구축 및 운영 고도화 계획서

---

## 1. 프로젝트 개요 및 아키텍처 설계

### 1.1 추진 배경 및 목적
* **추진 배경**: 삼현 수업나눔한마당 행사의 원활한 운영을 위해 교사 간 수업 나눔 참관 신청, 수업 자료 공유, 공지사항 전달, 질의응답 및 소통을 일원화할 수 있는 통합 웹 플랫폼 구축.
* **구축 목표**: 
  1. 별도의 유료 서버 호스팅이나 복잡한 백엔드 인프라 없이 **완전 무과금(Zero-Cost) Serverless 아키텍처** 구현.
  2. Google 스프레드시트(DB)와 Google Drive(파일 저장소)를 백엔드로 연동하여 비전문가도 데이터 관리 및 백업을 직관적으로 수행.
  3. GitHub Pages를 활용한 고가용성 정적 웹 호스팅 및 형상 관리.
  4. 모바일 및 데스크톱 환경 모두에 최적화된 반응형 UI/UX 제공.

---

### 1.2 전체 시스템 아키텍처 다이어그램

```
+-----------------------------------------------------------------------------------+
|                                 Client Browser                                    |
|   - 교사용 웹앱 UI (수업 탐색, 참관 신청, 게시판, 공지사항)                                    |
|   - 관리자 대시보드 (수업 개설/수정, 첨부파일 업로드, 신청자 명단 조회, 공지 관리)                    |
|   - 기술 스택: HTML5, Tailwind CSS, Vanilla JS (ES6+ Modular), FontAwesome        |
+-----------------------------------------+-----------------------------------------+
                                          | HTTPS Fetch API (JSON / FormData)
                                          v
+-----------------------------------------------------------------------------------+
|                        GitHub Pages (Static Web Hosting)                          |
|   - 저장소: https://github.com/{organization}/samhyun-class-sharing                |
|   - 구성: index.html, config.js, api.js, app.js, admin.js, style.css              |
+-----------------------------------------+-----------------------------------------+
                                          | RESTful API Call (CORS JSONP / POST)
                                          v
+-----------------------------------------------------------------------------------+
|                    Google Apps Script (GAS) Web App Backend                       |
|   - 파일명: Code.gs                                                               |
|   - 배포 형태: Executed as User, Access: Anyone (모든 사용자)                       |
|   - 엔드포인트: doGet(e) [데이터 조회] / doPost(e) [신청/등록/업로드/인증/삭제]              |
|   - 보안 및 비즈니스 로직: LockService(동시성 제어), SHA-256 인증, Base64 파일 디코딩    |
+------------------------------------+----------------------------------------------+
                                     |
           +-------------------------+-------------------------+
           v                                                   v
+------------------------------------+   +------------------------------------------+
|       Google Sheets Database       |   |       Google Drive File Storage          |
|  - Classes (수업 개설 목록)          |   |  - 수업 지도안 및 학습 자료 PDF, HWP, PPT   |
|  - Applications (참관 신청 데이터)  |   |  - 자동 생성 폴더: '삼현수업나눔_첨부자료'    |
|  - Notices (공지사항)               |   |  - 공개 다운로드 URL 자동 추출 및 DB 매핑   |
|  - Board (소통 게시판)              |   +------------------------------------------+
|  - Config (행사 메타데이터/관리자설정)|
+------------------------------------+
```

---

## 2. 데이터베이스 (Google Sheets) 상세 스키마 정의

단일 Google Spreadsheet 파일 내에 총 5개의 시트(Tab)를 생성하고 다음의 컬럼 규격과 제약 조건을 준수하여 운영합니다.

### 2.1 `Classes` 시트 (수업 개설 목록)
수업자가 개설한 공개수업 목록 및 수업 메타데이터를 저장합니다.

| 컬럼 순서 | 컬럼명 (헤더) | 데이터 타입 | 필수 여부 | 설명 및 예시 데이터 |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `id` | String | 필수 | 고유 식별자 (예: `CLS-2026-001`, UUID 기반 자동생성) |
| **B** | `subject` | String | 필수 | 교과명 (예: 국어, 수학, 공통사회, 과학탐구, 융합미술) |
| **C** | `teacher` | String | 필수 | 수업 교사명 (예: 김선생, 박교사) |
| **D** | `gradeGroup` | String | 필수 | 대상 학년/학급 (예: 1학년 3반, 중2 통합반) |
| **E** | `dateTime` | String | 필수 | 수업 일시 (예: `2026-10-15 13:30 ~ 14:20 (5교시)`) |
| **F** | `location` | String | 필수 | 수업 장소 (예: 3층 과학2실, 2학년 4반 교실) |
| **G** | `topic` | String | 필수 | 수업 주제 (예: AI 도구를 활용한 환경문제 탐구 프로젝트) |
| **H** | `description` | Text | 선택 | 수업 의도 및 세부 나눔 포인트 (줄바꿈 허용) |
| **I** | `capacity` | Number | 필수 | 최대 참관 허용 정원 (예: `15`, 0일 경우 무제한) |
| **J** | `fileUrl` | String | 선택 | 수업지도안/학습지 구글 드라이브 다운로드 URL |
| **K** | `fileName` | String | 선택 | 첨부 파일 원본 파일명 (예: `1학년_과학_수업지도안.pdf`) |
| **L** | `createdAt` | DateTime | 자동 | 등록 일시 (`YYYY-MM-DD HH:mm:ss`) |
| **M** | `status` | String | 필수 | 수업 상태 (`ACTIVE`: 개설중, `CLOSED`: 조기마감, `HIDDEN`: 숨김) |

---

### 2.2 `Applications` 시트 (수업 참관 신청자)
사용자가 웹상에서 신청한 인적사항 및 선택 수업 정보를 기록합니다.

| 컬럼 순서 | 컬럼명 (헤더) | 데이터 타입 | 필수 여부 | 설명 및 예시 데이터 |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `timestamp` | DateTime | 자동 | 신청 일시 (`2026-08-24 10:15:30`) |
| **B** | `applicantName` | String | 필수 | 신청자 교사 성명 (예: 홍길동) |
| **C** | `school` | String | 필수 | 소속 학교명 (예: 삼현여자고등학교, 진주고등학교) |
| **D** | `phone` | String | 필수 | 연락처 (예: `010-1234-5678`, 하이픈 통일) |
| **E** | `email` | String | 필수 | 이메일 주소 (예: `teacher@gne.go.kr`) |
| **F** | `classId` | String | 필수 | 신청한 수업 고유 ID (`CLS-2026-001`) |
| **G** | `className` | String | 필수 | 신청 당시 수업명 (예: `[국어] AI 도구를 활용한 논증문 쓰기`) |
| **H** | `remark` | Text | 선택 | 수업자에게 전하고 싶은 말 / 참관 목적 |
| **I** | `status` | String | 기본 | `CONFIRMED`(신청완료), `CANCELLED`(취소) |

---

### 2.3 `Notices` 시트 (공지사항)
주요 행사 일정, 유의사항, 주차 안내 등을 관리합니다.

| 컬럼 순서 | 컬럼명 (헤더) | 데이터 타입 | 필수 여부 | 설명 및 예시 데이터 |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `id` | String | 필수 | 공지 ID (예: `NOT-001`) |
| **B** | `createdAt` | DateTime | 자동 | 공지 등록 일시 |
| **C** | `title` | String | 필수 | 공지사항 제목 |
| **D** | `content` | Text | 필수 | 공지 본문 내용 (HTML/Markdown 지원) |
| **E** | `isPinned` | Boolean | 필수 | 상단 고정 여부 (`TRUE` / `FALSE`) |
| **F** | `author` | String | 필수 | 작성자 (기본: `행사운영본부`) |
| **G** | `fileUrl` | String | 선택 | 첨부파일 링크 |

---

### 2.4 `Board` 시트 (참여자 소통 및 나눔 게시판)
참여 교사들의 사전 질의, 수업 후기, 응원 메시지 등을 공유합니다.

| 컬럼 순서 | 컬럼명 (헤더) | 데이터 타입 | 필수 여부 | 설명 및 예시 데이터 |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `id` | String | 필수 | 게시글 ID (예: `BRD-001`) |
| **B** | `createdAt` | DateTime | 자동 | 작성 일시 |
| **C** | `author` | String | 필수 | 작성자 성명 (예: 이영희) |
| **D** | `school` | String | 필수 | 소속 학교명 |
| **E** | `title` | String | 필수 | 글 제목 |
| **F** | `content` | Text | 필수 | 본문 내용 |
| **G** | `passwordHash` | String | 필수 | 글 삭제/수정용 비밀번호 (단방향 해시 암호화) |
| **H** | `category` | String | 필수 | 카테고리 (`사전질의`, `수업후기`, `자료요청`, `자유소통`) |

---

### 2.5 `Config` 시트 (시스템 환경 설정)
하드코딩을 방지하고 시트 상에서 운영 정책을 동적으로 변경합니다.

| 설정 키 (`Key`) | 설정 값 (`Value`) | 설명 |
| :--- | :--- | :--- |
| `ADMIN_PASSWORD_HASH` | `a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3` | 관리자 암호 SHA-256 (기본값: `admin1234!`) |
| `EVENT_TITLE` | `2026 삼현 수업나눔한마당` | 웹앱 상단 메인 타이틀 |
| `IS_REGISTRATION_OPEN` | `TRUE` | 참관 신청 접수 활성화 여부 (`TRUE`/`FALSE`) |
| `REGISTRATION_START` | `2026-09-01 09:00:00` | 접수 시작 일시 |
| `REGISTRATION_END` | `2026-10-10 18:00:00` | 접수 마감 일시 |
| `DRIVE_FOLDER_ID` | `1a2b3c4d5e6f7g8h9i0j...` | 첨부파일이 저장될 구글 드라이브 폴더 ID |

---

## 3. 백엔드 설계: Google Apps Script (`Code.gs`)

### 3.1 API 통신 프로토콜 및 데이터 흐름 규격

모든 응답은 JSON 표준 형식을 준수하여 프론트엔드로 반환됩니다.

```json
{
  "success": true,
  "code": 200,
  "message": "처리가 성공적으로 완료되었습니다.",
  "data": { ... }
}
```

* **CORS 대응**: GAS의 `ContentService.createTextOutput()`을 사용하고 MIME Type을 `JSON`으로 설정하여 브라우저의 Cross-Origin 통신을 완벽 지원합니다.
* **동시성 락(LockService)**: 다수 사용자가 동시에 마지막 남은 정원을 신청할 때 정원 초과(Overbooking)가 발생하지 않도록 `LockService.getScriptLock()`을 필수 적용합니다.

---

### 3.2 `Code.gs` 전체 핵심 소스코드 구조

```javascript
/**
 * ------------------------------------------------------------------
 * 삼현 수업나눔한마당 통합 API 백엔드 (Google Apps Script)
 * ------------------------------------------------------------------
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// 시트명 상수 정의
const SHEETS = {
  CLASSES: "Classes",
  APPLICATIONS: "Applications",
  NOTICES: "Notices",
  BOARD: "Board",
  CONFIG: "Config"
};

/**
 * GET 요청 라우터 (데이터 조회 전용)
 */
function doGet(e) {
  const params = e.parameter || {};
  const action = params.action;

  try {
    switch (action) {
      case "getInitialData":
        return createJsonResponse(getInitialData());
      case "getClasses":
        return createJsonResponse(getClassesList());
      case "getNotices":
        return createJsonResponse(getNoticesList());
      case "getBoard":
        return createJsonResponse(getBoardList());
      case "getAdminApplications":
        if (!verifyAdminPassword(params.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증에 실패하였습니다." }, 401, false);
        }
        return createJsonResponse(getAllApplications());
      default:
        return createJsonResponse({ error: "올바르지 않은 API Action입니다." }, 400, false);
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() }, 500, false);
  }
}

/**
 * POST 요청 라우터 (데이터 생성, 수정, 삭제, 파일 업로드)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  
  // 최대 10초간 대기하며 Lock 획득 (동시 신청 제어)
  try {
    lock.waitLock(10000);
  } catch (e) {
    return createJsonResponse({ error: "접속자가 많아 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, 429, false);
  }

  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    switch (action) {
      // 1. 사용자 수업 참관 신청
      case "applyClass":
        return createJsonResponse(handleApplyClass(postData.payload));

      // 2. 소통 게시판 글 작성
      case "createBoardPost":
        return createJsonResponse(handleCreateBoardPost(postData.payload));

      // 3. 소통 게시판 글 삭제
      case "deleteBoardPost":
        return createJsonResponse(handleDeleteBoardPost(postData.payload));

      // 4. [관리자] 로그인 검증
      case "adminLogin":
        const isValid = verifyAdminPassword(postData.adminPassword);
        return createJsonResponse({ authorized: isValid }, isValid ? 200 : 401, isValid);

      // 5. [관리자] 수업 개설 및 수정 (파일 첨부 포함)
      case "saveClass":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "인증 실패" }, 401, false);
        }
        return createJsonResponse(handleSaveClass(postData.payload));

      // 6. [관리자] 수업 삭제
      case "deleteClass":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "인증 실패" }, 401, false);
        }
        return createJsonResponse(handleDeleteClass(postData.classId));

      // 7. [관리자] 공지사항 등록/수정
      case "saveNotice":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "인증 실패" }, 401, false);
        }
        return createJsonResponse(handleSaveNotice(postData.payload));

      default:
        return createJsonResponse({ error: "올바르지 않은 POST Action입니다." }, 400, false);
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() }, 500, false);
  } finally {
    lock.releaseLock();
  }
}

/* ==================================================================
 * 비즈니스 로직 함수군
 * ================================================================== */

// 1. 초기 로딩 시 필요한 데이터 일괄 반환 (네트워크 왕복 최소화)
function getInitialData() {
  return {
    classes: getClassesList(),
    notices: getNoticesList(),
    config: getConfigMap()
  };
}

// 2. 수업 목록 조회 (신청 인원 실시간 계산 포함)
function getClassesList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const classSheet = ss.getSheetByName(SHEETS.CLASSES);
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);

  const classData = classSheet.getDataRange().getValues();
  if (classData.length <= 1) return [];

  const headers = classData[0];
  const rows = classData.slice(1);

  // 신청 현황 카운팅 Map 생성
  const appData = appSheet.getDataRange().getValues();
  const applyCountMap = {};
  if (appData.length > 1) {
    for (let i = 1; i < appData.length; i++) {
      const cId = appData[i][5]; // classId 컬럼
      const status = appData[i][8]; // status 컬럼
      if (status !== "CANCELLED") {
        applyCountMap[cId] = (applyCountMap[cId] || 0) + 1;
      }
    }
  }

  const result = [];
  rows.forEach(r => {
    if (r[12] !== "HIDDEN") { // status가 HIDDEN이 아닌 경우만
      const classId = r[0];
      const capacity = Number(r[8]);
      const currentApplied = applyCountMap[classId] || 0;
      
      result.push({
        id: classId,
        subject: r[1],
        teacher: r[2],
        gradeGroup: r[3],
        dateTime: r[4],
        location: r[5],
        topic: r[6],
        description: r[7],
        capacity: capacity,
        currentApplied: currentApplied,
        isFull: capacity > 0 && currentApplied >= capacity,
        fileUrl: r[9],
        fileName: r[10],
        status: r[12]
      });
    }
  });

  return result;
}

// 3. 참관 신청 처리 (중복 신청 및 정원 검증)
function handleApplyClass(payload) {
  const { applicantName, school, phone, email, classId, remark } = payload;

  if (!applicantName || !school || !phone || !classId) {
    throw new Error("필수 입력 항목이 누락되었습니다.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  const classSheet = ss.getSheetByName(SHEETS.CLASSES);

  // 대상 수업 정보 및 정원 확인
  const classRows = classSheet.getDataRange().getValues();
  let targetClass = null;
  for (let i = 1; i < classRows.length; i++) {
    if (classRows[i][0] === classId) {
      targetClass = {
        name: `[${classRows[i][1]}] ${classRows[i][6]} (${classRows[i][2]} 선생님)`,
        capacity: Number(classRows[i][8]),
        status: classRows[i][12]
      };
      break;
    }
  }

  if (!targetClass) throw new Error("존재하지 않는 수업입니다.");
  if (targetClass.status === "CLOSED") throw new Error("해당 수업은 이미 신청 마감되었습니다.");

  // 중복 신청 체크 및 현재 신청인원 계산
  const appRows = appSheet.getDataRange().getValues();
  let currentCount = 0;
  for (let i = 1; i < appRows.length; i++) {
    const rowPhone = String(appRows[i][3]).replace(/[^0-9]/g, "");
    const cleanPhone = String(phone).replace(/[^0-9]/g, "");
    const rowClassId = appRows[i][5];
    const status = appRows[i][8];

    if (status !== "CANCELLED") {
      if (rowClassId === classId) {
        currentCount++;
        if (rowPhone === cleanPhone) {
          throw new Error("이미 동일한 연락처로 신청된 내역이 있습니다.");
        }
      }
    }
  }

  if (targetClass.capacity > 0 && currentCount >= targetClass.capacity) {
    throw new Error("선착순 정원이 마감되어 신청할 수 없습니다.");
  }

  // 스프레드시트 기록
  const timestamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  appSheet.appendRow([
    timestamp,
    applicantName,
    school,
    phone,
    email || "",
    classId,
    targetClass.name,
    remark || "",
    "CONFIRMED"
  ]);

  return { message: "참관 신청이 정상적으로 완료되었습니다.", classTitle: targetClass.name };
}

// 4. 파일 업로드 및 수업 정보 저장 (Google Drive 연동)
function handleSaveClass(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CLASSES);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

  let fileUrl = payload.fileUrl || "";
  let fileName = payload.fileName || "";

  // Base64 파일 업로드 처리
  if (payload.fileData && payload.fileData.base64) {
    const folderId = getConfigValue("DRIVE_FOLDER_ID");
    let targetFolder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    
    const contentType = payload.fileData.mimeType || "application/octet-stream";
    const decodedBytes = Utilities.base64Decode(payload.fileData.base64.split(",")[1]);
    const blob = Utilities.newBlob(decodedBytes, contentType, payload.fileData.name);
    
    const file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    fileUrl = file.getUrl();
    fileName = payload.fileData.name;
  }

  const classId = payload.id || `CLS-${Date.now().toString().slice(-6)}`;
  const rows = sheet.getDataRange().getValues();
  let foundRowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === classId) {
      foundRowIndex = i + 1;
      break;
    }
  }

  const rowData = [
    classId,
    payload.subject,
    payload.teacher,
    payload.gradeGroup,
    payload.dateTime,
    payload.location,
    payload.topic,
    payload.description,
    Number(payload.capacity) || 0,
    fileUrl,
    fileName,
    nowStr,
    payload.status || "ACTIVE"
  ];

  if (foundRowIndex > 0) {
    sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { message: "수업 정보가 성공적으로 저장되었습니다.", classId: classId };
}

// 5. 관리자 비밀번호 검증 (SHA-256)
function verifyAdminPassword(inputPassword) {
  if (!inputPassword) return false;
  const storedHash = getConfigValue("ADMIN_PASSWORD_HASH");
  const inputHash = computeSha256(inputPassword);
  return storedHash === inputHash;
}

function computeSha256(str) {
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return signature.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// 6. JSON 응답 포맷 래퍼
function createJsonResponse(data, statusCode = 200, success = true) {
  const output = {
    success: success,
    status: statusCode,
    data: data
  };
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## 4. 프론트엔드 (GitHub Pages) 아키텍처 및 소스 구조

### 4.1 디렉토리 및 파일 구조

```text
samhyun-class-sharing/
├── index.html              # 단일 페이지 메인 마크업 (SPA 뷰 컨테이너)
├── css/
│   └── custom.css          # 커스텀 애니메이션, 프린트 CSS, 세부 스타일
├── js/
│   ├── config.js           # 환경 설정 (GAS Web App 배포 URL 등)
│   ├── api.js              # Fetch 기반 백엔드 통신 모듈
│   ├── app.js              # 사용자 UI 렌더링, 필터링, 신청 모달 제어
│   └── admin.js            # 관리자 전용 대시보드, 수업/공지/신청자 관리
└── assets/
    ├── favicon.ico
    └── logo.png
```

---

### 4.2 `index.html` 핵심 레이아웃 템플릿

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2026 삼현 수업나눔한마당</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- FontAwesome Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <!-- Pretendard Font -->
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <link rel="stylesheet" href="css/custom.css">
</head>
<body class="bg-slate-50 text-slate-900 font-['Pretendard'] antialiased min-h-screen flex flex-col">

  <!-- 글로벌 네비게이션 바 -->
  <header class="bg-indigo-900 text-white sticky top-0 z-40 shadow-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3 cursor-pointer" onclick="navigateTab('classes')">
        <div class="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-inner">삼</div>
        <div>
          <h1 class="text-lg font-bold leading-tight">삼현 수업나눔한마당</h1>
          <p class="text-xs text-indigo-200">배움과 성장이 함께하는 수업 축제</p>
        </div>
      </div>
      
      <!-- 탭 메뉴 -->
      <nav class="flex items-center space-x-1 sm:space-x-4">
        <button onclick="navigateTab('classes')" id="tabBtn-classes" class="tab-btn px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-800">
          <i class="fa-solid fa-chalkboard-user mr-1"></i> 수업 목록
        </button>
        <button onclick="navigateTab('notices')" id="tabBtn-notices" class="tab-btn px-3 py-2 rounded-md text-sm font-medium text-indigo-200 hover:bg-indigo-800">
          <i class="fa-solid fa-bullhorn mr-1"></i> 공지사항
        </button>
        <button onclick="navigateTab('board')" id="tabBtn-board" class="tab-btn px-3 py-2 rounded-md text-sm font-medium text-indigo-200 hover:bg-indigo-800">
          <i class="fa-solid fa-comments mr-1"></i> 나눔마당
        </button>
        <button onclick="openAdminModal()" class="ml-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-700 hover:bg-indigo-600 text-indigo-100 border border-indigo-500">
          <i class="fa-solid fa-lock mr-1"></i> 관리자
        </button>
      </nav>
    </div>
  </header>

  <!-- 메인 컨텐츠 영역 -->
  <main class="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <!-- 섹션 1: 수업 목록 뷰 -->
    <section id="view-classes" class="tab-content space-y-6">
      <!-- 검색 및 교과 필터 바 -->
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex flex-wrap gap-2 items-center w-full md:w-auto" id="subjectFilterContainer">
          <button onclick="filterSubject('ALL')" class="filter-pill active px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white">전체</button>
          <!-- 교과목 태그 동적 삽입 -->
        </div>
        <div class="relative w-full md:w-72">
          <input type="text" id="classSearchInput" placeholder="교사명, 수업주제 검색..." class="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-sm"></i>
        </div>
      </div>

      <!-- 수업 카드 그리드 -->
      <div id="classListGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- JS로 수업 카드 동적 렌더링 -->
      </div>
    </section>

    <!-- 섹션 2: 공지사항 뷰 -->
    <section id="view-notices" class="tab-content hidden space-y-4">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100" id="noticeListContainer">
        <!-- 공지사항 리스트 렌더링 -->
      </div>
    </section>

    <!-- 섹션 3: 소통 게시판 뷰 -->
    <section id="view-board" class="tab-content hidden space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">질의응답 및 수업 나눔 소통</h2>
        <button onclick="openBoardWriteModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm">
          <i class="fa-solid fa-pen mr-1"></i> 글쓰기
        </button>
      </div>
      <div class="grid grid-cols-1 gap-4" id="boardListContainer">
        <!-- 게시글 카드 렌더링 -->
      </div>
    </section>

    <!-- 섹션 4: 관리자 대시보드 뷰 -->
    <section id="view-admin" class="tab-content hidden space-y-6">
      <!-- 관리자 탭 (수업 개설/관리, 신청자 명단 다운로드, 공지 작성) -->
      <div id="adminPanelContainer"></div>
    </section>

  </main>

  <!-- 수업 참관 신청 모달 -->
  <div id="applyModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scaleUp">
      <div class="flex justify-between items-start border-b border-slate-100 pb-3">
        <div>
          <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded" id="modalClassSubject">국어</span>
          <h3 class="text-lg font-bold text-slate-900 mt-1" id="modalClassTopic">수업 주제명</h3>
          <p class="text-xs text-slate-500" id="modalClassTeacher">홍길동 선생님 | 2층 1반</p>
        </div>
        <button onclick="closeApplyModal()" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>

      <form id="applyForm" onsubmit="submitApplication(event)" class="space-y-4">
        <input type="hidden" id="applyClassId">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">신청자 성명 *</label>
          <input type="text" id="applyName" required placeholder="예: 김교사" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">소속 학교명 *</label>
          <input type="text" id="applySchool" required placeholder="예: 삼현여자중학교" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">연락처 *</label>
            <input type="tel" id="applyPhone" required placeholder="010-0000-0000" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">이메일 *</label>
            <input type="email" id="applyEmail" required placeholder="teacher@gne.go.kr" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">수업자에게 남길 말씀 / 참관 목적</label>
          <textarea id="applyRemark" rows="2" placeholder="수업 나눔에 기대하는 점 등을 편하게 적어주세요." class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"></textarea>
        </div>
        
        <div class="flex justify-end space-x-2 pt-2">
          <button type="button" onclick="closeApplyModal()" class="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">취소</button>
          <button type="submit" id="applySubmitBtn" class="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow">신청 접수</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 모듈 스크립트 로드 -->
  <script src="js/config.js"></script>
  <script src="js/api.js"></script>
  <script src="js/app.js"></script>
  <script src="js/admin.js"></script>
</body>
</html>
```

---

### 4.3 `js/config.js` (설정 모듈)

```javascript
/**
 * 웹 애플리케이션 환경설정
 */
const CONFIG = {
  // Google Apps Script 웹 앱 배포 URL (배포 후 교체)
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbxYOUR_DEPLOYED_GAS_ID_HERE/exec",
  
  // 앱 기본 명칭
  APP_TITLE: "2026 삼현 수업나눔한마당",
  
  // 기본 학과/교과 필터 목록
  SUBJECT_CATEGORIES: ["국어", "수학", "영어", "사회/역사", "과학", "음악/미술/체육", "기술가정/정보", "진로/교양"]
};
```

---

### 4.4 `js/api.js` (API 비동기 통신 클라이언트)

```javascript
/**
 * GAS Backend API 통신 전담 모듈
 */
const API = {
  // GET 요청
  async get(action, params = {}) {
    const url = new URL(CONFIG.GAS_API_URL);
    url.searchParams.append("action", action);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.data?.error || "요청 실패");
      return result.data;
    } catch (error) {
      console.error(`[API GET Error: ${action}]`, error);
      throw error;
    }
  },

  // POST 요청 (CORS Redirect 지원)
  async post(action, payload = {}, adminPassword = null) {
    const bodyData = {
      action: action,
      payload: payload,
      adminPassword: adminPassword
    };

    try {
      const response = await fetch(CONFIG.GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // GAS CORS 안전 헤더
        body: JSON.stringify(bodyData)
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.data?.error || "처리 실패");
      return result.data;
    } catch (error) {
      console.error(`[API POST Error: ${action}]`, error);
      throw error;
    }
  }
};
```

---

## 5. 관리자 기능 및 파일 업로드 처리 고도화

### 5.1 브라우저 파일 인코딩 및 구글 드라이브 업로드 워크플로우

1. **파일 선택**: 관리자가 수업 개설 모달에서 `지도안/학습자료(PDF, HWP, ZIP 등)` 파일을 선택.
2. **Base64 인코딩**: 프론트엔드 `FileReader` API를 통해 파일을 Base64 문자열로 변환.
3. **GAS 전송**: JSON Payload에 `{ name, mimeType, base64 }` 구조로 전달.
4. **드라이브 저장**: GAS `DriveApp.getFolderById()`를 통해 지정 폴더에 저장 후 `ANYONE_WITH_LINK` View 권한 부여.
5. **URL 매핑**: 파일 고유 URL을 `Classes` 시트의 `fileUrl` 컬럼에 자동 기입.

```javascript
// 프론트엔드 파일 읽기 유틸리티 함수
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      mimeType: file.type,
      base64: reader.result
    });
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}
```

---

## 6. 단계별 배포 및 운영 가이드라인

```
 [단계 1] Google 스프레드시트 생성 & 탭/컬럼 구성
    │
    ▼
 [단계 2] Google Drive 첨부파일 폴더 생성 후 Folder ID 복사
    │
    ▼
 [단계 3] Apps Script (Code.gs) 코드 붙여넣기 및 배포
    │    - 배포 유형: 웹 앱 (Web App)
    │    - 다음 사용자 권한으로 실행: '나(내 계정)'
    │    - 액세스 권한이 있는 사용자: '모든 사용자(Anyone)'  <-- 필수!
    │    - 생성된 '웹 앱 URL' 복사
    │
    ▼
 [단계 4] 프론트엔드 config.js에 GAS URL 입력
    │
    ▼
 [단계 5] GitHub 저장소 푸시 & GitHub Pages 활성화
    │    - Repository: Settings > Pages > Deploy from branch (main / root)
    │
    ▼
 [단계 6] 통합 테스트 (수업 개설, 참관 신청, 중복 체크, 명단 엑셀 확인)
```

---

## 7. 시스템 장애 예방 및 운영 체크리스트

| 점검 영역 | 점검 항목 | 대응 방안 및 기준 |
| :--- | :--- | :--- |
| **정원 관리** | 동시 신청 시 초과 접수 방지 | `LockService.getScriptLock()` 적용 및 백엔드 잔여석 재검증 |
| **트래픽 분산** | 단시간 대량 접속 시 쿼터 제한 | `getInitialData` 단일 호출 캐싱 및 클라이언트 로컬 상태 보존 |
| **파일 업로드** | 고용량 첨부파일 전송 실패 방지 | 파일 크기 제한 (최대 15MB 이하 권장), PDF 변환 업로드 권장 |
| **신청자 확인** | 개인정보 노출 방지 | 신청자 명단(`Applications`)은 오직 관리자 비밀번호 인증 시에만 반환 |
| **백업 정책** | 데이터 훼손 방지 | 스프레드시트 '버전 기록' 기능 및 매주 정기 복사본 생성 |