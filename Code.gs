/**
 * ==================================================================
 * 🏫 삼현 수업나눔한마당 통합 API 백엔드 (Google Apps Script)
 * ==================================================================
 * - Google Sheets (DB) 연동 및 Google Drive (파일 저장) 연동
 * - Config 시트에서 지정한 DRIVE_FOLDER_ID 구글 드라이브 폴더 자동 연결
 * - LockService를 통한 동시 신청 정원 초과(Overbooking) 방지
 * - CacheService (서버측 캐시) 적용으로 5초 -> 0.2초 초고속 데이터 응답 지원
 * - 관리자, 게시글 및 참관신청 비밀번호 인증 (앞자리 0 보존 처리 포함)
 * - 비밀번호 기반 참관 신청 조회 / 수정 / 취소 API 지원
 * - 관리자 수업 마감 기한 및 수동 마감 스위치 지원
 * - 수업지도안, 공지사항, 게시판 Q&A 구글 드라이브 첨부파일 업로드 및 비밀글 지원
 */

const SPREADSHEET_ID = "1iQnVQPQf260BkTV1vrN4ZgtGEM1aybBMO2wB089HD_0";
const CERT_TEMPLATE_DOC_ID = "1yeKY8DQzxj3CxRzolcsLJSM6XWpk2Ggd2IWFKr2prvQ";

const SHEETS = {
  CLASSES: "Classes",
  APPLICATIONS: "Applications",
  NOTICES: "Notices",
  BOARD: "Board",
  OBSERVATIONS: "Observations",
  CONFIG: "Config"
};

/**
 * 🔑 [권한 승인용 1회 실행 함수]
 * Apps Script 에디터 상단 함수 드롭다운에서 'authorizeAndTestPermissions'를 선택하고 [실행] 버튼을 누르면
 * Google Docs, Gmail, Drive, Sheets 권한 승인 팝업이 즉시 뜨며 권한이 영구 부여됩니다.
 */
function authorizeAndTestPermissions() {
  Logger.log("=== Google 서비스 권한 승인 및 점검 시작 ===");
  
  // 1. Spreadsheet 권한
  const ss = getSpreadsheet();
  Logger.log("✔ Spreadsheet 연결 성공: " + ss.getName());
  
  // 2. Drive 권한
  const folder = getTargetDriveFolder();
  Logger.log("✔ Drive 연결 성공: " + folder.getName());
  
  // 3. DocumentApp 권한 (참관 확인서 템플릿 접근)
  const templateDoc = DocumentApp.openById(CERT_TEMPLATE_DOC_ID);
  Logger.log("✔ Google Docs 템플릿 접근 성공: " + templateDoc.getName());
  
  // 4. MailApp 권한
  const quota = MailApp.getRemainingDailyQuota();
  Logger.log("✔ MailApp 일일 잔여 발송 가능량: " + quota + "건");
  
  Logger.log("🎉 모든 권한 승인이 정상적으로 완료되었습니다!");
  return "모든 권한 승인 완료";
}

function getSpreadsheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (err) {
      Logger.log("SPREADSHEET_ID 접근 실패: " + err.toString());
    }
  }

  throw new Error("Google 스프레드시트를 찾을 수 없습니다. 스프레드시트의 [확장 프로그램] > [Apps Script] 메뉴에서 스크립트를 생성 및 실행하시거나, Code.gs 상단의 SPREADSHEET_ID를 설정해주세요.");
}

function doGet(e) {
  const params = e ? e.parameter : {};
  const action = params.action;

  try {
    // ⚡ 1. 초고속 캐시 반환 (ScriptCache 체크) - initDatabaseSheets() 실행 전 즉시 반환
    const cache = CacheService.getScriptCache();
    if (action === "getInitialData") {
      const cached = cache.get("INITIAL_DATA_CACHE_V3");
      if (cached) {
        try {
          return createJsonResponse(JSON.parse(cached));
        } catch (err) {}
      }
    } else if (action === "getClasses") {
      const cached = cache.get("CLASSES_LIST_CACHE_V3");
      if (cached) {
        try {
          return createJsonResponse(JSON.parse(cached));
        } catch (err) {}
      }
    }

    initDatabaseSheets();

    switch (action) {
      case "getInitialData":
        return createJsonResponse(getInitialData());
      case "getClasses":
        return createJsonResponse(getClassesList());
      case "getNotices":
        return createJsonResponse(getNoticesList());
      case "getBoard":
        return createJsonResponse(getBoardList(params.adminPassword));
      case "getObservations":
        return createJsonResponse(getObservationLogsList(params.adminPassword));
      case "getConfig":
        return createJsonResponse(getConfigMap());
      case "getAdminApplications":
        if (!verifyAdminPassword(params.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증 실패 (비밀번호 오류)" }, 401, false);
        }
        return createJsonResponse(getAllApplications());
      case "checkMyApplications":
        return createJsonResponse(handleCheckMyApplications(params.applicantName, params.phone, params.password));
      default:
        return createJsonResponse({ error: "올바르지 않은 API Action입니다." }, 400, false);
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() }, 500, false);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  
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
      case "applyClass":
        return createJsonResponse(handleApplyClass(postData.payload));

      case "checkMyApplications":
        return createJsonResponse(handleCheckMyApplications(
          postData.payload ? postData.payload.applicantName : "", 
          postData.payload ? postData.payload.phone : "", 
          postData.payload ? postData.payload.password : ""
        ));

      case "updateMyApplication":
        return createJsonResponse(handleUpdateMyApplication(postData.payload));

      case "cancelMyApplication":
        return createJsonResponse(handleCancelMyApplication(postData.payload));

      case "createBoardPost":
        return createJsonResponse(handleCreateBoardPost(postData.payload));
      case "deleteBoardPost":
        return createJsonResponse(handleDeleteBoardPost(postData.payload, postData.adminPassword));

      case "adminLogin":
        const isValid = verifyAdminPassword(postData.adminPassword);
        if (isValid) {
          return createJsonResponse({ authorized: true, message: "관리자 로그인 성공" }, 200, true);
        } else {
          return createJsonResponse({ error: "관리자 비밀번호가 올바르지 않습니다." }, 401, false);
        }

      case "saveClass":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증 실패 (비밀번호가 일치하지 않습니다)" }, 401, false);
        }
        return createJsonResponse(handleSaveClass(postData.payload));

      case "deleteClass":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증 실패" }, 401, false);
        }
        return createJsonResponse(handleDeleteClass(postData.classId));

      case "toggleClassStatus":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증 실패" }, 401, false);
        }
        return createJsonResponse(handleToggleClassStatus(postData.payload));

      case "saveNotice":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증 실패" }, 401, false);
        }
        return createJsonResponse(handleSaveNotice(postData.payload));

      case "deleteNotice":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증 실패" }, 401, false);
        }
        return createJsonResponse(handleDeleteNotice(postData.noticeId));

      case "saveConfig":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증 실패" }, 401, false);
        }
        return createJsonResponse(handleSaveConfig(postData.payload));

      case "toggleAttendance":
        if (!verifyAdminPassword(postData.adminPassword)) {
          return createJsonResponse({ error: "관리자 인증 실패" }, 401, false);
        }
        return createJsonResponse(handleToggleAttendance(postData.payload));

      case "createObservationLog":
        return createJsonResponse(handleCreateObservationLog(postData.payload));

      case "deleteObservationLog":
        return createJsonResponse(handleDeleteObservationLog(postData.payload, postData.adminPassword));

      default:
        return createJsonResponse({ error: "올바르지 않은 POST Action입니다." }, 400, false);
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() }, 500, false);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 서버측 캐싱 (CacheService 적용) - 5초 지연 해결
 */
