/**
 * ==================================================================
 * 🏫 백엔드 통신 API 모듈 (Google Apps Script 연동 & Mock Fallback)
 * ==================================================================
 */

// 초기 데모(Mock) 데이터 정의
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
        description: "생성형 AI와 동료 평가 플랫폼을 활용하여 논리적 글쓰기 역량을 함양하는 융합 수업입니다. 학생들의 생성형 AI 윤리적 활용 사례를 참관하실 수 있습니다.",
        capacity: 15,
        currentApplied: 12,
        isFull: false,
        fileUrl: "https://example.com/sample_korean_plan.pdf",
        fileName: "1학년_국어_수업지도안.pdf",
        status: "ACTIVE",
        createdAt: "2026-08-20 09:00:00"
      },
      {
        id: "CLS-2026-002",
        subject: "수학",
        teacher: "박민우",
        gradeGroup: "2학년 5반",
        dateTime: "2026-10-15 14:30 ~ 15:20 (6교시)",
        location: "2층 수학선진화실",
        topic: "지오지브라(GeoGebra) 기반 이차함수 그래프의 실생활 탐구",
        description: "동적 공학 도구를 활용해 실생활 건축물에 숨겨진 이차함수를 시각화하고 모둠별 탐구 발표를 진행합니다.",
        capacity: 10,
        currentApplied: 10,
        isFull: true,
        fileUrl: "",
        fileName: "",
        status: "ACTIVE",
        createdAt: "2026-08-21 11:30:00"
      },
      {
        id: "CLS-2026-003",
        subject: "과학",
        teacher: "이진아",
        gradeGroup: "3학년 2반",
        dateTime: "2026-10-16 10:30 ~ 11:20 (2교시)",
        location: "3층 과학실험2실",
        topic: "센서 모듈을 활용한 미세먼지 측정 및 환경 데이터 분석",
        description: "아두이노 센서로 학교 내 미세먼지 데이터를 실시간 측정하고 통계 지표로 가공하는 탐구실험 수업입니다.",
        capacity: 12,
        currentApplied: 4,
        isFull: false,
        fileUrl: "https://example.com/sample_science.pdf",
        fileName: "3학년_과학탐구_실험지.pdf",
        status: "ACTIVE",
        createdAt: "2026-08-22 14:15:00"
      },
      {
        id: "CLS-2026-004",
        subject: "사회/역사",
        teacher: "정해성",
        gradeGroup: "1학년 1반",
        dateTime: "2026-10-16 11:30 ~ 12:20 (3교시)",
        location: "미디어 융합실",
        topic: "지역 문화유산 디지털 도감 제작 및 모의 학술제",
        description: "지역의 근현대 역사 유적지를 조사하여 디지털 지도를 구축하고 모의 학술 발표를 실시합니다.",
        capacity: 20,
        currentApplied: 8,
        isFull: false,
        fileUrl: "",
        fileName: "",
        status: "ACTIVE",
        createdAt: "2026-08-23 16:00:00"
      }
    ],
    applications: [
      {
        rowNum: 2,
        timestamp: "2026-08-24 09:10:00",
        applicantName: "홍길동",
        school: "진주고등학교",
        phone: "010-1234-5678",
        email: "hong@gne.go.kr",
        classId: "CLS-2026-001",
        className: "[국어] AI 도구를 활용한 논증문 작성 및 상호 피드백 수업 (김수현 선생님)",
        remark: "AI 피드백 도입 방식이 궁금합니다.",
        status: "CONFIRMED"
      },
      {
        rowNum: 3,
        timestamp: "2026-08-24 09:40:00",
        applicantName: "강영희",
        school: "삼현여자중학교",
        phone: "010-9876-5432",
        email: "kang@gne.go.kr",
        classId: "CLS-2026-002",
        className: "[수학] 지오지브라(GeoGebra) 기반 이차함수 그래프의 실생활 탐구 (박민우 선생님)",
        remark: "공학도구 교실 활용 팁을 배우고 싶습니다.",
        status: "CONFIRMED"
      }
    ],
    notices: [
      {
        id: "NOT-001",
        createdAt: "2026-08-20 09:00:00",
        title: "📢 2026 삼현 수업나눔한마당 개최 안내 및 참관 신청 방법",
        content: "선생님 여러분 안녕하십니까?\n2026 삼현 수업나눔한마당이 10월 15일~16일 진행됩니다.\n수업 목록 탭에서 원하시는 공개수업을 탐색하신 후 참관 신청을 진행해주시기 바랍니다.",
        isPinned: true,
        author: "행사운영본부",
        fileUrl: ""
      },
      {
        id: "NOT-002",
        createdAt: "2026-08-22 13:00:00",
        title: "📌 참관 교사 주차 및 등록 장소 안내",
        content: "행사 당일 본교 운동장 주차 공간이 혼잡할 수 있으니 가급적 대중교통을 이용해 주시기 바랍니다.\n등록 등록대는 본관 1층 로비에서 운영됩니다.",
        isPinned: false,
        author: "행사운영본부",
        fileUrl: ""
      }
    ],
    board: [
      {
        id: "BRD-001",
        createdAt: "2026-08-23 11:20:00",
        author: "최철수",
        school: "명석고등학교",
        title: "수업 지도안 양식을 다운로드받을 수 있나요?",
        content: "개별 수업 카드 하단에 첨부파일 아이콘이 없는 수업도 추후 등록될 예정인지 궁금합니다.",
        category: "사전질의"
      },
      {
        id: "BRD-002",
        createdAt: "2026-08-24 10:00:00",
        author: "행사운영본부",
        school: "삼현여자고등학교",
        title: "안녕하세요! 수업지도안은 수업 선생님 제출 상황에 따라 순차 업데이트됩니다.",
        content: "수업 개설 선생님들께서 자료를 업로드하시는 대로 수업 카드에 반영되오니 참고 부탁드립니다.",
        category: "자유소통"
      }
    ],
    config: {
      EVENT_TITLE: "2026 삼현 수업나눔한마당",
      IS_REGISTRATION_OPEN: "TRUE"
    }
  };

  saveMockStore(defaultData);
  return defaultData;
}

