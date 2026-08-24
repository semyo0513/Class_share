/**
 * ==================================================================
 * 🏫 삼현 수업나눔한마당 통합 API 백엔드 (Google Apps Script)
 * ==================================================================
 * - Google Sheets (DB) 연동 및 Google Drive (파일 저장) 연동
 * - LockService를 통한 동시 신청 정원 초과(Overbooking) 방지
 * - SHA-256 해시 기반 관리자 및 게시글 비밀번호 인증
 */

// 글로벌 상수 정의
const SHEETS = {
  CLASSES: "Classes",
  APPLICATIONS: "Applications",
  NOTICES: "Notices",
  BOARD: "Board",
  CONFIG: "Config"
};

/**
 * HTTP GET 요청 라우터 (데이터 조회)
 */
function doGet(e) {
  const params = e ? e.parameter : {};
  const action = params.action;

  try {
    // 자동 시트 구조 초기화 점검
    initDatabaseSheets();

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
 * HTTP POST 요청 라우터 (데이터 생성, 수정, 삭제, 파일 업로드)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  
  // 동시성 제어: 최대 10초간 스크립트 락 획득 대기
  try {
    lock.waitLock(10000);
  } catch (err) {
    return createJsonResponse({ error: "접속자가 많아 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, 429, false);
  }

  try {
    initDatabaseSheets();

    let postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }

    const action = postData.action;

    switch (action) {
      // 1. 참관 신청
      case "applyClass":
        return createJsonResponse(handleApplyClass(postData.payload));

      // 2. 소통 게시판 글 작성
      case "createBoardPost":
        return createJsonResponse(handleCreateBoardPost(postData.payload));

      // 3. 소통 게시판 글 삭제
      case "deleteBoardPost":
        return createJsonResponse(handleDeleteBoardPost(postData.payload));

      // 4. [관리자] 로그인 인증
      case "adminLogin":
        const isValid = verifyAdminPassword(postData.adminPassword);
        return createJsonResponse({ authorized: isValid }, isValid ? 200 : 401, isValid);

      // 5. [관리자] 수업 개설/수정 및 파일 업로드
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

      // 8. [관리자] 공지사항 삭제
      case "deleteNotice":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "인증 실패" }, 401, false);
        }
        return createJsonResponse(handleDeleteNotice(postData.noticeId));

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

/**
 * 웹 앱 초기 데이터 일괄 반환 (네트워크 왕복 횟수 최소화)
 */
function getInitialData() {
  return {
    classes: getClassesList(),
    notices: getNoticesList(),
    config: getConfigMap()
  };
}

/**
 * 개설 수업 목록 조회 (실시간 신청인원 자동 합산)
 */
function getClassesList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const classSheet = ss.getSheetByName(SHEETS.CLASSES);
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);

  if (!classSheet) return [];

  const classData = classSheet.getDataRange().getValues();
  if (classData.length <= 1) return [];

  const rows = classData.slice(1);

  // Applications 시트에서 수업별 참관 신청 인원 계산
  const applyCountMap = {};
  if (appSheet) {
    const appData = appSheet.getDataRange().getValues();
    if (appData.length > 1) {
      for (let i = 1; i < appData.length; i++) {
        const cId = appData[i][5];    // classId 컬럼 (F열)
        const status = appData[i][8]; // status 컬럼 (I열)
        if (status !== "CANCELLED") {
          applyCountMap[cId] = (applyCountMap[cId] || 0) + 1;
        }
      }
    }
  }

  const result = [];
  rows.forEach(r => {
    const status = String(r[12] || "ACTIVE").toUpperCase();
    if (status !== "HIDDEN") {
      const classId = String(r[0]);
      const capacity = Number(r[8]) || 0;
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
        fileUrl: r[9] || "",
        fileName: r[10] || "",
        createdAt: formatDateVal(r[11]),
        status: status
      });
    }
  });

  return result;
}

/**
 * 참관 신청 접수 (연락처 중복 및 선착순 정원 검증)
 */