function getInitialData() {
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get("INITIAL_DATA_CACHE_V3");

  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch (e) {}
  }

  const freshData = {
    classes: getClassesList(),
    notices: getNoticesList(),
    config: getConfigMap()
  };

  try {
    cache.put("INITIAL_DATA_CACHE_V3", JSON.stringify(freshData), 600); // 10분 캐싱
  } catch (e) {
    Logger.log("Cache error: " + e.toString());
  }

  return freshData;
}

function clearInitialDataCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(["INITIAL_DATA_CACHE_V3", "CLASSES_LIST_CACHE_V3", "NOTICES_LIST_CACHE_V2"]);
  } catch (e) {}
}

function getClassesList() {
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get("CLASSES_LIST_CACHE_V3");
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch (e) {}
  }

  const ss = getSpreadsheet();
  let classSheet = ss.getSheetByName(SHEETS.CLASSES);
  if (!classSheet) {
    initDatabaseSheets();
    classSheet = ss.getSheetByName(SHEETS.CLASSES);
  }

  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (!classSheet) return [];

  const classData = classSheet.getDataRange().getValues();
  if (classData.length <= 1) return [];

  const rows = classData.slice(1);
  const now = new Date();

  const applyCountMap = {};
  if (appSheet) {
    const appData = appSheet.getDataRange().getValues();
    if (appData.length > 1) {
      for (let i = 1; i < appData.length; i++) {
        const cId = String(appData[i][5]);
        const status = String(appData[i][8]);
        if (status !== "CANCELLED") {
          applyCountMap[cId] = (applyCountMap[cId] || 0) + 1;
        }
      }
    }
  }

  const result = [];
  rows.forEach(r => {
    let status = String(r[12] || "ACTIVE").toUpperCase();
    if (status !== "HIDDEN") {
      const classId = String(r[0]);
      const capacity = Number(r[8]) || 0;
      const currentApplied = applyCountMap[classId] || 0;
      const deadline = r[13] ? formatDateVal(r[13]) : "";

      let isDeadlinePassed = false;
      if (deadline) {
        const deadlineDate = new Date(deadline);
        if (!isNaN(deadlineDate.getTime()) && now > deadlineDate) {
          isDeadlinePassed = true;
        }
      }

      const isFull = (capacity > 0 && currentApplied >= capacity) || status === "CLOSED" || isDeadlinePassed;

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
        isFull: isFull,
        isDeadlinePassed: isDeadlinePassed,
        fileUrl: r[9] || "",
        fileName: r[10] || "",
        createdAt: formatDateVal(r[11]),
        status: status,
        deadline: deadline
      });
    }
  });

  try {
    cache.put("CLASSES_LIST_CACHE_V3", JSON.stringify(result), 600);
  } catch (e) {}

  return result;
}

