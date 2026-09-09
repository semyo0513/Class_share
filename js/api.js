/**
 * ==================================================================
 * 🏫 백엔드 통신 API 모듈 (Google Apps Script 연동 & Mock Fallback)
 * ==================================================================
 */

const MOCK_STORAGE_KEY = "SAMHYUN_APP_MOCK_DATA_V3";

function getInitialMockStore() {
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch (e) {}
  }

  const defaultData = {
    classes: [
      {
        id: "CLS-234319",
        subject: "영어",
        teacher: "김O정",
        gradeGroup: "3학년",
        dateTime: "2026-9-11 15:00 ~ 16:30 (7-8교시)",
        location: "3-6교실",
        topic: "Reading Aloud 활동을 통한 지문분석 및 읽기 유창성 기르기",
        description: "글을 소리 내어 읽는 과정을 통해 지문의 구조와 의미를 정확하게 파악하고 Natural Reading 유창성을 함양합니다.",
        capacity: 13,
        currentApplied: 7,
        isFull: false,
        isDeadlinePassed: false,
        fileUrl: "",
        fileName: "",
        createdAt: "2026-08-24 13:03:54",
        status: "ACTIVE",
        deadline: "2026-09-10 17:01:00"
      },
      {
        id: "CLS-234320",
        subject: "국어",
        teacher: "김O나",
        gradeGroup: "3학년",
        dateTime: "2026-9-11 15:00 ~ 16:30 (7-8교시)",
        location: "3-3교실",
        topic: "스노클(snorkl)을 활용한 시〈봄은〉의 근거 중심 해석과 다양한 관점의 비교 감상",
        description: "AI 음성 형성평가 도구인 스노클을 통해 시 〈봄은〉을 텍스트 근거에 기반하여 해석하고, 다른 사람들의 다채로운 관점과 비교하며 깊이 있게 감상합니다.",
        capacity: 13,
        currentApplied: 9,
        isFull: false,
        isDeadlinePassed: false,
        fileUrl: "",
        fileName: "",
        createdAt: "2026-08-24 13:03:54",
        status: "ACTIVE",
        deadline: "2026-09-10 17:01:00"
      },
      {
        id: "CLS-234321",
        subject: "사회",
        teacher: "배O한",
        gradeGroup: "3학년",
        dateTime: "2026-9-11 15:00 ~ 16:30 (7-8교시)",
        location: "3-4교실",
        topic: "AI 경제기자와 함께 보는 환율",
        description: "AI 경제기자 솔루션을 활용하여 환율 변동의 원리와 세계 경제 상황이 실생활 금융 및 물가에 미치는 영향을 입체적으로 탐구합니다.",
        capacity: 13,
        currentApplied: 13,
        isFull: true,
        isDeadlinePassed: false,
        fileUrl: "",
        fileName: "",
        createdAt: "2026-08-24 13:03:54",
        status: "ACTIVE",
        deadline: "2026-09-10 17:01:00"
      },
      {
        id: "CLS-234322",
        subject: "과학",
        teacher: "정O재",
        gradeGroup: "3학년",
        dateTime: "2026-9-11 15:00 ~ 16:30 (7-8교시)",
        location: "3-2교실",
        topic: "스테라리움을 이용한 은하와 우주",
        description: "천문 시뮬레이션 프로그램 스테라리움(Stellarium)으로 가상의 밤하늘을 관찰하며 은하의 구조와 우주의 광활함을 생생하게 체험합니다.",
        capacity: 13,
        currentApplied: 7,
        isFull: false,
        isDeadlinePassed: false,
        fileUrl: "",
        fileName: "",
        createdAt: "2026-08-24 13:03:54",
        status: "ACTIVE",
        deadline: "2026-09-10 17:01:00"
      },
      {
        id: "CLS-234323",
        subject: "수학",
        teacher: "강O주",
        gradeGroup: "3학년",
        dateTime: "2026-9-11 15:00 ~ 16:30 (7-8교시)",
        location: "3-9교실",
        topic: "퀴즈로 점검하고 완성하는 삼각비와 원의 성질",
        description: "다양한 형성평가 퀴즈를 풀며 삼각비의 개념과 원의 핵심 성질을 흥미롭게 복습하고 수학적 개념 적용력을 확실히 다집니다.",
        capacity: 13,
        currentApplied: 4,
        isFull: false,
        isDeadlinePassed: false,
        fileUrl: "",
        fileName: "",
        createdAt: "2026-08-24 13:03:54",
        status: "ACTIVE",
        deadline: "2026-09-10 17:01:00"
      },
      {
        id: "CLS-234324",
        subject: "수학",
        teacher: "박O현",
        gradeGroup: "1학년",
        dateTime: "2026-9-11 15:00 ~ 16:30 (7-8교시)",
        location: "1-3교실",
        topic: "데스모스를 이용한 정비례 그래프의 모양 확인하기",
        description: "공학 도구 데스모스(Desmos)의 변수를 직접 조작하며 계수의 변화에 따른 정비례 관계 그래프의 시각적 특징과 변화 원리를 직관적으로 이해합니다.",
        capacity: 13,
        currentApplied: 9,
        isFull: false,
        isDeadlinePassed: false,
        fileUrl: "",
        fileName: "",
        createdAt: "2026-08-24 13:03:54",
        status: "ACTIVE",
        deadline: "2026-09-10 17:01:00"
      }
    ],
    applications: [],
    notices: [
      {
        id: "NOT-520912",
        createdAt: "2026-09-04 16:42:23",
        title: "[공지] 2026 수업나눔 참관 신청 안내",
        content: "안녕하세요. 2026 수업나눔 참관 신청을 시작합니다. \n많은 참여 부탁드립니다.",
        isPinned: true,
        author: "행사운영본부",
        fileUrl: "https://docs.google.com/spreadsheets/d/1koU2F5wE-Oj_jMIbsa4giYllJd5Wd4eD/edit?usp=drivesdk&ouid=116488516416956517867&rtpof=true&sd=true"
      },
      {
        id: "NOT-520915",
        createdAt: "2026-09-04 16:41:24",
        title: "9월 수업나눔 교실 안내도",
        content: "수업나눔 교실 안내도",
        isPinned: true,
        author: "행사운영본부",
        fileUrl: "https://drive.google.com/file/d/1k-EuTB222qX9HJh5sUWb9PQ7RT0h0OXT/view?usp=drivesdk"
      },
      {
        id: "NOT-520913",
        createdAt: "2026-08-24 13:08:40",
        title: "오시는 길",
        content: "오시는 길",
        isPinned: true,
        author: "행사운영본부",
        fileUrl: "https://drive.google.com/file/d/1AWB-Rz90MCbjiXtuyV6m9V56_B6lRcYn/view?usp=drivesdk"
      },
      {
        id: "NOT-520914",
        createdAt: "2026-09-04 16:42:34",
        title: "수업나눔 안내 가정통신문",
        content: "수업나눔 안내 가정통신문",
        isPinned: false,
        author: "행사운영본부",
        fileUrl: ""
      }
    ],
    board: [],
    observations: [],
    config: {
      EVENT_TITLE: "2026 삼현 수업나눔한마당",
      IS_REGISTRATION_OPEN: "TRUE",
      DRIVE_FOLDER_ID: "1rNCd-BxjU0M5mhhEHpCJPmSsvfS12vCO",
      REQUIRE_NAME: "TRUE",
      REQUIRE_SCHOOL_EXTERNAL: "TRUE",
      REQUIRE_PHONE: "FALSE",
      REQUIRE_EMAIL: "FALSE"
    }
  };

  saveMockStore(defaultData);
  return defaultData;
}

