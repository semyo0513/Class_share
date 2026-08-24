/**
 * ==================================================================
 * 🏫 관리자 전용 대시보드 및 연동 모듈 (js/admin.js)
 * ==================================================================
 */

const AdminState = {
  isLoggedIn: false,
  adminPassword: "",
  activeSubTab: "classes",
  applications: [],
  config: {}
};

function checkAdminAuthState() {
  const savedPw = sessionStorage.getItem("SAMHYUN_ADMIN_PW");
  if (savedPw) {
    AdminState.isLoggedIn = true;
    AdminState.adminPassword = savedPw;
  }

  const loginContainer = document.getElementById("adminLoginContainer");
  const panelContainer = document.getElementById("adminPanelContainer");

  if (AdminState.isLoggedIn) {
    if (loginContainer) loginContainer.classList.add("hidden");
    if (panelContainer) {
      panelContainer.classList.remove("hidden");
      renderAdminDashboard();
    }
  } else {
    if (loginContainer) loginContainer.classList.remove("hidden");
    if (panelContainer) panelContainer.classList.add("hidden");
  }
}

async function handleAdminLoginSubmit(event) {
  event.preventDefault();
  const inputEl = document.getElementById("adminPasswordInput");
  const btn = document.getElementById("adminLoginBtn");
  const pw = inputEl.value.trim();

  if (!pw) return;

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 인증 중...`;

    const res = await API.post("adminLogin", {}, pw);
    if (res.authorized) {
      AdminState.isLoggedIn = true;
      AdminState.adminPassword = pw;
      sessionStorage.setItem("SAMHYUN_ADMIN_PW", pw);
      showToast("관리자로 로그인되었습니다.", "success");
      checkAdminAuthState();
    }
  } catch (err) {
    showToast(`로그인 실패: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `로그인`;
  }
}

function handleAdminLogout() {
  AdminState.isLoggedIn = false;
  AdminState.adminPassword = "";
  sessionStorage.removeItem("SAMHYUN_ADMIN_PW");
  showToast("로그아웃 되었습니다.", "info");
  checkAdminAuthState();
}