function handleApplyClass(payload) {
  if (!payload) throw new Error("신청 데이터가 전달되지 않았습니다.");
  
  const { applicantName, school, phone, email, classId, remark, password } = payload;

  if (!classId) {
    throw new Error("신청 대상 수업 정보가 누락되었습니다.");
  }

  const rawPassword = password ? String(password).trim() : "";
  if (!rawPassword || rawPassword.length < 4) {
    throw new Error("신청 확인 및 취소에 사용할 4자리 이상 비밀번호를 입력해주세요.");
  }

  const isRegOpen = getConfigValue("IS_REGISTRATION_OPEN");
  if (isRegOpen && isRegOpen.toUpperCase() === "FALSE") {
    throw new Error("현재 수업 참관 신청 접수 기간이 아닙니다.");
  }

  const configMap = getConfigMap();
  const requireName = (configMap.REQUIRE_NAME || "TRUE").toUpperCase() === "TRUE";
  const requireSchoolExternal = (configMap.REQUIRE_SCHOOL_EXTERNAL || "TRUE").toUpperCase() === "TRUE";
  const requirePhone = (configMap.REQUIRE_PHONE || "FALSE").toUpperCase() === "TRUE";
  const requireEmail = (configMap.REQUIRE_EMAIL || "FALSE").toUpperCase() === "TRUE";

  const teacherType = payload.teacherType || "INTERNAL";

  if (requireName && (!applicantName || !applicantName.trim())) {
    throw new Error("신청자 교사 성명을 입력해 주세요.");
  }
  if (teacherType === "EXTERNAL" && requireSchoolExternal && (!school || !school.trim())) {
    throw new Error("외부 교원의 경우 소속 학교명을 필수 입력해 주세요.");
  }
  if (requirePhone && (!phone || !phone.trim())) {
    throw new Error("연락처를 입력해 주세요.");
  }
  if (requireEmail && (!email || !email.trim())) {
    throw new Error("이메일 주소를 입력해 주세요.");
  }

  const ss = getSpreadsheet();
  const classSheet = ss.getSheetByName(SHEETS.CLASSES);
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);

  const classRows = classSheet.getDataRange().getValues();
  let targetClass = null;
  for (let i = 1; i < classRows.length; i++) {
    if (String(classRows[i][0]) === String(classId)) {
      const deadlineStr = classRows[i][13] ? formatDateVal(classRows[i][13]) : "";
      targetClass = {
        id: String(classRows[i][0]),
        subject: classRows[i][1],
        teacher: classRows[i][2],
        topic: classRows[i][6],
        name: `[${classRows[i][1]}] ${classRows[i][6]} (${classRows[i][2]} 선생님)`,
        capacity: Number(classRows[i][8]) || 0,
        status: String(classRows[i][12] || "ACTIVE").toUpperCase(),
        deadline: deadlineStr
      };
      break;
    }
  }

  if (!targetClass) throw new Error("존재하지 않는 수업입니다.");
  if (targetClass.status === "CLOSED") throw new Error("해당 수업은 관리자에 의해 마감 처리되었습니다.");

  if (targetClass.deadline) {
    const deadlineDate = new Date(targetClass.deadline);
    if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
      throw new Error("해당 수업의 신청 마감 기한이 경과되었습니다.");
    }
  }

  const appRows = appSheet.getDataRange().getValues();
  let currentCount = 0;
  const cleanPhone = phone ? String(phone).replace(/[^0-9]/g, "") : "";

  for (let i = 1; i < appRows.length; i++) {
    const rowClassId = String(appRows[i][5]);
    const status = String(appRows[i][8]);

    if (status !== "CANCELLED") {
      if (rowClassId === String(classId)) {
        currentCount++;
        if (cleanPhone) {
          const rowPhone = String(appRows[i][3]).replace(/[^0-9]/g, "");
          if (rowPhone && rowPhone === cleanPhone) {
            throw new Error("동일한 연락처로 이미 해당 수업을 신청하셨습니다.");
          }
        }
      }
    }
  }

  if (targetClass.capacity > 0 && currentCount >= targetClass.capacity) {
    throw new Error("선착순 정원이 마감되어 신청할 수 없습니다.");
  }

  const timestamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  
  // 구글 시트 텍스트 단할표(') 처리
  const textPhone = phone ? "'" + String(phone).trim() : "";
  const textPassword = "'" + rawPassword;

  appSheet.appendRow([
    timestamp,
    applicantName || "(미입력)",
    school || "",
    textPhone,
    email || "",
    classId,
    targetClass.name,
    remark || "",
    "CONFIRMED",
    textPassword
  ]);

  // 참관 기대사항(remark)이 작성된 경우 소통/Q&A 나눔마당(Board)에 자동 게시글 등록
  if (remark && String(remark).trim() !== "") {
    try {
      let boardSheet = ss.getSheetByName(SHEETS.BOARD);
      if (!boardSheet) {
        initDatabaseSheets();
        boardSheet = ss.getSheetByName(SHEETS.BOARD);
      }
      const boardId = `BRD-${Date.now().toString().slice(-6)}`;
      const authorName = applicantName && String(applicantName).trim() !== "" ? String(applicantName).trim() : "선생님";
      const authorSchool = school && String(school).trim() !== "" ? String(school).trim() : (teacherType === "INTERNAL" ? "삼현여자중학교" : "");
      const boardTitle = `[참관기대평] [${targetClass.subject}] (${targetClass.teacher} 선생님)`;
      const boardContent = `💡 참관 기대평 / 수업자 전달 한마디:\n${String(remark).trim()}`;

      boardSheet.appendRow([
        boardId,
        timestamp,
        authorName,
        authorSchool,
        boardTitle,
        boardContent,
        textPassword,
        "자유소통",
        "FALSE",
        "",
        ""
      ]);
    } catch (boardErr) {
      Logger.log("참관 기대평 게시판 자동 등록 실패: " + boardErr.toString());
    }
  }

  clearInitialDataCache();

  return { 
    message: remark && String(remark).trim() !== "" 
      ? "참관 신청이 완료되었으며, 참관 기대평이 나눔마당(게시판)에 자동 등록되었습니다." 
      : "참관 신청이 정상적으로 완료되었습니다.", 
    classTitle: targetClass.name,
    applicantName: applicantName || "(미입력)"
  };
}

/**
 * 비밀번호 일치 여부 다각도 안전 검증
 */
function isPasswordMatch(inputPassword, storedValue) {
  if (!inputPassword || storedValue === undefined || storedValue === null) return false;

  const rawInput = String(inputPassword).trim();
  let rawStored = String(storedValue).trim();

  if (rawStored.startsWith("'")) {
    rawStored = rawStored.substring(1);
  }

  if (rawInput === "" || rawStored === "") return false;

  if (rawInput === rawStored) return true;

  const inputHash = computeSha256(rawInput);
  if (inputHash === rawStored) return true;

  const strippedInput = rawInput.replace(/^0+/, "");
  const strippedStored = rawStored.replace(/^0+/, "");

  if (strippedInput !== "" && strippedInput === strippedStored) return true;
  if (strippedInput !== "" && computeSha256(strippedInput) === rawStored) return true;

  return false;
}

function handleCheckMyApplications(applicantName, phone, password) {
  const rawPassword = password ? String(password).trim() : "";
  const rawPhone = phone ? String(phone).trim() : "";

  if (!rawPassword && !rawPhone) {
    throw new Error("신청 시 설정한 비밀번호를 입력해주세요.");
  }

  const ss = getSpreadsheet();
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (!appSheet) return [];

  const appData = appSheet.getDataRange().getValues();
  if (appData.length <= 1) return [];

  const cleanInputName = applicantName ? String(applicantName).trim() : "";
  const cleanInputPhone = rawPhone ? rawPhone.replace(/[^0-9]/g, "") : "";

  const result = [];

  for (let i = 1; i < appData.length; i++) {
    const r = appData[i];
    const rowName = String(r[1]).trim();
    const rowPhone = String(r[3]).replace(/[^0-9]/g, "");
    const status = String(r[8]);
    const storedPw = r[9];

    if (status !== "CANCELLED") {
      let isMatch = false;

      if (rawPassword && isPasswordMatch(rawPassword, storedPw)) {
        isMatch = true;
        if (cleanInputName && rowName && rowName !== "(미입력)" && rowName !== cleanInputName) {
          isMatch = false;
        }
      } else if (!rawPassword && cleanInputName && cleanInputPhone) {
        if (rowName === cleanInputName && rowPhone === cleanInputPhone) {
          isMatch = true;
        }
      }

      if (isMatch) {
        result.push({
          rowNum: i + 1,
          timestamp: formatDateVal(r[0]),
          applicantName: r[1],
          school: r[2],
          phone: r[3],
          email: r[4],
          classId: r[5],
          className: r[6],
          remark: r[7],
          status: r[8]
        });
      }
    }
  }

  return result;
}