function handleApplyClass(payload) {
  if (!payload) throw new Error("신청 데이터가 전달되지 않았증니다.");
  
  const { applicantName, school, phone, email, classId, remark } = payload;

  if (!applicantName || !school || !phone || !classId) {
    throw new Error("필수 입력 항목(성명, 소속학교, 연락처, 수업 선택)이 누락되었습니다.");
  }

  // 접수 기간 확인
  const isRegOpen = getConfigValue("IS_REGISTRATION_OPEN");
  if (isRegOpen && isRegOpen.toUpperCase() === "FALSE") {
    throw new Error("현재 수업 참관 신청 접수 기간이 아닙니다.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const classSheet = ss.getSheetByName(SHEETS.CLASSES);
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);

  // 1. 대상 수업 정보 및 정원 확인
  const classRows = classSheet.getDataRange().getValues();
  let targetClass = null;
  for (let i = 1; i < classRows.length; i++) {
    if (String(classRows[i][0]) === String(classId)) {
      targetClass = {
        id: String(classRows[i][0]),
        subject: classRows[i][1],
        teacher: classRows[i][2],
        topic: classRows[i][6],
        name: `[${classRows[i][1]}] ${classRows[i][6]} (${classRows[i][2]} 선생님)`,
        capacity: Number(classRows[i][8]) || 0,
        status: String(classRows[i][12] || "ACTIVE").toUpperCase()
      };
      break;
    }
  }

  if (!targetClass) throw new Error("존재하지 않는 수업입니다.");
  if (targetClass.status === "CLOSED") throw new Error("해당 수업은 이미 신청 마감되었습니다.");

  // 2. 중복 신청 체크 및 현재 신청 인원 계산
  const appRows = appSheet.getDataRange().getValues();
  let currentCount = 0;
  const cleanPhone = String(phone).replace(/[^0-9]/g, "");

  for (let i = 1; i < appRows.length; i++) {
    const rowClassId = String(appRows[i][5]);
    const status = String(appRows[i][8]);

    if (status !== "CANCELLED") {
      if (rowClassId === String(classId)) {
        currentCount++;
        const rowPhone = String(appRows[i][3]).replace(/[^0-9]/g, "");
        if (rowPhone === cleanPhone) {
          throw new Error("동일한 연락처로 이미 해당 수업을 신청하셨습니다.");
        }
      }
    }
  }

  // 3. 선착순 정원 마감 검증
  if (targetClass.capacity > 0 && currentCount >= targetClass.capacity) {
    throw new Error("선착순 정원이 마감되어 신청할 수 없습니다.");
  }

  // 4. 시트에 데이터 저장
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

  return { 
    message: "참관 신청이 정상적으로 완료되었습니다.", 
    classTitle: targetClass.name,
    applicantName: applicantName
  };
}

/**
 * 전체 참관 신청자 명단 반환 (관리자 전용)
 */
function getAllApplications() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (!appSheet) return [];

  const appData = appSheet.getDataRange().getValues();
  if (appData.length <= 1) return [];

  const rows = appData.slice(1);
  return rows.map((r, index) => ({
    rowNum: index + 2,
    timestamp: formatDateVal(r[0]),
    applicantName: r[1],
    school: r[2],
    phone: r[3],
    email: r[4],
    classId: r[5],
    className: r[6],
    remark: r[7],
    status: r[8]
  }));
}

/**
 * 수업 개설 및 수정 (Google Drive 파일 업로드 처리 포함)
 */