function renderAdminDashboard() {
  const container = document.getElementById("adminPanelContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900">관리자 대시보드</h2>
          <p class="text-xs text-slate-500">수업 개설, 참관 신청자 명단, 공지사항, 구글 드라이브 환경 설정을 통합 관리합니다.</p>
        </div>
        <button onclick="handleAdminLogout()" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">
          <i class="fa-solid fa-right-from-bracket mr-1"></i> 로그아웃
        </button>
      </div>

      <div class="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
        <button onclick="switchAdminSubTab('classes')" id="adminSubTab-classes" class="admin-subtab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-indigo-600 text-white shadow-sm">
          <i class="fa-solid fa-chalkboard-user mr-1"></i> 수업 개설 및 마감 관리
        </button>
        <button onclick="switchAdminSubTab('applicants')" id="adminSubTab-applicants" class="admin-subtab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200">
          <i class="fa-solid fa-users mr-1"></i> 참관 신청자 명단
        </button>
        <button onclick="switchAdminSubTab('notices')" id="adminSubTab-notices" class="admin-subtab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200">
          <i class="fa-solid fa-bullhorn mr-1"></i> 공지사항 관리
        </button>
        <button onclick="switchAdminSubTab('config')" id="adminSubTab-config" class="admin-subtab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200">
          <i class="fa-solid fa-gear mr-1"></i> 드라이브/환경 설정
        </button>
      </div>

      <div id="adminSubContent"></div>
    </div>
    <div id="adminModalsContainer"></div>
  `;

  switchAdminSubTab(AdminState.activeSubTab);
}

function switchAdminSubTab(subTab) {
  AdminState.activeSubTab = subTab;

  document.querySelectorAll(".admin-subtab").forEach(btn => {
    btn.classList.remove("bg-indigo-600", "text-white", "shadow-sm");
    btn.classList.add("bg-slate-100", "text-slate-600");
  });

  const activeBtn = document.getElementById(`adminSubTab-${subTab}`);
  if (activeBtn) {
    activeBtn.classList.remove("bg-slate-100", "text-slate-600");
    activeBtn.classList.add("bg-indigo-600", "text-white", "shadow-sm");
  }

  if (subTab === "classes") {
    renderAdminClassesView();
  } else if (subTab === "applicants") {
    renderAdminApplicantsView();
  } else if (subTab === "notices") {
    renderAdminNoticesView();
  } else if (subTab === "config") {
    renderAdminConfigView();
  }
}

/* ==================================================================
 * 1. 수업 개설 및 마감 관리 서브 탭
 * ================================================================== */
function renderAdminClassesView() {
  const container = document.getElementById("adminSubContent");
  const classes = AppState.classes || [];

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-bold text-slate-800">개설 수업 목록 (${classes.length}개)</h3>
        <button onclick="openClassFormModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5">
          <i class="fa-solid fa-plus"></i> 새 공개수업 개설
        </button>
      </div>

      <div class="overflow-x-auto border border-slate-200 rounded-xl">
        <table class="w-full text-left text-xs text-slate-600">
          <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th class="p-3">ID / 교과</th>
              <th class="p-3">수업자 / 장소</th>
              <th class="p-3">수업 일시</th>
              <th class="p-3">수업 주제</th>
              <th class="p-3">신청/정원</th>
              <th class="p-3">신청 마감 기한</th>
              <th class="p-3 text-right">상태 / 관리</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${classes.length === 0 ? `
              <tr><td colspan="7" class="p-8 text-center text-slate-400">등록된 수업이 없습니다.</td></tr>
            ` : classes.map(c => {
              const isClosed = c.status === "CLOSED";
              return `
                <tr class="hover:bg-slate-50">
                  <td class="p-3 font-semibold">
                    <span class="text-indigo-600 block">${c.id}</span>
                    <span class="text-slate-500">${escapeHtml(c.subject)}</span>
                  </td>
                  <td class="p-3">
                    <div class="font-bold text-slate-900">${escapeHtml(c.teacher)}</div>
                    <div class="text-slate-400 text-[11px]">${escapeHtml(c.location)}</div>
                  </td>
                  <td class="p-3 whitespace-nowrap text-slate-700 font-medium">
                    ${escapeHtml(c.dateTime)}
                  </td>
                  <td class="p-3 max-w-xs font-medium text-slate-800">
                    ${escapeHtml(c.topic)}
                  </td>
                  <td class="p-3 whitespace-nowrap">
                    <span class="font-bold text-indigo-700">${c.currentApplied || 0}</span> / ${c.capacity > 0 ? c.capacity + '명' : '제한없음'}
                  </td>
                  <td class="p-3 whitespace-nowrap text-slate-500">
                    ${c.deadline ? escapeHtml(c.deadline) : '<span class="text-slate-300">미설정</span>'}
                  </td>
                  <td class="p-3 text-right whitespace-nowrap space-x-1">
                    <button onclick="toggleAdminClassStatus('${c.id}', '${c.status}')" class="px-2.5 py-1 ${isClosed ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-rose-100 hover:bg-rose-200 text-rose-800'} rounded-lg text-[11px] font-semibold">
                      ${isClosed ? '<i class="fa-solid fa-lock-open mr-1"></i>신청 재개' : '<i class="fa-solid fa-lock mr-1"></i>신청 마감'}
                    </button>
                    <button onclick="openClassFormModal('${c.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">
                      수정
                    </button>
                    <button onclick="deleteAdminClass('${c.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-semibold">
                      삭제
                    </button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function parseDateTimePickerValues(dateTimeStr) {
  let dateVal = "2026-10-15";
  let startTime = "13:30";
  let endTime = "14:20";
  let periodLabel = "5교시";

  if (dateTimeStr) {
    const matchDate = dateTimeStr.match(/\d{4}-\d{2}-\d{2}/);
    if (matchDate) dateVal = matchDate[0];

    const matchTimes = dateTimeStr.match(/(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/);
    if (matchTimes) {
      startTime = matchTimes[1];
      endTime = matchTimes[2];
    }

    const matchPeriod = dateTimeStr.match(/\(([^)]+)\)/);
    if (matchPeriod) {
      periodLabel = matchPeriod[1];
    }
  }

  return { dateVal, startTime, endTime, periodLabel };
}

function parseDeadlinePickerValue(deadlineStr) {
  if (!deadlineStr) return "";
  const d = deadlineStr.trim();
  if (d.includes("T")) return d.slice(0, 16);
  return d.replace(" ", "T").slice(0, 16);
}

function handlePeriodPresetChange() {
  const sel = document.getElementById("formClassPeriodPreset").value;
  const presets = {
    "1교시": { start: "09:00", end: "09:50", label: "1교시" },
    "2교시": { start: "10:00", end: "10:50", label: "2교시" },
    "3교시": { start: "11:00", end: "11:50", label: "3교시" },
    "4교시": { start: "12:00", end: "12:50", label: "4교시" },
    "5교시": { start: "13:30", end: "14:20", label: "5교시" },
    "6교시": { start: "14:30", end: "15:20", label: "6교시" },
    "7교시": { start: "15:30", end: "16:20", label: "7교시" }
  };

  if (presets[sel]) {
    document.getElementById("formClassStartTime").value = presets[sel].start;
    document.getElementById("formClassEndTime").value = presets[sel].end;
    document.getElementById("formClassPeriodLabel").value = presets[sel].label;
  }
}

function openClassFormModal(classId = null) {
  const item = classId ? AppState.classes.find(c => String(c.id) === String(classId)) : null;

  const dtParsed = parseDateTimePickerValues(item ? item.dateTime : "");
  const deadlineParsed = parseDeadlinePickerValue(item ? item.deadline : "");

  const modalHtml = `
    <div id="adminClassModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 class="text-base font-bold text-slate-900">${item ? "수업 정보 수정" : "새 공개수업 개설"}</h3>
          <button onclick="closeAdminModal('adminClassModal')" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-xl"></i></button>
        </div>

        <form onsubmit="saveAdminClass(event)" class="space-y-4 text-xs">
          <input type="hidden" id="formClassId" value="${item ? item.id : ""}">

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">교과목 카테고리 *</label>
              <select id="formClassSubject" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">
                ${CONFIG.SUBJECT_CATEGORIES.map(s => `
                  <option value="${s}" ${item && item.subject === s ? "selected" : ""}>${s}</option>
                `).join("")}
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">수업 교사명 *</label>
              <input type="text" id="formClassTeacher" required value="${item ? escapeHtml(item.teacher) : ""}" placeholder="예: 김수현" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">대상 학년/학급 *</label>
              <input type="text" id="formClassGrade" required value="${item ? escapeHtml(item.gradeGroup) : ""}" placeholder="예: 1학년 3반" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">수업 장소 *</label>
              <input type="text" id="formClassLocation" required value="${item ? escapeHtml(item.location) : ""}" placeholder="예: 2층 과학실" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">
            </div>
          </div>

          <div class="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-3">
            <label class="block font-bold text-indigo-900 flex items-center gap-1.5">
              <i class="fa-regular fa-calendar-days text-indigo-600"></i> 수업 일시 선택 *
            </label>
            
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">수업 날짜 (달력 선택)</label>
                <input type="date" id="formClassDate" required value="${dtParsed.dateVal}" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">교시 프리셋 선택</label>
                <select id="formClassPeriodPreset" onchange="handlePeriodPresetChange()" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white">
                  <option value="1교시" ${dtParsed.periodLabel === "1교시" ? "selected" : ""}>1교시 (09:00 ~ 09:50)</option>
                  <option value="2교시" ${dtParsed.periodLabel === "2교시" ? "selected" : ""}>2교시 (10:00 ~ 10:50)</option>
                  <option value="3교시" ${dtParsed.periodLabel === "3교시" ? "selected" : ""}>3교시 (11:00 ~ 11:50)</option>
                  <option value="4교시" ${dtParsed.periodLabel === "4교시" ? "selected" : ""}>4교시 (12:00 ~ 12:50)</option>
                  <option value="5교시" ${dtParsed.periodLabel === "5교시" || !dtParsed.periodLabel ? "selected" : ""}>5교시 (13:30 ~ 14:20)</option>
                  <option value="6교시" ${dtParsed.periodLabel === "6교시" ? "selected" : ""}>6교시 (14:30 ~ 15:20)</option>
                  <option value="7교시" ${dtParsed.periodLabel === "7교시" ? "selected" : ""}>7교시 (15:30 ~ 16:20)</option>
                  <option value="CUSTOM">직접 시간 지정</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">시작 시간</label>
                <input type="time" id="formClassStartTime" required value="${dtParsed.startTime}" class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">종료 시간</label>
                <input type="time" id="formClassEndTime" required value="${dtParsed.endTime}" class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">교시 명칭</label>
                <input type="text" id="formClassPeriodLabel" required value="${dtParsed.periodLabel}" placeholder="예: 5교시" class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">최대 정원 (0=무제한) *</label>
              <input type="number" id="formClassCapacity" min="0" required value="${item ? item.capacity : 15}" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <i class="fa-regular fa-clock text-amber-600"></i> 참관 신청 마감 일시 (클릭 선택)
              </label>
              <input type="datetime-local" id="formClassDeadline" value="${deadlineParsed}" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white">
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">수업 주제 *</label>
            <input type="text" id="formClassTopic" required value="${item ? escapeHtml(item.topic) : ""}" placeholder="예: AI 도구를 활용한 논증문 쓰기" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">수업 상세 소개 및 참관 포인트</label>
            <textarea id="formClassDesc" rows="3" placeholder="수업 진행 의도 및 관전 포인트를 기술하세요." class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">${item ? escapeHtml(item.description || "") : ""}</textarea>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <label class="block font-semibold text-slate-700">수업지도안 / 학습자료 첨부 (PDF, HWP, PPT)</label>
            <input type="file" id="formClassFileInput" class="w-full text-xs text-slate-500">
            ${item && item.fileUrl ? `
              <p class="text-[11px] text-indigo-600">현재 등록된 파일: <a href="${item.fileUrl}" target="_blank" class="underline">${escapeHtml(item.fileName)}</a></p>
            ` : ""}
          </div>

          <div class="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button type="button" onclick="closeAdminModal('adminClassModal')" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold">취소</button>
            <button type="submit" id="saveClassSubmitBtn" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow">저장하기</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("adminModalsContainer").innerHTML = modalHtml;
}

async function saveAdminClass(event) {
  event.preventDefault();
  const btn = document.getElementById("saveClassSubmitBtn");
  const origText = btn.innerHTML;

  const fileInput = document.getElementById("formClassFileInput");
  let fileData = null;

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    try {
      fileData = await readFileAsBase64(file);
    } catch (e) {
      showToast("파일 인코딩 오류가 발생했습니다.", "error");
      return;
    }
  }

  const classDate = document.getElementById("formClassDate").value;
  const startTime = document.getElementById("formClassStartTime").value;
  const endTime = document.getElementById("formClassEndTime").value;
  const periodLabel = document.getElementById("formClassPeriodLabel").value.trim();

  let dateTimeFormatted = classDate;
  if (startTime && endTime) {
    dateTimeFormatted += ` ${startTime} ~ ${endTime}`;
  }
  if (periodLabel) {
    dateTimeFormatted += ` (${periodLabel})`;
  }

  const deadlineVal = document.getElementById("formClassDeadline").value;
  let deadlineFormatted = "";
  if (deadlineVal) {
    deadlineFormatted = deadlineVal.replace("T", " ") + ":00";
  }

  const payload = {
    id: document.getElementById("formClassId").value || null,
    subject: document.getElementById("formClassSubject").value,
    teacher: document.getElementById("formClassTeacher").value.trim(),
    gradeGroup: document.getElementById("formClassGrade").value.trim(),
    location: document.getElementById("formClassLocation").value.trim(),
    dateTime: dateTimeFormatted,
    capacity: Number(document.getElementById("formClassCapacity").value) || 0,
    topic: document.getElementById("formClassTopic").value.trim(),
    description: document.getElementById("formClassDesc").value.trim(),
    deadline: deadlineFormatted,
    fileData: fileData
  };

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...`;

    const res = await API.post("saveClass", payload, AdminState.adminPassword);
    showToast(res.message || "수업이 성공적으로 저장되었습니다.", "success");
    closeAdminModal("adminClassModal");
    await loadInitialData();
    renderAdminClassesView();
  } catch (err) {
    showToast(`저장 실패: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

async function toggleAdminClassStatus(classId, currentStatus) {
  const nextStatus = currentStatus === "CLOSED" ? "ACTIVE" : "CLOSED";
  const actionName = nextStatus === "CLOSED" ? "신청 마감" : "신청 재개";

  if (!confirm(`이 수업을 [${actionName}] 상태로 변경하시겠습니까?`)) return;

  try {
    const res = await API.post("toggleClassStatus", { classId, status: nextStatus }, AdminState.adminPassword);
    showToast(res.message || "상태가 변경되었습니다.", "success");
    await loadInitialData();
    renderAdminClassesView();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteAdminClass(classId) {
  if (!confirm("정말 이 수업을 삭제하시겠습니까?")) return;

  try {
    const res = await API.post("deleteClass", { classId }, AdminState.adminPassword);
    showToast(res.message || "삭제되었습니다.", "success");
    await loadInitialData();
    renderAdminClassesView();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* ==================================================================
 * 2. 참관 신청자 명단 서브 탭
 * ================================================================== */
async function renderAdminApplicantsView() {
  const container = document.getElementById("adminSubContent");
  container.innerHTML = `<div class="p-8 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> 신청자 명단을 불러오는 중...</div>`;

  try {
    const list = await API.get("getAdminApplications", { adminPassword: AdminState.adminPassword });
    AdminState.applications = list || [];
    renderApplicantTable();
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-rose-600 font-bold">명단 로드 실패: ${err.message}</div>`;
  }
}

function renderApplicantTable() {
  const container = document.getElementById("adminSubContent");
  const apps = AdminState.applications || [];

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 class="text-sm font-bold text-slate-800">전체 참관 신청자 명단 (${apps.length}명)</h3>
        </div>
        <div class="flex gap-2">
          <button onclick="printApplicantsList()" class="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow">
            <i class="fa-solid fa-print"></i> 명단 인쇄
          </button>
          <button onclick="exportApplicantsCsv()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow">
            <i class="fa-solid fa-file-excel"></i> 엑셀(CSV) 다운로드
          </button>
        </div>
      </div>

      <div class="overflow-x-auto border border-slate-200 rounded-xl">
        <table class="w-full text-left text-xs text-slate-600">
          <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th class="p-3">신청일시</th>
              <th class="p-3">성명</th>
              <th class="p-3">소속 학교</th>
              <th class="p-3">연락처</th>
              <th class="p-3">이메일</th>
              <th class="p-3">신청 수업명</th>
              <th class="p-3">상태</th>
              <th class="p-3">비고 / 참관목적</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${apps.length === 0 ? `
              <tr><td colspan="8" class="p-8 text-center text-slate-400">접수된 신청 내역이 없습니다.</td></tr>
            ` : apps.map(a => `
              <tr class="hover:bg-slate-50 ${a.status === 'CANCELLED' ? 'bg-slate-100/70 text-slate-400 line-through' : ''}">
                <td class="p-3 whitespace-nowrap">${a.timestamp}</td>
                <td class="p-3 font-bold text-slate-900 whitespace-nowrap">${escapeHtml(a.applicantName)}</td>
                <td class="p-3 font-medium text-slate-800 whitespace-nowrap">${escapeHtml(a.school)}</td>
                <td class="p-3 whitespace-nowrap">${escapeHtml(a.phone)}</td>
                <td class="p-3 whitespace-nowrap">${escapeHtml(a.email)}</td>
                <td class="p-3 font-semibold text-indigo-700 max-w-xs">${escapeHtml(a.className)}</td>
                <td class="p-3 whitespace-nowrap font-bold ${a.status === 'CANCELLED' ? 'text-rose-500' : 'text-emerald-600'}">
                  ${a.status === 'CANCELLED' ? '신청취소' : '신청완료'}
                </td>
                <td class="p-3 max-w-xs text-slate-500">${escapeHtml(a.remark || "-")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function exportApplicantsCsv() {
  const apps = (AdminState.applications || []).filter(a => a.status !== "CANCELLED");
  if (apps.length === 0) {
    showToast("다운로드할 신청 내역이 없습니다.", "error");
    return;
  }

  let csvContent = "\uFEFF";
  csvContent += "신청일시,성명,소속학교,연락처,이메일,신청수업,참관목적\n";

  apps.forEach(a => {
    const row = [
      `"${a.timestamp}"`,
      `"${a.applicantName}"`,
      `"${a.school}"`,
      `"${a.phone}"`,
      `"${a.email}"`,
      `"${a.className.replace(/"/g, '""')}"`,
      `"${(a.remark || "").replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `삼현수업나눔_참관신청자명단_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function printApplicantsList() {
  const apps = (AdminState.applications || []).filter(a => a.status !== "CANCELLED");
  const printArea = document.getElementById("printArea");
  if (!printArea) return;

  printArea.innerHTML = `
    <div style="font-family: Pretendard, sans-serif;">
      <h1 style="font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 20px;">삼현 수업나눔한마당 참관 신청자 명단</h1>
      <p style="font-size: 10pt; text-align: right; margin-bottom: 10px;">출력일시: ${new Date().toLocaleString("ko-KR")}</p>
      <table>
        <thead>
          <tr>
            <th>순번</th>
            <th>신청일시</th>
            <th>성명</th>
            <th>소속 학교</th>
            <th>연락처</th>
            <th>신청 수업명</th>
            <th>서명</th>
          </tr>
        </thead>
        <tbody>
          ${apps.map((a, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td>${a.timestamp}</td>
              <td style="font-weight: bold;">${escapeHtml(a.applicantName)}</td>
              <td>${escapeHtml(a.school)}</td>
              <td>${escapeHtml(a.phone)}</td>
              <td>${escapeHtml(a.className)}</td>
              <td style="width: 60px;"></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  window.print();
}

/* ==================================================================
 * 3. 공지사항 관리 서브 탭
 * ================================================================== */
function renderAdminNoticesView() {
  const container = document.getElementById("adminSubContent");
  const notices = AppState.notices || [];

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-bold text-slate-800">공지사항 관리 (${notices.length}개)</h3>
        <button onclick="openNoticeFormModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5">
          <i class="fa-solid fa-plus"></i> 새 공지 작성
        </button>
      </div>

      <div class="space-y-3">
        ${notices.map(n => `
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-start gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                ${n.isPinned ? `<span class="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">상단고정</span>` : ""}
                <h4 class="text-sm font-bold text-slate-900">${escapeHtml(n.title)}</h4>
              </div>
              <p class="text-xs text-slate-500 line-clamp-2">${escapeHtml(n.content)}</p>
              ${n.fileUrl ? `
                <div class="pt-1 text-[11px] text-indigo-600 font-medium">
                  <a href="${n.fileUrl}" target="_blank" class="hover:underline inline-flex items-center gap-1">
                    <i class="fa-solid fa-paperclip"></i> 첨부파일 보기
                  </a>
                </div>
              ` : ""}
            </div>
            <div class="flex gap-1 shrink-0">
              <button onclick="openNoticeFormModal('${n.id}')" class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold">수정</button>
              <button onclick="deleteAdminNotice('${n.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold">삭제</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function openNoticeFormModal(noticeId = null) {
  const item = noticeId ? AppState.notices.find(n => String(n.id) === String(noticeId)) : null;

  const modalHtml = `
    <div id="adminNoticeModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
        <div class="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 class="text-base font-bold text-slate-900">${item ? "공지사항 수정" : "새 공지사항 작성"}</h3>
          <button onclick="closeAdminModal('adminNoticeModal')" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-xl"></i></button>
        </div>

        <form onsubmit="saveAdminNotice(event)" class="space-y-4 text-xs">
          <input type="hidden" id="formNoticeId" value="${item ? item.id : ""}">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">제목 *</label>
            <input type="text" id="formNoticeTitle" required value="${item ? escapeHtml(item.title) : ""}" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">내용 *</label>
            <textarea id="formNoticeContent" rows="5" required class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">${item ? escapeHtml(item.content) : ""}</textarea>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <label class="block font-semibold text-slate-700">공지 첨부파일 업로드 (Google Drive 저장)</label>
            <input type="file" id="formNoticeFileInput" class="w-full text-xs text-slate-500">
            ${item && item.fileUrl ? `
              <p class="text-[11px] text-indigo-600">현재 등록된 파일: <a href="${item.fileUrl}" target="_blank" class="underline"><i class="fa-solid fa-paperclip"></i> 기존 첨부파일 보기</a></p>
            ` : ""}
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="formNoticePinned" ${item && item.isPinned ? "checked" : ""} class="rounded text-indigo-600 focus:ring-indigo-500">
            <label for="formNoticePinned" class="font-semibold text-slate-700">목록 상단에 고정 표시</label>
          </div>
          <div class="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button type="button" onclick="closeAdminModal('adminNoticeModal')" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold">취소</button>
            <button type="submit" id="saveNoticeSubmitBtn" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow">저장하기</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("adminModalsContainer").innerHTML = modalHtml;
}

async function saveAdminNotice(event) {
  event.preventDefault();
  const btn = document.getElementById("saveNoticeSubmitBtn");
  const orig = btn.innerHTML;

  const fileInput = document.getElementById("formNoticeFileInput");
  let fileData = null;

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    try {
      fileData = await readFileAsBase64(file);
    } catch (e) {
      showToast("파일 인코딩 오류가 발생했습니다.", "error");
      return;
    }
  }

  const payload = {
    id: document.getElementById("formNoticeId").value || null,
    title: document.getElementById("formNoticeTitle").value.trim(),
    content: document.getElementById("formNoticeContent").value.trim(),
    isPinned: document.getElementById("formNoticePinned").checked,
    fileData: fileData
  };

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...`;

    const res = await API.post("saveNotice", payload, AdminState.adminPassword);
    showToast(res.message || "공지사항이 저장되었습니다.", "success");
    closeAdminModal("adminNoticeModal");
    await loadNoticesData();
    renderAdminNoticesView();
  } catch (err) {
    showToast(`저장 실패: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

async function deleteAdminNotice(noticeId) {
  if (!confirm("정말 이 공지사항을 삭제하시겠습니까?")) return;

  try {
    const res = await API.post("deleteNotice", { noticeId }, AdminState.adminPassword);
    showToast(res.message || "삭제되었습니다.", "success");
    await loadNoticesData();
    renderAdminNoticesView();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* ==================================================================
 * 4. 환경 설정 서브 탭 (구글 드라이브 폴더 ID 설정 등)
 * ================================================================== */
async function renderAdminConfigView() {
  const container = document.getElementById("adminSubContent");
  container.innerHTML = `<div class="p-8 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> 구글 시트 설정을 불러오는 중...</div>`;

  try {
    const configMap = await API.get("getConfig");
    AdminState.config = configMap || {};
    const driveFolderId = AdminState.config.DRIVE_FOLDER_ID || "";
    const eventTitle = AdminState.config.EVENT_TITLE || "2026 삼현 수업나눔한마당";
    const isRegOpen = (AdminState.config.IS_REGISTRATION_OPEN || "TRUE").toUpperCase() === "TRUE";

    container.innerHTML = `
      <div class="space-y-6 max-w-2xl">
        <div>
          <h3 class="text-base font-bold text-slate-900 mb-1">⚙️ 시스템 환경 설정</h3>
          <p class="text-xs text-slate-500">구글 시트의 <code class="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">Config</code> 탭에 지정되는 설정입니다. 웹사이트 및 구글 시트 양쪽에서 모두 변경할 수 있습니다.</p>
        </div>

        <form onsubmit="saveDriveFolderConfig(event)" class="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-4 text-xs">
          <div>
            <label class="block font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
              <i class="fa-fab fa-google-drive text-indigo-600 text-sm"></i> 구글 드라이브 업로드 폴더 ID (또는 전체 URL)
            </label>
            <p class="text-[11px] text-slate-500 mb-2 leading-relaxed">
              수업지도안, 공지사항, 게시판 Q&A 파일 업로드 시 파일이 생성되는 Google Drive 폴더입니다.<br>
              💡 구글 드라이브 폴더 주소 URL 전체(예: <code class="bg-white px-1 border text-slate-700">https://drive.google.com/drive/folders/1a2b3c...</code>)를 그대로 넣으셔도 자동으로 폴더 ID가 추출됩니다.
            </p>
            <input type="text" id="adminDriveFolderInput" value="${escapeHtml(driveFolderId)}" placeholder="예: 1a2b3c4d5e... 또는 https://drive.google.com/drive/folders/..." class="w-full px-3.5 py-2.5 border border-indigo-200 rounded-xl text-xs bg-white font-mono focus:ring-2 focus:ring-indigo-500">
          </div>

          <div class="flex justify-between items-center pt-2">
            <span class="text-[11px] text-slate-400">구글 시트 <code class="text-slate-600 font-mono">Config</code> 시트 5행 2열(B5) 값과 자동 연동됩니다.</span>
            <button type="submit" id="saveDriveFolderBtn" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow transition-all">
              폴더 ID 저장하기
            </button>
          </div>
        </form>

        <form onsubmit="saveEventTitleConfig(event)" class="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
          <div>
            <label class="block font-bold text-slate-800 mb-1">행사 메인 타이틀 명칭</label>
            <input type="text" id="adminEventTitleInput" value="${escapeHtml(eventTitle)}" required class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500">
          </div>

          <div class="flex justify-end pt-1">
            <button type="submit" id="saveEventTitleBtn" class="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow">
              행사명 저장
            </button>
          </div>
        </form>

        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
          <h4 class="font-bold text-slate-800">📊 구글 스프레드시트 직관적 수정 안내</h4>
          <p class="text-slate-600 leading-relaxed">
            웹사이트 관리자 화면 외에도 연결된 <strong>Google 스프레드시트</strong>의 <strong><code class="bg-white border text-indigo-700 px-1 font-bold">Config</code> 탭</strong>에서 직접 값을 변경하실 수 있습니다:
          </p>
          <ul class="list-disc list-inside text-slate-500 space-y-1 pl-1">
            <li><strong>DRIVE_FOLDER_ID (B행 5열)</strong>: 구글 드라이브 폴더 ID (또는 전체 URL)</li>
            <li><strong>EVENT_TITLE (B행 3열)</strong>: 행사 타이틀 명칭</li>
            <li><strong>IS_REGISTRATION_OPEN (B행 4열)</strong>: <code class="font-bold text-emerald-600">TRUE</code> (신청가능) / <code class="font-bold text-rose-600">FALSE</code> (신청차단)</li>
          </ul>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-rose-600 font-bold">설정 데이터 로드 실패: ${err.message}</div>`;
  }
}

async function saveDriveFolderConfig(event) {
  event.preventDefault();
  const inputVal = document.getElementById("adminDriveFolderInput").value.trim();
  const btn = document.getElementById("saveDriveFolderBtn");

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...`;

    const res = await API.post("saveConfig", { key: "DRIVE_FOLDER_ID", value: inputVal, description: "첨부파일이 업로드될 Google Drive 폴더 ID" }, AdminState.adminPassword);
    showToast(res.message || "구글 드라이브 폴더 ID가 저장되었습니다.", "success");
    await loadInitialData();
    renderAdminConfigView();
  } catch (err) {
    showToast(`저장 실패: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `폴더 ID 저장하기`;
  }
}

async function saveEventTitleConfig(event) {
  event.preventDefault();
  const inputVal = document.getElementById("adminEventTitleInput").value.trim();
  const btn = document.getElementById("saveEventTitleBtn");

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...`;

    const res = await API.post("saveConfig", { key: "EVENT_TITLE", value: inputVal, description: "행사 메인 제목" }, AdminState.adminPassword);
    showToast(res.message || "행사 타이틀이 저장되었습니다.", "success");
    await loadInitialData();
    renderAdminConfigView();
  } catch (err) {
    showToast(`저장 실패: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `행사명 저장`;
  }
}

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

function closeAdminModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}