function handleUpdateMyApplication(payload) {
  if (!payload || !payload.classId || !payload.password) {
    throw new Error("수정할 수업 ID와 비밀번호가 필요합니다.");
  }

  const ss = getSpreadsheet();
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  const appRows = appSheet.getDataRange().getValues();
  const rawPassword = String(payload.password).trim();
  const cleanInputPhone = payload.phone ? String(payload.phone).replace(/[^0-9]/g, "") : "";

  for (let i = 1; i < appRows.length; i++) {
    const rowPhone = String(appRows[i][3]).replace(/[^0-9]/g, "");
    const rowClassId = String(appRows[i][5]);
    const status = String(appRows[i][8]);
    const storedPw = appRows[i][9];

    if (rowClassId === String(payload.classId) && status !== "CANCELLED") {
      const isMatch = isPasswordMatch(rawPassword, storedPw) || (cleanInputPhone && rowPhone === cleanInputPhone);
      if (isMatch) {
        appSheet.getRange(i + 1, 3).setValue(payload.school || "");
        appSheet.getRange(i + 1, 5).setValue(payload.email || "");
        appSheet.getRange(i + 1, 8).setValue(payload.remark || "");
        clearInitialDataCache();
        return { message: "참관 신청 정보가 성공적으로 수정되었습니다." };
      }
    }
  }

  throw new Error("비밀번호가 일치하지 않거나 수정할 신청 내역을 찾을 수 없습니다.");
}

function handleCancelMyApplication(payload) {
  if (!payload || !payload.classId || !payload.password) {
    throw new Error("취소할 수업 ID와 비밀번호를 입력해주세요.");
  }

  const ss = getSpreadsheet();
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  const appRows = appSheet.getDataRange().getValues();
  const rawPassword = String(payload.password).trim();
  const cleanInputPhone = payload.phone ? String(payload.phone).replace(/[^0-9]/g, "") : "";

  for (let i = 1; i < appRows.length; i++) {
    const rowPhone = String(appRows[i][3]).replace(/[^0-9]/g, "");
    const rowClassId = String(appRows[i][5]);
    const status = String(appRows[i][8]);
    const storedPw = appRows[i][9];

    if (rowClassId === String(payload.classId) && status !== "CANCELLED") {
      const isMatch = isPasswordMatch(rawPassword, storedPw) || (cleanInputPhone && rowPhone === cleanInputPhone);
      if (isMatch) {
        appSheet.getRange(i + 1, 9).setValue("CANCELLED");
        clearInitialDataCache();
        return { message: "참관 신청이 정상적으로 취소되었습니다." };
      }
    }
  }

  throw new Error("비밀번호가 일치하지 않거나 취소할 신청 내역을 찾지 못했습니다.");
}

function handleToggleClassStatus(payload) {
  if (!payload || !payload.classId) throw new Error("수업 ID가 필요합니다.");

  const ss = getSpreadsheet();
  const classSheet = ss.getSheetByName(SHEETS.CLASSES);
  const rows = classSheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(payload.classId)) {
      const currentStatus = String(rows[i][12] || "ACTIVE").toUpperCase();
      const newStatus = payload.status ? payload.status.toUpperCase() : (currentStatus === "CLOSED" ? "ACTIVE" : "CLOSED");
      classSheet.getRange(i + 1, 13).setValue(newStatus);
      clearInitialDataCache();
      return { message: `수업 상태가 [${newStatus === "CLOSED" ? "신청 마감" : "신청 가능"}]으로 변경되었습니다.`, newStatus };
    }
  }

  throw new Error("수업을 찾을 수 없습니다.");
}

function handleSaveClass(payload) {
  if (!payload) throw new Error("수업 저장 데이터가 없습니다.");

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.CLASSES);
  if (!sheet) {
    initDatabaseSheets();
    sheet = ss.getSheetByName(SHEETS.CLASSES);
  }

  const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

  let fileUrl = payload.fileUrl || "";
  let fileName = payload.fileName || "";

  if (payload.fileData && payload.fileData.base64) {
    try {
      const targetFolder = getTargetDriveFolder();
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
      throw new Error("수업자료 구글 드라이브 파일 업로드 오류: " + fileErr.toString());
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
    payload.status || "ACTIVE",
    payload.deadline || ""
  ];

  if (foundRowIndex > 0) {
    sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  clearInitialDataCache();
  return { message: "수업 정보가 구글 시트에 정상적으로 저장되었습니다.", classId: classId };
}

function handleDeleteClass(classId) {
  if (!classId) throw new Error("삭제할 수업 ID가 필요합니다.");

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CLASSES);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(classId)) {
      sheet.deleteRow(i + 1);
      clearInitialDataCache();
      return { message: "수업이 삭제되었습니다." };
    }
  }

  throw new Error("해당 수업을 찾을 수 없습니다.");
}

function getNoticesList() {
  const ss = getSpreadsheet();
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

  return result.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function handleSaveNotice(payload) {
  if (!payload) throw new Error("공지사항 데이터가 없습니다.");

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.NOTICES);
  if (!sheet) {
    initDatabaseSheets();
    sheet = ss.getSheetByName(SHEETS.NOTICES);
  }

  const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  let fileUrl = payload.fileUrl || "";

  if (payload.fileData && payload.fileData.base64) {
    try {
      const targetFolder = getTargetDriveFolder();
      const contentType = payload.fileData.mimeType || "application/octet-stream";
      const base64Str = payload.fileData.base64.includes(",") 
        ? payload.fileData.base64.split(",")[1] 
        : payload.fileData.base64;
      
      const decodedBytes = Utilities.base64Decode(base64Str);
      const blob = Utilities.newBlob(decodedBytes, contentType, payload.fileData.name);
      
      const file = targetFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      fileUrl = file.getUrl();
    } catch (fileErr) {
      throw new Error("공지사항 첨부파일 구글 드라이브 업로드 오류: " + fileErr.toString());
    }
  }

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
    fileUrl
  ];

  if (foundRowIndex > 0) {
    sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  clearInitialDataCache();
  return { message: "공지사항이 구글 드라이브 첨부파일과 함께 정상 저장되었습니다.", noticeId: noticeId };
}