function saveMockStore(data) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
}

/**
 * SHA-256 계산 유틸리티
 */
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * API 호출 서비스
 */
const API = {
  /**
   * GET 요청
   */
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
        throw new Error(json.data?.error || json.message || "서버 응답 에러");
      } catch (err) {
        console.warn(`[GAS GET ${action} 실패 -> Mock Fallback 사용]`, err);
        return this.getMock(action, params);
      }
    }
    return this.getMock(action, params);
  },

  /**
   * POST 요청
   */
  async post(action, payload = {}, adminPassword = null) {
    if (CONFIG.GAS_API_URL && CONFIG.GAS_API_URL.trim().startsWith("http")) {
      try {
        const bodyData = { action, payload, adminPassword };
        const res = await fetch(CONFIG.GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(bodyData)
        });
        const json = await res.json();
        if (json.success) return json.data;
        throw new Error(json.data?.error || json.message || "처리 실패");
      } catch (err) {
        console.warn(`[GAS POST ${action} 실패 -> Mock Fallback 사용]`, err);
        return this.postMock(action, payload, adminPassword);
      }
    }
    return this.postMock(action, payload, adminPassword);
  },

  /**
   * Mock 데이터 GET 처리
   */
  async getMock(action, params = {}) {
    const store = getInitialMockStore();
    
    switch (action) {
      case "getInitialData":
        return {
          classes: store.classes,
          notices: store.notices,
          config: store.config
        };

      case "getClasses":
        return store.classes;

      case "getNotices":
        return store.notices;

      case "getBoard":
        return store.board;

      case "getAdminApplications":
        if (params.adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) {
          throw new Error("관리자 인증 비밀번호가 올바르지 않습니다.");
        }
        return store.applications;

      default:
        throw new Error(`알 수 없는 GET Action: ${action}`);
    }
  },

  /**
   * Mock 데이터 POST 처리
   */
  async postMock(action, payload = {}, adminPassword = null) {
    const store = getInitialMockStore();

    switch (action) {
      case "adminLogin":
        if (adminPassword === CONFIG.DEMO_ADMIN_PASSWORD) {
          return { authorized: true };
        }
        throw new Error("비밀번호가 일치하지 않습니다.");

      case "applyClass": {
        const target = store.classes.find(c => String(c.id) === String(payload.classId));
        if (!target) throw new Error("수업을 찾을 수 없습니다.");
        
        // 중복 전화번호 체크
        const cleanPhone = String(payload.phone).replace(/[^0-9]/g, "");
        const dup = store.applications.find(a => String(a.classId) === String(payload.classId) && a.phone.replace(/[^0-9]/g, "") === cleanPhone);
        if (dup) throw new Error("동일한 연락처로 이미 해당 수업을 신청하셨습니다.");

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
          applicantName: payload.applicantName,
          school: payload.school,
          phone: payload.phone,
          email: payload.email || "",
          classId: payload.classId,
          className: `[${target.subject}] ${target.topic} (${target.teacher} 선생님)`,
          remark: payload.remark || "",
          status: "CONFIRMED"
        });

        saveMockStore(store);
        return { message: "참관 신청이 성공적으로 접수되었습니다.", classTitle: target.topic };
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

        const noticeObj = {
          id: noticeId,
          createdAt: nowStr,
          title: payload.title,
          content: payload.content,
          isPinned: !!payload.isPinned,
          author: payload.author || "행사운영본부",
          fileUrl: payload.fileUrl || ""
        };

        const idx = store.notices.findIndex(n => String(n.id) === String(noticeId));
        if (idx >= 0) {
          store.notices[idx] = noticeObj;
        } else {
          store.notices.unshift(noticeObj);
        }

        saveMockStore(store);
        return { message: "공지사항이 저장되었습니다.", noticeId };
      }

      case "deleteNotice": {
        if (adminPassword !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error("관리자 권한이 필요합니다.");
        const targetId = payload.noticeId || payload;
        store.notices = store.notices.filter(n => String(n.id) !== String(targetId));
        saveMockStore(store);
        return { message: "공지사항이 삭제되었습니다." };
      }

      case "createBoardPost": {
        const nowStr = new Date().toLocaleString("sv-SE").replace("T", " ");
        const postId = `BRD-${Date.now().toString().slice(-6)}`;
        
        store.board.unshift({
          id: postId,
          createdAt: nowStr,
          author: payload.author,
          school: payload.school || "",
          title: payload.title,
          content: payload.content,
          password: payload.password,
          category: payload.category || "자유소통"
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

      default:
        throw new Error(`알 수 없는 POST Action: ${action}`);
    }
  }
};