function handleSaveClass(payload) {
  if (!payload) throw new Error("수업 저장 데이터가 없습니다.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CLASSES);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

  let fileUrl = payload.fileUrl || "";
  let fileName = payload.fileName || "";

  // Base64 바이너리 파일 업로드 처리
  if (payload.fileData && payload.fileData.base64) {
    try {
      const folderId = getConfigValue("DRIVE_FOLDER_ID");
      let targetFolder = DriveApp.getRootFolder();
      
      if (folderId && folderId.trim() !== "") {
        try {
          targetFolder = DriveApp.getFolderById(folderId.trim());
        } catch (e) {
          Logger.log("지정된 폴더를 찾을 수 없어 루트 폴더에 저장합니다: " + e.toString());
        }
      }
      
      const contentType = payload.fileData.mimeType || "application/octet-stream";
      const base64Str = payload.fileData.base64.includes(",") 
        ? payload.fileData.base64.split(",")[1] 
        : payload.fileData.base64;
      
      const decodedBytes = Utilities.base64Decode(base64Str);
      const blob = Utilities.newBlob(decodedBytes, contentType, payload.fileData.name);
      
      const file = targetFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      fileUrl = file.getUrl();
      fileName = payload.fileData.name;
    } catch (fileErr) {
      Logger.log("파일 업로드 실패: " + fileErr.toString());
      throw new Error("파일 업로드 중 오류가 발생하였습니다: " + fileErr.toString());
    }
  }

  const classId = payload.id || `CLS-${Date.now().toString().slice(-6)}`;
  const rows = sheet.getDataRange().getValues();
  let foundRowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(classId)) {
      foundRowIndex = i + 1;
      break;
    }
  }

  const rowData = [
    classId,
    payload.subject || "",
    payload.teacher || "",
    payload.gradeGroup || "",
    payload.dateTime || "",
    payload.location || "",
    payload.topic || "",
    payload.description || "",
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

  return { message: "수업 정보가 정상적으로 저장되었습니다.", classId: classId };
}

/**
 * 수업 정보 삭제/숨김 처리
 */
function handleDeleteClass(classId) {
  if (!classId) throw new Error("삭제할 수업 ID가 전달되지 않았습니다.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CLASSES);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(classId)) {
      sheet.deleteRow(i + 1);
      return { message: "수업이 성공적으로 삭제되었습니다." };
    }
  }

  throw new Error("해당 수업을 찾을 수 없습니다.");
}

/**
 * 공지사항 목록 조회
 */
function getNoticesList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.NOTICES);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const rows = data.slice(1);
  const result = rows.map(r => ({
    id: String(r[0]),
    createdAt: formatDateVal(r[1]),
    title: r[2],
    content: r[3],
    isPinned: String(r[4]).toUpperCase() === "TRUE" || r[4] === true,
    author: r[5] || "행사운영본부",
    fileUrl: r[6] || ""
  }));

  // 상단 고정 및 작성일시 내림차순 정렬
  return result.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/**
 * 공지사항 등록 및 수정
 */
function handleSaveNotice(payload) {
  if (!payload) throw new Error("공지사항 데이터가 없습니다.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.NOTICES);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

  const noticeId = payload.id || `NOT-${Date.now().toString().slice(-6)}`;
  const rows = sheet.getDataRange().getValues();
  let foundRowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(noticeId)) {
      foundRowIndex = i + 1;
      break;
    }
  }

  const rowData = [
    noticeId,
    nowStr,
    payload.title || "",
    payload.content || "",
    payload.isPinned ? "TRUE" : "FALSE",
    payload.author || "행사운영본부",
    payload.fileUrl || ""
  ];

  if (foundRowIndex > 0) {
    sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { message: "공지사항이 성공적으로 저장되었습니다.", noticeId: noticeId };
}

/**
 * 공지사항 삭제
 */
function handleDeleteNotice(noticeId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.NOTICES);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(noticeId)) {
      sheet.deleteRow(i + 1);
      return { message: "공지사항이 성공적으로 삭제되었습니다." };
    }
  }

  throw new Error("삭제할 공지사항을 찾지 못했습니다.");
}

/**
 * 게시판 글 목록 조회
 */
function getBoardList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.BOARD);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const rows = data.slice(1);
  return rows.map(r => ({
    id: String(r[0]),
    createdAt: formatDateVal(r[1]),
    author: r[2],
    school: r[3],
    title: r[4],
    content: r[5],
    category: r[7] || "자유소통"
  })).reverse(); // 최신글 순
}

/**
 * 게시판 글 작성
 */