function handleDeleteNotice(noticeId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.NOTICES);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(noticeId)) {
      sheet.deleteRow(i + 1);
      clearInitialDataCache();
      return { message: "공지사항이 삭제되었습니다." };
    }
  }

  throw new Error("삭제할 공지사항을 찾지 못했습니다.");
}

function getBoardList(adminPassword) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.BOARD);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const isAdmin = verifyAdminPassword(adminPassword);
  const rows = data.slice(1);

  return rows.map(r => {
    const isSecret = String(r[8]).toUpperCase() === "TRUE" || r[8] === true;
    const fileUrl = r[9] || "";
    const fileName = r[10] || "";

    return {
      id: String(r[0]),
      createdAt: formatDateVal(r[1]),
      author: r[2],
      school: r[3],
      title: (isSecret && !isAdmin) ? "🔒 비밀글입니다. (작성자와 관리자만 확인 가능합니다)" : r[4],
      content: (isSecret && !isAdmin) ? "비밀글은 작성자와 관리자만 볼 수 있습니다." : r[5],
      category: r[7] || "자유소통",
      isSecret: isSecret,
      fileUrl: (isSecret && !isAdmin) ? "" : fileUrl,
      fileName: (isSecret && !isAdmin) ? "" : fileName
    };
  }).reverse();
}

function handleCreateBoardPost(payload) {
  if (!payload || !payload.title || !payload.content || !payload.author || !payload.password) {
    throw new Error("성명, 비밀번호, 제목, 내용은 필수 입력 항목입니다.");
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.BOARD);
  if (!sheet) {
    initDatabaseSheets();
    sheet = ss.getSheetByName(SHEETS.BOARD);
  }

  const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  const postId = `BRD-${Date.now().toString().slice(-6)}`;
  const textBoardPw = "'" + String(payload.password).trim();

  let fileUrl = payload.fileUrl || "";
  let fileName = payload.fileName || "";

  if (payload.fileData && payload.fileData.base64) {
    try {
      const targetFolder = getTargetDriveFolder();
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
      throw new Error("게시글 첨부파일 구글 드라이브 업로드 오류: " + fileErr.toString());
    }
  }

  sheet.appendRow([
    postId,
    nowStr,
    payload.author,
    payload.school || "",
    payload.title,
    payload.content,
    textBoardPw,
    payload.category || "자유소통",
    payload.isSecret ? "TRUE" : "FALSE",
    fileUrl,
    fileName
  ]);

  return { message: "게시글이 구글 드라이브 첨부파일과 함께 성공적으로 등록되었습니다." };
}

function handleDeleteBoardPost(payload, adminPassword) {
  if (!payload || !payload.postId || !payload.password) {
    throw new Error("게시글 ID와 비밀번호를 입력해주세요.");
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.BOARD);
  const rows = sheet.getDataRange().getValues();
  const rawInputPw = String(payload.password).trim();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(payload.postId)) {
      const storedPw = rows[i][6];
      if (!isPasswordMatch(rawInputPw, storedPw) && !verifyAdminPassword(adminPassword || payload.password)) {
        throw new Error("비밀번호가 일치하지 않습니다.");
      }
      sheet.deleteRow(i + 1);
      return { message: "게시글이 성공적으로 삭제되었습니다." };
    }
  }

  throw new Error("삭제하려는 게시글을 찾을 수 없습니다.");
}

function handleToggleAttendance(payload) {
  if (!payload || !payload.rowNum) throw new Error("신청 정보가 올바르지 않습니다.");

  const ss = getSpreadsheet();
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (!appSheet) throw new Error("신청 데이터 시트를 찾을 수 없습니다.");

  const rowNum = Number(payload.rowNum);
  const currentStatus = String(appSheet.getRange(rowNum, 9).getValue() || "CONFIRMED").toUpperCase();
  const newStatus = currentStatus === "ATTENDED" ? "CONFIRMED" : "ATTENDED";
  appSheet.getRange(rowNum, 9).setValue(newStatus);
  clearInitialDataCache();

  let emailSent = false;
  const applicantEmail = payload.email ? String(payload.email).trim() : "";

  if (newStatus === "ATTENDED" && applicantEmail !== "" && applicantEmail.includes("@")) {
    try {
      const eventTitle = getConfigValue("EVENT_TITLE") || "2026 삼현 수업나눔한마당";
      const issueDate = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy년 MM월 dd일");
      const certNo = `CERT-${Date.now().toString().slice(-6)}`;

      const htmlBody = `
        <div style="max-width: 600px; margin: 0 auto; padding: 30px; font-family: 'Pretendard', sans-serif; border: 2px solid #4f46e5; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #e0e7ff; padding-bottom: 20px; margin-bottom: 25px;">
            <h1 style="color: #312e81; font-size: 26px; margin: 0 0 8px 0; font-weight: 800;">참 관 확 인 서</h1>
            <p style="color: #6366f1; font-size: 13px; margin: 0; font-weight: 600;">Certificate of Class Attendance</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; color: #334155;">
            <tr>
              <td style="padding: 10px; font-weight: bold; width: 110px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">발급 번호</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${certNo}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">참관자 성명</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${payload.applicantName || "선생님"}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">소속 학교</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${payload.school || "소속미입력"}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">참관 수업명</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #4338ca; font-weight: bold;">${payload.className || "공개수업"}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">행 사 명</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${eventTitle}</td>
            </tr>
          </table>

          <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 30px;">
            <p style="font-size: 15px; color: #4c1d95; line-height: 1.6; margin: 0; font-weight: 600;">
              위 사람은 ${eventTitle} 교사 공개수업에 성실히 참관하였음을 확인합니다.
            </p>
          </div>

          <div style="text-align: center; color: #64748b; font-size: 13px;">
            <p style="margin: 0 0 6px 0;">발급일자: <strong>${issueDate}</strong></p>
            <p style="margin: 0; font-weight: bold; color: #1e293b; font-size: 15px;">삼현여자중학교 수업나눔한마당 운영본부</p>
          </div>
        </div>
      `;

      MailApp.sendEmail({
        to: applicantEmail,
        subject: `[참관 확인서] ${eventTitle} 참관 확인서 (${payload.applicantName || "선생님"})`,
        htmlBody: htmlBody
      });
      emailSent = true;
    } catch (mailErr) {
      Logger.log("참관 확인서 메일 발송 실패: " + mailErr.toString());
    }
  }

  return {
    message: newStatus === "ATTENDED"
      ? (emailSent ? `[${payload.applicantName} 선생님] 출석 처리되었으며 참관 확인서 이메일이 ${applicantEmail}(으)로 발송되었습니다.` : `[${payload.applicantName} 선생님] 출석 처리되었습니다. (이메일 미입력으로 메일 발송 생략)`)
      : `[${payload.applicantName} 선생님] 출석 상태가 취소(신청완료)로 변경되었습니다.`,
    status: newStatus,
    emailSent: emailSent
  };
}

