/**
 * ==================================================================
 * 🏫 백엔드 통신 API 모듈 (Google Apps Script 연동 & Mock Fallback)
 * ==================================================================
 */

const MOCK_STORAGE_KEY = "SAMHYUN_APP_MOCK_DATA_V1";

function getInitialMockStore() {
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch (e) {}
  }

  const defaultData = {
    classes: [
      {
        id: "CLS-2026-001",
        subject: "국어",
        teacher: "김수현",
        gradeGroup: "1학년 3반",
        dateTime: "2026-10-15 13:30 ~ 14:20 (5교시)",
        location: "1학년 3반 교실",
        topic: "AI 도구를 활용한 논증문 작성 및 상호 피드백 수업",
        description: "생성형 AI와 동료 평가 플랫폼을 활용하여 논리적 글쓰기 역량을 함양하는 융합 수업입니다.",
        capacity: 15,
        currentApplied: 12,
        isFull: false,
        fileUrl: "https://example.com/sample_korean_plan.pdf",
        fileName: "1학년_국어_수업지도안.pdf",
        status: "ACTIVE",
        createdAt: "2026-08-20 09:00:00",
        deadline: "2026-10-14 18:00:00"
      }
    ],
    applications: [],
    notices: [],
    board: [],
    config: {
      EVENT_TITLE: "2026 삼현 수업나눔한마당",
      IS_REGISTRATION_OPEN: "TRUE",
      DRIVE_FOLDER_ID: "",
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
      try {
        const url = new URL(CONFIG.GAS_API_URL);
        url.searchParams.append("action", action);
        Object.keys(params).forEach(k => {
          if (params[k] !== undefined && params[k] !== null) {
            url.searchParams.append(k, params[k]);
          }
        });

        const res = await fetch(url.toString(), { method: "GET" });
        const json = await res.json();
        if (json.success) return json.data;
        throw new Error(json.data?.error || json.error || json.message || "구글 시트 데이터 조회 실패");
      } catch (err) {
        console.error(`[GAS GET ${action} 통신 실패]`, err);
        throw err;
      }
    }
    return this.getMock(action, params);
  },

  async post(action, payload = {}, adminPassword = null) {
    if (CONFIG.GAS_API_URL && CONFIG.GAS_API_URL.trim().startsWith("http")) {
      try {
        const bodyData = { action, payload, adminPassword };
        const res = await fetch(CONFIG.GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(bodyData)
        });

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
        console.error(`[GAS POST ${action} 통신 실패]`, err);
        throw err;
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
            title: `[참관 기대평] [${target.subject}] ${target.topic} (${target.teacher} 선생님)`,
            content: `💡 참관 기대평 / 수업자 전달 한마디:\n${String(payload.remark).trim()}`,
            password: payload.password || "",
            category: "자유소통",
            isSecret: false,
            fileUrl: "",
            fileName: ""
          });
        }

        saveMockStore(store);
        return { 
          message: payload.remark && String(payload.remark).trim() !== "" 
            ? "참관 신청 완료 및 참관 기대평이 나눔마당(게시판)에 자동 등록되었습니다." 
            : "참관 신청이 성공적으로 접수되었습니다.", 
          classTitle: target.topic 
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

      default:
        throw new Error(`알 수 없는 POST Action: ${action}`);
    }
  }
};