function handleCreateBoardPost(payload) {
  if (!payload || !payload.title || !payload.content || !payload.author || !payload.password) {
    throw new Error("성명, 비밀번호, 제목, 내용은 필수 입력 항목입니다.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.BOARD);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  const postId = `BRD-${Date.now().toString().slice(-6)}`;
  const pwHash = computeSha256(payload.password);

  sheet.appendRow([
    postId,
    nowStr,
    payload.author,
    payload.school || "",
    payload.title,
    payload.content,
    pwHash,
    payload.category || "자유소통"
  ]);

  return { message: "게시글이 성공적으로 등록되었습니다." };
}

/**
 * 게시판 글 삭제 (비밀번호 검증)
 */
function handleDeleteBoardPost(payload) {
  if (!payload || !payload.postId || !payload.password) {
    throw new Error("게시글 ID와 비밀번호를 입력해주세요.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.BOARD);
  const rows = sheet.getDataRange().getValues();
  const inputHash = computeSha256(payload.password);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(payload.postId)) {
      const storedHash = String(rows[i][6]);
      if (storedHash !== inputHash && !verifyAdminPassword(payload.password)) {
        throw new Error("비밀번호가 일치하지 않습니다.");
      }
      sheet.deleteRow(i + 1);
      return { message: "게시글이 성공적으로 삭제되었습니다." };
    }
  }

  throw new Error("삭제하려는 게시글을 찾을 수 없습니다.");
}

/* ==================================================================
 * 유틸리티 & 환경설정 함수군
 * ================================================================== */

function getConfigMap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      config[String(data[i][0]).trim()] = String(data[i][1]);
    }
  }
  return config;
}

function getConfigValue(key) {
  const configMap = getConfigMap();
  return configMap[key] || null;
}

function verifyAdminPassword(inputPassword) {
  if (!inputPassword) return false;
  // 기본 비밀번호 admin1234! 의 SHA-256 해시
  const defaultHash = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
  const storedHash = getConfigValue("ADMIN_PASSWORD_HASH") || defaultHash;
  const inputHash = computeSha256(inputPassword);
  return storedHash === inputHash;
}

function computeSha256(str) {
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(str), Utilities.Charset.UTF_8);
  return signature.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function createJsonResponse(data, statusCode = 200, success = true) {
  const output = {
    success: success,
    status: statusCode,
    data: data
  };
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDateVal(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  }
  return String(val);
}

/**
 * 데이터베이스 시트 자동 세팅 (최초 실행 시 미존재 시트 생성)
 */
function initDatabaseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Classes 시트
  let classesSheet = ss.getSheetByName(SHEETS.CLASSES);
  if (!classesSheet) {
    classesSheet = ss.insertSheet(SHEETS.CLASSES);
    classesSheet.appendRow(["id", "subject", "teacher", "gradeGroup", "dateTime", "location", "topic", "description", "capacity", "fileUrl", "fileName", "createdAt", "status"]);
  }

  // 2. Applications 시트
  let appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (!appSheet) {
    appSheet = ss.insertSheet(SHEETS.APPLICATIONS);
    appSheet.appendRow(["timestamp", "applicantName", "school", "phone", "email", "classId", "className", "remark", "status"]);
  }

  // 3. Notices 시트
  let noticeSheet = ss.getSheetByName(SHEETS.NOTICES);
  if (!noticeSheet) {
    noticeSheet = ss.insertSheet(SHEETS.NOTICES);
    noticeSheet.appendRow(["id", "createdAt", "title", "content", "isPinned", "author", "fileUrl"]);
  }

  // 4. Board 시트
  let boardSheet = ss.getSheetByName(SHEETS.BOARD);
  if (!boardSheet) {
    boardSheet = ss.insertSheet(SHEETS.BOARD);
    boardSheet.appendRow(["id", "createdAt", "author", "school", "title", "content", "passwordHash", "category"]);
  }

  // 5. Config 시트
  let configSheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEETS.CONFIG);
    configSheet.appendRow(["Key", "Value", "Description"]);
    configSheet.appendRow(["ADMIN_PASSWORD_HASH", "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3", "관리자 비밀번호 SHA-256 해시 (기본: admin1234!)"]);
    configSheet.appendRow(["EVENT_TITLE", "2026 삼현 수업나눔한마당", "행사 메인 제목"]);
    configSheet.appendRow(["IS_REGISTRATION_OPEN", "TRUE", "참관 신청 가능 여부 (TRUE/FALSE)"]);
    configSheet.appendRow(["DRIVE_FOLDER_ID", "", "첨부파일이 업로드될 Google Drive 폴더 ID"]);
  }
}