function handleCreateObservationLog(payload) {
  if (!payload || !payload.applicantName || !payload.classId || !payload.content || !payload.password) {
    throw new Error("성명, 비밀번호, 수업 선택, 참관록 내용은 필수 입력 항목입니다.");
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.OBSERVATIONS);
  if (!sheet) {
    initDatabaseSheets();
    sheet = ss.getSheetByName(SHEETS.OBSERVATIONS);
  }

  const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  const obsId = `OBS-${Date.now().toString().slice(-6)}`;
  const textObsPw = "'" + String(payload.password).trim();

  let fileUrl = payload.fileUrl || "";
  let fileName = payload.fileName || "";

  if (payload.fileData && payload.fileData.base64) {
    try {
      const targetFolder = getTargetDriveFolder();
      const contentType = payload.fileData.mimeType || "application/octet-stream";
      const base64Str = payload.fileData.base64.includes(",") 
        ? payload.fileData.base64.split(",")[1] 
        : payload.fileData.base64;
      
      const decodedBytes = Utilities.base64Decode(base64Str);
      const blob = Utilities.newBlob(decodedBytes, contentType, payload.fileData.name);
      
      const file = targetFolder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        Logger.log("Sharing setting warning: " + shareErr.toString());
      }
      
      fileUrl = file.getUrl();
      fileName = payload.fileData.name;
    } catch (fileErr) {
      const errStr = fileErr.toString();
      if (errStr.indexOf("액세스가 거부됨") !== -1 || errStr.indexOf("Access denied") !== -1 || errStr.indexOf("DriveApp") !== -1) {
        throw new Error("구글 드라이브(DriveApp) 접근 권한이 승인되지 않았습니다. 앱스 스크립트 에디터에서 함수를 [▶ 실행]하여 구글 드라이브 권한 승인(허용)을 완료해 주세요.");
      }
      throw new Error("참관록 첨부파일 구글 드라이브 업로드 오류: " + errStr);
    }
  }

  let className = "수업 참관록";
  const classSheet = ss.getSheetByName(SHEETS.CLASSES);
  if (classSheet) {
    const classRows = classSheet.getDataRange().getValues();
    for (let i = 1; i < classRows.length; i++) {
      if (String(classRows[i][0]) === String(payload.classId)) {
        className = `[${classRows[i][1]}] ${classRows[i][6]} (${classRows[i][2]} 선생님)`;
        break;
      }
    }
  }

  sheet.appendRow([
    obsId,
    nowStr,
    payload.applicantName,
    payload.school || "",
    payload.classId,
    className,
    payload.content,
    fileUrl,
    fileName,
    payload.isSecret ? "TRUE" : "FALSE",
    textObsPw
  ]);

  return { message: "참관록이 구글 드라이브 첨부파일과 함께 성공적으로 등록되었습니다." };
}

function getObservationLogsList(adminPassword) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.OBSERVATIONS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const isAdmin = verifyAdminPassword(adminPassword);
  const rows = data.slice(1);

  return rows.map(r => {
    const isSecret = String(r[9]).toUpperCase() === "TRUE" || r[9] === true;
    const fileUrl = r[7] || "";
    const fileName = r[8] || "";

    return {
      id: String(r[0]),
      createdAt: formatDateVal(r[1]),
      applicantName: r[2],
      school: r[3],
      classId: r[4],
      className: r[5],
      content: (isSecret && !isAdmin) ? "🔒 비공개 참관록입니다. (작성자와 관리자만 확인 가능합니다)" : r[6],
      fileUrl: (isSecret && !isAdmin) ? "" : fileUrl,
      fileName: (isSecret && !isAdmin) ? "" : fileName,
      isSecret: isSecret
    };
  }).reverse();
}

function handleDeleteObservationLog(payload, adminPassword) {
  if (!payload || !payload.obsId || !payload.password) {
    throw new Error("참관록 ID와 비밀번호를 입력해 주세요.");
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.OBSERVATIONS);
  if (!sheet) throw new Error("참관록 시트를 찾을 수 없습니다.");

  const rows = sheet.getDataRange().getValues();
  const rawInputPw = String(payload.password).trim();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(payload.obsId)) {
      const storedPw = rows[i][10];
      if (!isPasswordMatch(rawInputPw, storedPw) && !verifyAdminPassword(adminPassword || payload.password)) {
        throw new Error("비밀번호가 일치하지 않습니다.");
      }
      sheet.deleteRow(i + 1);
      return { message: "참관록이 성공적으로 삭제되었습니다." };
    }
  }

  throw new Error("삭제하려는 참관록을 찾을 수 없습니다.");
}