function saveMockStore(data) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
}

const API = {
  async get(action, params = {}) {
    if (CONFIG.GAS_API_URL && CONFIG.GAS_API_URL.trim().startsWith("http")) {
      let timeoutId;
      try {
        const url = new URL(CONFIG.GAS_API_URL);
        url.searchParams.append("action", action);
        url.searchParams.append("_t", Date.now().toString());
        Object.keys(params).forEach(k => {
          if (params[k] !== undefined && params[k] !== null) {
            url.searchParams.append(k, params[k]);
          }
        });

        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 6000); // 6초 타임아웃

        const res = await fetch(url.toString(), {
          method: "GET",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const json = await res.json();
        if (json.success) return json.data;
        throw new Error(json.data?.error || json.error || json.message || "구글 시트 데이터 조회 실패");
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn(`[GAS GET ${action} 통신 실패, Mock Fallback 사용]`, err);
        try {
          return await this.getMock(action, params);
        } catch (mockErr) {
          throw err;
        }
      }
    }
    return this.getMock(action, params);
  },

  async post(action, payload = {}, adminPassword = null) {
    if (CONFIG.GAS_API_URL && CONFIG.GAS_API_URL.trim().startsWith("http")) {
      let timeoutId;
      try {
        const bodyData = { action, payload, adminPassword };
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 12000); // 12초 타임아웃

        const res = await fetch(CONFIG.GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(bodyData),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          throw new Error("구글 앱스 스크립트가 올바른 JSON 응답을 반환하지 않았습니다. (Web App 액세스 권한이 '모든 사용자'로 설정되어 있는지 확인하세요)");
        }

        if (json.success) return json.data;
        const errMsg = json.data?.error || json.error || json.message || "구글 시트 처리 실패";
        throw new Error(errMsg);
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn(`[GAS POST ${action} 통신 실패, Mock Fallback 시도]`, err);
        try {
          return await this.postMock(action, payload, adminPassword);
        } catch (mockErr) {
          throw err;
        }
      }
    }
    return this.postMock(action, payload, adminPassword);
  },

  async getMock(action, params = {}) {
    const store = getInitialMockStore();
    switch (action) {
      case "getInitialData":
        return { classes: store.classes, notices: store.notices, config: store.config };
      case "getClasses":
        return store.classes;
      case "getNotices":
        return store.notices;
      case "getBoard":
        return store.board;
      case "getObservations": {
        const isAdmin = params.adminPassword === CONFIG.DEMO_ADMIN_PASSWORD;
        const list = store.observations || [];
        return list.map(o => ({
          ...o,
          content: (o.isSecret && !isAdmin) ? "🔒 비공개 참관록입니다. (작성자와 관리자만 확인 가능합니다)" : o.content,
          fileUrl: (o.isSecret && !isAdmin) ? "" : o.fileUrl,
          fileName: (o.isSecret && !isAdmin) ? "" : o.fileName
        }));
      }
      case "getConfig":
        return store.config;
      case "getAdminApplications":
        if (params.adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) {
          throw new Error("관리자 비밀번호가 올바르지 않습니다.");
        }
        return store.applications;
      case "checkMyApplications": {
        const pw = String(params.password || "").trim();
        const name = String(params.applicantName || "").trim();
        return store.applications.filter(a => 
          a.status !== "CANCELLED" && (a.password === pw || (name && a.applicantName === name))
        );
      }
      default:
        throw new Error(`알 수 없는 GET Action: ${action}`);
    }
  },

  async postMock(action, payload = {}, adminPassword = null) {
    const store = getInitialMockStore();

    switch (action) {
      case "adminLogin":
        if (adminPassword === CONFIG.DEMO_ADMIN_PASSWORD) return { authorized: true };
        throw new Error("비밀번호가 일치하지 않습니다.");

      case "applyClass": {
        const target = store.classes.find(c => String(c.id) === String(payload.classId));
        if (!target) throw new Error("수업을 찾을 수 없습니다.");
        if (target.status === "CLOSED") throw new Error("해당 수업은 신청 마감되었습니다.");

        const cleanPhone = String(payload.phone || "").replace(/[^0-9]/g, "");
        if (cleanPhone) {
          const dup = store.applications.find(a => String(a.classId) === String(payload.classId) && a.phone.replace(/[^0-9]/g, "") === cleanPhone && a.status !== "CANCELLED");
          if (dup) throw new Error("동일한 연락처로 이미 해당 수업을 신청하셨습니다.");
        }

        if (target.capacity > 0 && target.currentApplied >= target.capacity) {
          throw new Error("선착순 정원이 마감되었습니다.");
        }

        target.currentApplied += 1;
        if (target.capacity > 0 && target.currentApplied >= target.capacity) {
          target.isFull = true;
        }

        const nowStr = new Date().toLocaleString("sv-SE").replace("T", " ");
        store.applications.push({
          rowNum: store.applications.length + 2,
          timestamp: nowStr,
          applicantName: payload.applicantName || "(미입력)",
          school: payload.school || "",
          phone: payload.phone || "",
          email: payload.email || "",
          password: payload.password || "",
          classId: payload.classId,
          className: `[${target.subject}] ${target.topic} (${target.teacher} 선생님)`,
          remark: payload.remark || "",
          status: "CONFIRMED"
        });

        if (payload.remark && String(payload.remark).trim() !== "") {
          const authorName = payload.applicantName && String(payload.applicantName).trim() !== "" ? String(payload.applicantName).trim() : "선생님";
          const authorSchool = payload.school && String(payload.school).trim() !== "" ? String(payload.school).trim() : (payload.teacherType === "INTERNAL" ? "삼현여자중학교" : "");
          store.board.unshift({
            id: `BRD-${Date.now().toString().slice(-6)}`,
            createdAt: nowStr,
            author: authorName,
            school: authorSchool,
            title: `[참관기대평] [${target.subject}] (${target.teacher} 선생님)`,
            content: `💡 참관 기대평 / 수업자 전달 한마디:\n${String(payload.remark).trim()}`,
            password: payload.password || "",
            category: "자유소통",
            isSecret: false,
            fileUrl: "",
            fileName: ""
          });
        }

        saveMockStore(store);
        const hasEmail = payload.email && payload.email.trim() !== "";
        const emailNotice = hasEmail ? ` (신청 확인 이메일이 ${payload.email}로 발송되었습니다)` : "";
        return { 
          message: payload.remark && String(payload.remark).trim() !== "" 
            ? `참관 신청 완료${emailNotice} 및 참관 기대평이 나눔마당(게시판)에 자동 등록되었습니다.` 
            : `참관 신청이 정상적으로 완료되었습니다.${emailNotice}`, 
          classTitle: `[${target.subject}] ${target.topic} (${target.teacher} 선생님)`,
          applicantName: payload.applicantName
        };
      }

      case "checkMyApplications": {
        const pw = String(payload.password || "").trim();
        const name = String(payload.applicantName || "").trim();
        return store.applications.filter(a => 
          a.status !== "CANCELLED" && ((pw && a.password === pw) || (name && a.applicantName === name))
        );
      }

      case "updateMyApplication": {
        const pw = String(payload.password || "").trim();
        const target = store.applications.find(a => 
          String(a.classId) === String(payload.classId) && a.status !== "CANCELLED" && (a.password === pw || a.applicantName === payload.applicantName)
        );

        if (!target) throw new Error("비밀번호가 일치하지 않거나 수정할 신청 내역을 찾을 수 없습니다.");
        target.school = payload.school || target.school;
        target.email = payload.email || target.email;
        target.remark = payload.remark || target.remark;

        saveMockStore(store);
        return { message: "참관 신청 정보가 성공적으로 수정되었습니다." };
      }

      case "cancelMyApplication": {
        const pw = String(payload.password || "").trim();
        const target = store.applications.find(a => 
          String(a.classId) === String(payload.classId) && a.status !== "CANCELLED" && (a.password === pw || a.applicantName === payload.applicantName)
        );

        if (!target) throw new Error("비밀번호가 일치하지 않거나 취소할 신청 내역을 찾을 수 없습니다.");
        target.status = "CANCELLED";

        const targetClass = store.classes.find(c => String(c.id) === String(payload.classId));
        if (targetClass && targetClass.currentApplied > 0) {
          targetClass.currentApplied -= 1;
          if (targetClass.capacity > 0 && targetClass.currentApplied < targetClass.capacity) {
            targetClass.isFull = false;
          }
        }

        saveMockStore(store);
        return { message: "참관 신청이 정상 취소되었습니다." };
      }

      case "toggleClassStatus": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        const target = store.classes.find(c => String(c.id) === String(payload.classId));
        if (!target) throw new Error("수업을 찾지 못했습니다.");

        target.status = payload.status || (target.status === "CLOSED" ? "ACTIVE" : "CLOSED");
        saveMockStore(store);
        return { message: `수업 상태가 변경되었습니다.`, newStatus: target.status };
      }

      case "saveClass": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        const nowStr = new Date().toLocaleString("sv-SE").replace("T", " ");
        const classId = payload.id || `CLS-${Date.now().toString().slice(-6)}`;

        let fileUrl = payload.fileUrl || "";
        let fileName = payload.fileName || "";

        if (payload.fileData) {
          fileName = payload.fileData.name;
          fileUrl = "https://example.com/demo_uploaded_" + encodeURIComponent(fileName);
        }

        const existingIdx = store.classes.findIndex(c => String(c.id) === String(classId));
        const classObj = {
          id: classId,
          subject: payload.subject,
          teacher: payload.teacher,
          gradeGroup: payload.gradeGroup,
          dateTime: payload.dateTime,
          location: payload.location,
          topic: payload.topic,
          description: payload.description,
          capacity: Number(payload.capacity) || 0,
          currentApplied: existingIdx >= 0 ? store.classes[existingIdx].currentApplied : 0,
          isFull: false,
          fileUrl: fileUrl,
          fileName: fileName,
          status: payload.status || "ACTIVE",
          deadline: payload.deadline || "",
          createdAt: nowStr
        };

        if (existingIdx >= 0) {
          store.classes[existingIdx] = { ...store.classes[existingIdx], ...classObj };
        } else {
          store.classes.push(classObj);
        }

        saveMockStore(store);
        return { message: "수업이 성공적으로 저장되었습니다.", classId };
      }

      case "deleteClass": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        store.classes = store.classes.filter(c => String(c.id) !== String(payload.classId || payload));
        saveMockStore(store);
        return { message: "수업이 삭제되었습니다." };
      }

      case "saveNotice": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        const nowStr = new Date().toLocaleString("sv-SE").replace("T", " ");
        const noticeId = payload.id || `NOT-${Date.now().toString().slice(-6)}`;

        let fileUrl = payload.fileUrl || "";
        if (payload.fileData) {
          fileUrl = "https://example.com/demo_uploaded_notice_" + encodeURIComponent(payload.fileData.name);
        }

        const noticeObj = {
          id: noticeId,
          createdAt: nowStr,
          title: payload.title,
          content: payload.content,
          isPinned: !!payload.isPinned,
          author: payload.author || "행사운영본부",
          fileUrl: fileUrl
        };

        const idx = store.notices.findIndex(n => String(n.id) === String(noticeId));
        if (idx >= 0) store.notices[idx] = noticeObj;
        else store.notices.unshift(noticeObj);

        saveMockStore(store);
        return { message: "공지사항이 저장되었습니다.", noticeId };
      }

      case "deleteNotice": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        store.notices = store.notices.filter(n => String(n.id) !== String(payload.noticeId || payload));
        saveMockStore(store);
        return { message: "공지사항이 삭제되었습니다." };
      }

      case "createBoardPost": {
        const nowStr = new Date().toLocaleString("sv-SE").replace("T", " ");
        let fileUrl = payload.fileUrl || "";
        let fileName = payload.fileName || "";
        if (payload.fileData) {
          fileName = payload.fileData.name;
          fileUrl = "https://example.com/demo_uploaded_board_" + encodeURIComponent(fileName);
        }

        store.board.unshift({
          id: `BRD-${Date.now().toString().slice(-6)}`,
          createdAt: nowStr,
          author: payload.author,
          school: payload.school || "",
          title: payload.title,
          content: payload.content,
          password: payload.password,
          category: payload.category || "자유소통",
          isSecret: !!payload.isSecret,
          fileUrl: fileUrl,
          fileName: fileName
        });
        saveMockStore(store);
        return { message: "게시글이 등록되었습니다." };
      }

      case "deleteBoardPost": {
        const target = store.board.find(b => String(b.id) === String(payload.postId));
        if (!target) throw new Error("게시글을 찾을 수 없습니다.");
        if (target.password !== payload.password && adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) {
          throw new Error("비밀번호가 일치하지 않습니다.");
        }
        store.board = store.board.filter(b => String(b.id) !== String(payload.postId));
        saveMockStore(store);
        return { message: "게시글이 삭제되었습니다." };
      }

      case "saveConfig": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        store.config[payload.key] = payload.value;
        saveMockStore(store);
        return { message: `[${payload.key}] 설정이 저장되었습니다.` };
      }

      case "toggleAttendance": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        const app = store.applications.find(a => String(a.rowNum) === String(payload.rowNum) || (String(a.classId) === String(payload.classId) && a.applicantName === payload.applicantName));
        if (app) {
          app.status = app.status === "ATTENDED" ? "CONFIRMED" : "ATTENDED";
        }
        saveMockStore(store);
        const hasEmail = payload.email && payload.email.trim() !== "";
        return { 
          message: hasEmail 
            ? `[${payload.applicantName} 선생님] 출석 처리 및 참관 확인서 이메일(${payload.email})이 발송되었습니다.` 
            : `[${payload.applicantName} 선생님] 출석 처리가 완료되었습니다. (이메일 미입력으로 메일 발송 생략)`,
          status: app ? app.status : "ATTENDED" 
        };
      }

      case "batchToggleAttendance": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        const items = payload.items || [];
        let successCount = 0;
        items.forEach(item => {
          const app = store.applications.find(a => String(a.rowNum) === String(item.rowNum) || (String(a.classId) === String(item.classId) && a.applicantName === item.applicantName));
          if (app) {
            app.status = "ATTENDED";
            successCount++;
          }
        });
        saveMockStore(store);
        return {
          total: items.length,
          successCount: successCount,
          failCount: 0,
          message: `총 ${items.length}명 중 ${successCount}명 출석 처리 및 확인서 발송 완료`
        };
      }

      case "createObservationLog": {
        const targetClass = store.classes.find(c => String(c.id) === String(payload.classId));
        const className = targetClass ? `[${targetClass.subject}] ${targetClass.topic} (${targetClass.teacher} 선생님)` : "수업 참관록";
        const nowStr = new Date().toLocaleString("sv-SE").replace("T", " ");

        let fileUrl = payload.fileUrl || "";
        let fileName = payload.fileName || "";
        if (payload.fileData) {
          fileName = payload.fileData.name;
          fileUrl = "https://example.com/demo_uploaded_obs_" + encodeURIComponent(fileName);
        }

        if (!store.observations) store.observations = [];
        store.observations.unshift({
          id: `OBS-${Date.now().toString().slice(-6)}`,
          createdAt: nowStr,
          applicantName: payload.applicantName,
          school: payload.school || "",
          classId: payload.classId,
          className: className,
          content: payload.content,
          password: payload.password,
          isSecret: !!payload.isSecret,
          fileUrl: fileUrl,
          fileName: fileName
        });

        saveMockStore(store);
        return { message: "참관록이 성공적으로 제출되었습니다." };
      }

      case "deleteObservationLog": {
        if (!store.observations) store.observations = [];
        const target = store.observations.find(o => String(o.id) === String(payload.obsId));
        if (!target) throw new Error("참관록을 찾을 수 없습니다.");
        if (target.password !== payload.password && adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) {
          throw new Error("비밀번호가 일치하지 않습니다.");
        }
        store.observations = store.observations.filter(o => String(o.id) !== String(payload.obsId));
        saveMockStore(store);
        return { message: "참관록이 삭제되었습니다." };
      }

      default:
        throw new Error(`알 수 없는 POST Action: ${action}`);
    }
  }
};

window.API = API;
window.getInitialMockStore = getInitialMockStore;
window.saveMockStore = saveMockStore;