function getAllApplications() {
  const ss = getSpreadsheet();
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

function handleToggleAttendance(payload) {
  if (!payload || !payload.rowNum) {
    throw new Error("출석 처리할 신청자 행 번호(rowNum)가 전달되지 않았습니다.");
  }

  const ss = getSpreadsheet();
  const appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (!appSheet) throw new Error("신청 목록 시트를 찾을 수 없습니다.");

  const rowNum = parseInt(payload.rowNum, 10);
  const totalRows = appSheet.getLastRow();
  if (rowNum < 2 || rowNum > totalRows) {
    throw new Error("유효하지 않은 행 번호입니다.");
  }

  const rowValues = appSheet.getRange(rowNum, 1, 1, 10).getValues()[0];
  const applicantName = String(rowValues[1] || payload.applicantName || "").trim();
  const school = String(rowValues[2] || payload.school || "").trim();
  const email = String(rowValues[4] || payload.email || "").trim();
  const classId = String(rowValues[5] || payload.classId || "").trim();
  let className = String(rowValues[6] || payload.className || "").trim();
  const currentStatus = String(rowValues[8] || "").toUpperCase();

  // 수업 일시(dateTime) 조회
  let classDateTime = "";
  try {
    const classSheet = ss.getSheetByName(SHEETS.CLASSES);
    if (classSheet) {
      const classRows = classSheet.getDataRange().getValues();
      for (let i = 1; i < classRows.length; i++) {
        if (String(classRows[i][0]) === classId) {
          classDateTime = String(classRows[i][4] || "");
          if (!className) {
            className = `[${classRows[i][1]}] ${classRows[i][6]} (${classRows[i][2]} 선생님)`;
          }
          break;
        }
      }
    }
  } catch (err) {
    Logger.log("수업 일시 조회 중 오류: " + err.toString());
  }

  if (!classDateTime) {
    classDateTime = "2026-9-11 15:00 ~ 16:30";
  }

  // 상태 토글 처리
  if (currentStatus === "ATTENDED") {
    appSheet.getRange(rowNum, 9).setValue("CONFIRMED");
    return {
      success: true,
      status: "CONFIRMED",
      message: `[${applicantName} 선생님] 출석 상태가 취소(미출석)되었습니다.`
    };
  } else {
    appSheet.getRange(rowNum, 9).setValue("ATTENDED");

    // 이메일 발송
    if (email && email.includes("@")) {
      const certResult = generateAttendanceCertificate(applicantName, school, className, classDateTime, email);
      if (certResult.sent) {
        return {
          success: true,
          status: "ATTENDED",
          message: `[${applicantName} 선생님] 출석 처리 및 참관 확인서 이메일 발송이 완료되었습니다. (${email})`
        };
      } else {
        return {
          success: true,
          status: "ATTENDED",
          message: `[${applicantName} 선생님] 출석 처리 완료 (이메일 발송 실패: ${certResult.error || certResult.reason})`
        };
      }
    } else {
      return {
        success: true,
        status: "ATTENDED",
        message: `[${applicantName} 선생님] 출석 처리되었습니다. (등록된 이메일이 없어 메일 발송 생략)`
      };
    }
  }
}

/**
 * 참관 확인서 Google Docs 템플릿 기반 PDF 생성 및 이메일 발송
 */
function generateAttendanceCertificate(applicantName, school, className, classDateTime, applicantEmail) {
  if (!applicantEmail || applicantEmail.trim() === "" || !applicantEmail.includes("@")) {
    return { sent: false, reason: "이메일 주소 없음" };
  }

  const templateId = CERT_TEMPLATE_DOC_ID;
  const trainingName = "배움중심수업 나눔중심학교 수업나눔의 날";
  const trainingLocation = "삼현여자중학교";
  const trainingDate = classDateTime || "2026-9-11 15:00 ~ 16:30";

  let tempFile = null;
  try {
    const templateFile = DriveApp.getFileById(templateId);
    tempFile = templateFile.makeCopy(`[참관확인서]_${applicantName}_${new Date().getTime()}`);
    const tempDocId = tempFile.getId();
    const doc = DocumentApp.openById(tempDocId);
    const body = doc.getBody();

    // 템플릿 태그 치환 (공백 포함 정규식 패턴)
    body.replaceText("\\{\\{\\s*교사성명\\s*\\}\\}", applicantName || "");
    body.replaceText("\\{\\{\\s*참관수업명\\s*\\}\\}", className || "");
    body.replaceText("\\{\\{\\s*참석일자\\s*\\}\\}", trainingDate);
    body.replaceText("\\{\\{\\s*연수명\\s*\\}\\}", trainingName);
    body.replaceText("\\{\\{\\s*장소\\s*\\}\\}", trainingLocation);
    body.replaceText("\\{\\{\\s*소속학교\\s*\\}\\}", school || "");
    body.replaceText("\\{\\{\\s*소속\\s*\\}\\}", school || "");

    // 단순 문자열 치환 백업
    body.replaceText("{{교사성명}}", applicantName || "");
    body.replaceText("{{참관수업명}}", className || "");
    body.replaceText("{{참석일자}}", trainingDate);
    body.replaceText("{{연수명}}", trainingName);
    body.replaceText("{{장소}}", trainingLocation);
    body.replaceText("{{소속학교}}", school || "");
    body.replaceText("{{소속}}", school || "");

    doc.saveAndClose();

    const pdfBlob = tempFile.getAs(MimeType.PDF).setName(`참관확인서_${applicantName}선생님.pdf`);

    const emailSubject = `[삼현여자중학교] 수업나눔의 날 참관 확인서 (${applicantName} 선생님)`;
    const emailBodyHtml = `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #4f46e5; margin: 0 0 10px 0; font-size: 22px;">수업나눔의 날 참관 확인서</h2>
          <p style="color: #64748b; font-size: 14px; margin: 0;">삼현여자중학교 배움중심수업 나눔중심학교</p>
        </div>
        
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          안녕하세요, <strong>${applicantName}</strong> 선생님.<br>
          삼현여자중학교 <strong>배움중심수업 나눔중심학교 수업나눔의 날</strong>에 참석해 주셔서 진심으로 감사드립니다.<br>
          선생님의 참관 확인서를 첨부파일(PDF)로 보내드립니다.
        </p>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 18px; margin: 20px 0; border-left: 4px solid #4f46e5;">
          <table style="width: 100%; font-size: 14px; color: #334155; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 100px;">참관자 성명:</td>
              <td style="padding: 6px 0;">${applicantName} 선생님 (${school || '소속 미입력'})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">연 수 명:</td>
              <td style="padding: 6px 0;">${trainingName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">장 소:</td>
              <td style="padding: 6px 0;">${trainingLocation}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">참관 수업명:</td>
              <td style="padding: 6px 0; color: #4f46e5; font-weight: bold;">${className}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">참석 일시:</td>
              <td style="padding: 6px 0;">${trainingDate}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 20px;">
          ※ 본 메일의 첨부파일(PDF)을 다운로드하여 참관 확인서로 활용하시기 바랍니다.<br>
          문의사항이 있으시면 삼현여자중학교로 연락 주시기 바랍니다.
        </p>
        
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
          삼현여자중학교 배움중심수업 나눔마당 운영팀
        </div>
      </div>
    `;

    MailApp.sendEmail({
      to: applicantEmail.trim(),
      subject: emailSubject,
      htmlBody: emailBodyHtml,
      attachments: [pdfBlob]
    });

    return { sent: true, recipient: applicantEmail.trim() };
  } catch (err) {
    Logger.log(`[Certificate Send Error] ${err.toString()}`);
    return { sent: false, error: err.toString() };
  } finally {
    if (tempFile) {
      try {
        tempFile.setTrashed(true);
      } catch (e) {
        Logger.log(`임시 파일 삭제 실패: ${e.toString()}`);
      }
    }
  }
}

/* ==================================================================
 * 유틸리티 & 설정
 * ================================================================== */

function getConfigMap() {
  const ss = getSpreadsheet();
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

function handleSaveConfig(payload) {
  if (!payload || !payload.key) throw new Error("설정 키(Key)가 지정되지 않았습니다.");

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) {
    initDatabaseSheets();
    sheet = ss.getSheetByName(SHEETS.CONFIG);
  }

  const rows = sheet.getDataRange().getValues();
  const targetKey = String(payload.key).trim();
  const targetVal = String(payload.value || "").trim();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === targetKey) {
      sheet.getRange(i + 1, 2).setValue(targetVal);
      clearInitialDataCache();
      return { message: `[${targetKey}] 설정이 구글 시트에 변경되었습니다.`, key: targetKey, value: targetVal };
    }
  }

  sheet.appendRow([targetKey, targetVal, payload.description || ""]);
  clearInitialDataCache();
  return { message: `[${targetKey}] 설정이 구글 시트에 등록되었습니다.`, key: targetKey, value: targetVal };
}

function parseDriveFolderId(input) {
  if (!input) return "";
  const raw = String(input).trim();

  const urlMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  const idParamMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  return raw;
}

function getTargetDriveFolder() {
  const rawFolderVal = getConfigValue("DRIVE_FOLDER_ID");
  const folderId = parseDriveFolderId(rawFolderVal);

  if (folderId && folderId !== "") {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log(`[DRIVE_FOLDER_ID Error] 지정된 폴더 ID(${folderId})를 찾을 수 없어 루트 폴더에 저장합니다: ${e.toString()}`);
    }
  }

  return DriveApp.getRootFolder();
}

function verifyAdminPassword(inputPassword) {
  if (!inputPassword) return false;
  const defaultHash = "b0d107a1cb94cd60c513a8636f99b8d700154887e2a96f0310a1b5f3e60a6ddd";
  let storedHash = getConfigValue("ADMIN_PASSWORD_HASH");
  
  if (!storedHash || storedHash.trim() === "" || storedHash === "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3") {
    storedHash = defaultHash;
  }
  return isPasswordMatch(inputPassword, storedHash);
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

function initDatabaseSheets() {
  const ss = getSpreadsheet();

  let classesSheet = ss.getSheetByName(SHEETS.CLASSES);
  if (!classesSheet) {
    classesSheet = ss.insertSheet(SHEETS.CLASSES);
    classesSheet.appendRow(["id", "subject", "teacher", "gradeGroup", "dateTime", "location", "topic", "description", "capacity", "fileUrl", "fileName", "createdAt", "status", "deadline"]);
  }

  let appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (!appSheet) {
    appSheet = ss.insertSheet(SHEETS.APPLICATIONS);
    appSheet.appendRow(["timestamp", "applicantName", "school", "phone", "email", "classId", "className", "remark", "status", "password"]);
  }

  let noticeSheet = ss.getSheetByName(SHEETS.NOTICES);
  if (!noticeSheet) {
    noticeSheet = ss.insertSheet(SHEETS.NOTICES);
    noticeSheet.appendRow(["id", "createdAt", "title", "content", "isPinned", "author", "fileUrl"]);
  }

  let boardSheet = ss.getSheetByName(SHEETS.BOARD);
  if (!boardSheet) {
    boardSheet = ss.insertSheet(SHEETS.BOARD);
    boardSheet.appendRow(["id", "createdAt", "author", "school", "title", "content", "password", "category", "isSecret", "fileUrl", "fileName"]);
  }

  let obsSheet = ss.getSheetByName(SHEETS.OBSERVATIONS);
  if (!obsSheet) {
    obsSheet = ss.insertSheet(SHEETS.OBSERVATIONS);
    obsSheet.appendRow(["id", "createdAt", "applicantName", "school", "classId", "className", "content", "fileUrl", "fileName", "isSecret", "password"]);
  }

  let configSheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEETS.CONFIG);
    configSheet.appendRow(["Key", "Value", "Description"]);
    configSheet.appendRow(["ADMIN_PASSWORD_HASH", "b0d107a1cb94cd60c513a8636f99b8d700154887e2a96f0310a1b5f3e60a6ddd", "관리자 비밀번호 SHA-256 해시 (기본: admin1234!)"]);
    configSheet.appendRow(["EVENT_TITLE", "2026 삼현 수업나눔한마당", "행사 메인 제목"]);
    configSheet.appendRow(["IS_REGISTRATION_OPEN", "TRUE", "참관 신청 가능 여부 (TRUE/FALSE)"]);
    configSheet.appendRow(["DRIVE_FOLDER_ID", "", "첨부파일이 업로드될 Google Drive 폴더 ID (또는 전체 URL 주소)"]);
    configSheet.appendRow(["REQUIRE_NAME", "TRUE", "신청자 교사 성명 필수 입력 여부 (TRUE/FALSE)"]);
    configSheet.appendRow(["REQUIRE_SCHOOL_EXTERNAL", "TRUE", "외부 교원 소속 학교명 필수 입력 여부 (TRUE/FALSE)"]);
    configSheet.appendRow(["REQUIRE_PHONE", "FALSE", "연락처 필수 입력 여부 (TRUE/FALSE)"]);
    configSheet.appendRow(["REQUIRE_EMAIL", "FALSE", "이메일 주소 필수 입력 여부 (TRUE/FALSE)"]);
  }
}
