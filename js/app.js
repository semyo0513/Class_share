/**
 * ==================================================================
 * 🏫 메인 애플리케이션 프론트엔드 로직 (js/app.js)
 * ==================================================================
 */

const AppState = {
  activeTab: "classes",
  activeSubjectFilter: "ALL",
  activeBoardCategory: "ALL",
  searchQuery: "",
  classes: [],
  notices: [],
  board: [],
  config: {},
  myApplications: [],
  currentCheckUser: { name: "", phone: "" }
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  renderSubjectFilters();
  renderBoardCategoryFilters();
  await loadInitialData();
}

async function loadInitialData() {
  try {
    showLoadingSkeletons();
    const data = await API.get("getInitialData");
    
    AppState.classes = data.classes || [];
    AppState.notices = data.notices || [];
    AppState.board = data.board || [];
    AppState.config = data.config || {};

    if (AppState.config.EVENT_TITLE) {
      document.title = AppState.config.EVENT_TITLE;
      const headerTitleEl = document.getElementById("headerTitle");
      if (headerTitleEl) headerTitleEl.textContent = AppState.config.EVENT_TITLE;
    }

    updateHeroStats();
    renderClasses();
    renderNotices();
    renderBoard();
  } catch (err) {
    console.error("초기 데이터 로딩 오류:", err);
    showToast(`데이터 로딩 실패: ${err.message}`, "error");
  }
}

function navigateTab(tabName) {
  AppState.activeTab = tabName;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("bg-indigo-800", "text-white");
    btn.classList.add("text-indigo-200");
  });

  const activeBtn = document.getElementById(`tabBtn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove("text-indigo-200");
    activeBtn.classList.add("bg-indigo-800", "text-white");
  }

  document.querySelectorAll(".tab-content").forEach(sec => sec.classList.add("hidden"));
  const activeSec = document.getElementById(`view-${tabName}`);
  if (activeSec) {
    activeSec.classList.remove("hidden");
    activeSec.classList.add("animate-fadeIn");
  }

  const heroBanner = document.getElementById("heroBanner");
  if (heroBanner) {
    if (tabName === "classes") heroBanner.classList.remove("hidden");
    else heroBanner.classList.add("hidden");
  }

  if (tabName === "admin") {
    checkAdminAuthState();
  } else if (tabName === "board") {
    loadBoardData();
  } else if (tabName === "notices") {
    loadNoticesData();
  }
}

function updateHeroStats() {
  const classes = AppState.classes || [];
  const totalClasses = classes.length;
  const totalApplicants = classes.reduce((sum, c) => sum + (c.currentApplied || 0), 0);
  const availableClasses = classes.filter(c => !c.isFull && c.status !== "CLOSED" && !c.isDeadlinePassed).length;

  document.getElementById("statTotalClasses").textContent = totalClasses;
  document.getElementById("statTotalApplicants").textContent = totalApplicants;
  document.getElementById("statAvailableClasses").textContent = availableClasses;
}

function renderSubjectFilters() {
  const container = document.getElementById("subjectFilterContainer");
  if (!container) return;

  const categories = ["ALL", ...CONFIG.SUBJECT_CATEGORIES];
  container.innerHTML = categories.map(cat => {
    const isAll = cat === "ALL";
    const label = isAll ? "전체 보기" : cat;
    const isActive = AppState.activeSubjectFilter === cat;
    const activeClass = isActive 
      ? "bg-indigo-600 text-white font-semibold shadow-sm" 
      : "bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium";

    return `
      <button onclick="filterSubject('${cat}')" class="px-3 py-1.5 rounded-full text-xs transition-all ${activeClass}">
        ${label}
      </button>
    `;
  }).join("");
}

function filterSubject(subject) {
  AppState.activeSubjectFilter = subject;
  renderSubjectFilters();
  renderClasses();
}

function handleClassSearch() {
  const input = document.getElementById("classSearchInput");
  if (input) {
    AppState.searchQuery = input.value.trim().toLowerCase();
    renderClasses();
  }
}

function showLoadingSkeletons() {
  const grid = document.getElementById("classListGrid");
  if (!grid) return;
  
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-pulse">
      <div class="flex justify-between items-center">
        <div class="h-5 w-16 bg-slate-200 rounded"></div>
        <div class="h-5 w-20 bg-slate-200 rounded-full"></div>
      </div>
      <div class="h-6 w-3/4 bg-slate-200 rounded"></div>
      <div class="h-10 bg-slate-200 rounded-xl"></div>
    </div>
  `).join("");
}

function renderClasses() {
  const grid = document.getElementById("classListGrid");
  if (!grid) return;

  let list = AppState.classes || [];

  if (AppState.activeSubjectFilter !== "ALL") {
    list = list.filter(c => c.subject === AppState.activeSubjectFilter);
  }

  if (AppState.searchQuery) {
    const q = AppState.searchQuery;
    list = list.filter(c => 
      (c.topic && c.topic.toLowerCase().includes(q)) ||
      (c.teacher && c.teacher.toLowerCase().includes(q)) ||
      (c.subject && c.subject.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
        <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-full mx-auto flex items-center justify-center text-xl">
          <i class="fa-solid fa-folder-open"></i>
        </div>
        <p class="text-sm font-semibold text-slate-700">개설된 수업이 없습니다.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(item => {
    const isClosed = item.status === "CLOSED" || item.isFull || item.isDeadlinePassed;
    const capacity = item.capacity || 0;
    const current = item.currentApplied || 0;
    const isImminent = !isClosed && capacity > 0 && (capacity - current) <= 2;

    let badgeHtml = "";
    if (item.status === "CLOSED") {
      badgeHtml = `<span class="badge-closed text-xs font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-lock mr-1"></i>수동 마감</span>`;
    } else if (item.isDeadlinePassed) {
      badgeHtml = `<span class="badge-closed text-xs font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-clock-rotate-left mr-1"></i>기한 마감</span>`;
    } else if (isClosed) {
      badgeHtml = `<span class="badge-closed text-xs font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-user-xmark mr-1"></i>정원 마감</span>`;
    } else if (isImminent) {
      badgeHtml = `<span class="badge-warning text-xs font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-fire mr-1"></i>마감 임박 (${capacity - current}석)</span>`;
    } else {
      badgeHtml = `<span class="badge-available text-xs font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-circle-check mr-1"></i>신청 가능</span>`;
    }

    const percent = capacity > 0 ? Math.min(100, Math.round((current / capacity) * 100)) : 0;
    const progressBarColor = isClosed ? "bg-rose-500" : (isImminent ? "bg-amber-500" : "bg-indigo-600");

    const attachmentHtml = item.fileUrl ? `
      <a href="${item.fileUrl}" target="_blank" class="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200/60 transition-colors">
        <i class="fa-solid fa-file-arrow-down"></i> ${item.fileName || "수업자료 다운로드"}
      </a>
    ` : "";

    const deadlineHtml = item.deadline ? `
      <div class="flex items-center gap-1 text-[11px] text-slate-400">
        <i class="fa-regular fa-calendar-check text-slate-400"></i>
        <span>신청마감일시: <strong class="text-slate-600 font-semibold">${item.deadline}</strong></span>
      </div>
    ` : "";

    return `
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
        <div class="space-y-3">
          <div class="flex justify-between items-center gap-2">
            <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
              ${escapeHtml(item.subject)}
            </span>
            ${badgeHtml}
          </div>

          <h3 class="text-base font-bold text-slate-900 leading-snug hover:text-indigo-600 transition-colors">
            ${escapeHtml(item.topic)}
          </h3>

          <div class="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-user text-slate-400 w-4"></i>
              <span class="font-semibold text-slate-800">${escapeHtml(item.teacher)} 선생님</span>
              <span class="text-slate-400">|</span>
              <span>${escapeHtml(item.gradeGroup)}</span>
            </div>
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-clock text-slate-400 w-4"></i>
              <span>${escapeHtml(item.dateTime)}</span>
            </div>
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-location-dot text-slate-400 w-4"></i>
              <span class="font-medium text-slate-700">${escapeHtml(item.location)}</span>
            </div>
          </div>

          ${item.description ? `
            <p class="text-xs text-slate-500 line-clamp-3 leading-relaxed">
              ${escapeHtml(item.description)}
            </p>
          ` : ""}
        </div>

        <div class="space-y-3 pt-2 border-t border-slate-100">
          ${attachmentHtml}
          ${deadlineHtml}

          <div class="space-y-1">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-slate-500">참관 신청 현황</span>
              <span class="text-slate-800">${current} / ${capacity > 0 ? capacity + "명" : "제한없음"}</span>
            </div>
            ${capacity > 0 ? `
              <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div class="${progressBarColor} h-2 rounded-full transition-all duration-500" style="width: ${percent}%"></div>
              </div>
            ` : ""}
          </div>

          <button 
            onclick="openApplyModal('${item.id}')"
            ${isClosed ? "disabled" : ""}
            class="w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 ${
              isClosed 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
            }">
            ${isClosed ? `<i class="fa-solid fa-ban"></i> 참관 신청 마감` : `<i class="fa-solid fa-pen-nib"></i> 참관 신청하기`}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function openApplyModal(classId) {
  const item = AppState.classes.find(c => String(c.id) === String(classId));
  if (!item) return;

  document.getElementById("applyClassId").value = item.id;
  document.getElementById("modalClassSubject").textContent = item.subject;
  document.getElementById("modalClassTopic").textContent = item.topic;
  document.getElementById("modalClassTeacher").textContent = `${item.teacher} 선생님 | ${item.location}`;

  document.getElementById("applyForm").reset();

  const modal = document.getElementById("applyModal");
  if (modal) modal.classList.remove("hidden");
}

function closeApplyModal() {
  const modal = document.getElementById("applyModal");
  if (modal) modal.classList.add("hidden");
}

async function submitApplication(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("applySubmitBtn");
  const originalText = submitBtn.innerHTML;
  
  const payload = {
    classId: document.getElementById("applyClassId").value,
    applicantName: document.getElementById("applyName").value.trim(),
    school: document.getElementById("applySchool").value.trim(),
    phone: document.getElementById("applyPhone").value.trim(),
    email: document.getElementById("applyEmail").value.trim(),
    remark: document.getElementById("applyRemark").value.trim()
  };

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> 접수 처리 중...`;

    const res = await API.post("applyClass", payload);
    showToast(res.message || "참관 신청이 정상 완료되었습니다!", "success");
    closeApplyModal();
    await loadInitialData();
  } catch (err) {
    showToast(`신청 실패: ${err.message}`, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/* ==================================================================
 * 참관 신청 확인 / 수정 / 취소 기능
 * ================================================================== */
function openCheckApplyModal() {
  const modal = document.getElementById("checkApplyModal");
  if (modal) modal.classList.remove("hidden");
}

function closeCheckApplyModal() {
  const modal = document.getElementById("checkApplyModal");
  if (modal) modal.classList.add("hidden");
}

function closeMyApplyResultModal() {
  const modal = document.getElementById("myApplyResultModal");
  if (modal) modal.classList.add("hidden");
}

async function handleCheckApplySubmit(event) {
  event.preventDefault();
  const name = document.getElementById("checkName").value.trim();
  const phone = document.getElementById("checkPhone").value.trim();

  if (!name || !phone) {
    showToast("성명과 연락처를 입력해주세요.", "error");
    return;
  }

  const submitBtn = document.getElementById("checkSubmitBtn");
  const origText = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 조회 중...`;

    const list = await API.post("checkMyApplications", { applicantName: name, phone: phone });
    AppState.myApplications = list || [];
    AppState.currentCheckUser = { name, phone };

    closeCheckApplyModal();
    renderMyApplicationsResult();
  } catch (err) {
    showToast(`조회 실패: ${err.message}`, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origText;
  }
}

function renderMyApplicationsResult() {
  const modal = document.getElementById("myApplyResultModal");
  const container = document.getElementById("myApplyListContainer");
  if (!modal || !container) return;

  modal.classList.remove("hidden");

  const apps = AppState.myApplications || [];

  if (apps.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-500 space-y-2 border border-slate-200 rounded-xl">
        <i class="fa-solid fa-circle-question text-3xl text-slate-300"></i>
        <p class="text-sm font-semibold">입력하신 정보로 접수된 참관 신청 내역이 없습니다.</p>
        <p class="text-xs text-slate-400">성명과 연락처를 다시 확인해 주세요.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = apps.map(a => `
    <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3" id="myAppCard-${a.classId}">
      <div class="flex justify-between items-start">
        <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          신청 완료 (${a.timestamp})
        </span>
        <div class="flex gap-1">
          <button onclick="toggleMyApplyEditForm('${a.classId}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold">
            <i class="fa-solid fa-pen mr-1"></i> 수정
          </button>
          <button onclick="cancelMyApply('${a.classId}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-xs font-semibold">
            <i class="fa-solid fa-trash-can mr-1"></i> 신청 취소
          </button>
        </div>
      </div>

      <h4 class="text-sm font-bold text-slate-900">${escapeHtml(a.className)}</h4>

      <!-- 기본 정보 보기 -->
      <div id="myAppView-${a.classId}" class="space-y-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
        <p><strong>신청자:</strong> ${escapeHtml(a.applicantName)} (${escapeHtml(a.school)})</p>
        <p><strong>연락처:</strong> ${escapeHtml(a.phone)} | <strong>이메일:</strong> ${escapeHtml(a.email || "미입력")}</p>
        <p><strong>기대사항/비고:</strong> ${escapeHtml(a.remark || "없음")}</p>
      </div>

      <!-- 정보 수정 폼 (초기 숨김) -->
      <form id="myAppEditForm-${a.classId}" onsubmit="saveMyApplyEdit(event, '${a.classId}')" class="hidden space-y-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">소속 학교명 *</label>
          <input type="text" id="editSchool-${a.classId}" required value="${escapeHtml(a.school)}" class="w-full px-3 py-1.5 border border-slate-300 rounded-lg">
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">이메일 주소</label>
          <input type="email" id="editEmail-${a.classId}" value="${escapeHtml(a.email)}" class="w-full px-3 py-1.5 border border-slate-300 rounded-lg">
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">참관 목적 / 비고</label>
          <textarea id="editRemark-${a.classId}" rows="2" class="w-full px-3 py-1.5 border border-slate-300 rounded-lg">${escapeHtml(a.remark)}</textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="toggleMyApplyEditForm('${a.classId}')" class="px-3 py-1 bg-slate-200 text-slate-700 rounded font-semibold">취소</button>
          <button type="submit" class="px-3 py-1 bg-emerald-600 text-white rounded font-semibold">저장하기</button>
        </div>
      </form>
    </div>
  `).join("");
}

function toggleMyApplyEditForm(classId) {
  const viewEl = document.getElementById(`myAppView-${classId}`);
  const editEl = document.getElementById(`myAppEditForm-${classId}`);
  if (viewEl && editEl) {
    viewEl.classList.toggle("hidden");
    editEl.classList.toggle("hidden");
  }
}

async function saveMyApplyEdit(event, classId) {
  event.preventDefault();
  const user = AppState.currentCheckUser;
  
  const payload = {
    classId: classId,
    applicantName: user.name,
    phone: user.phone,
    school: document.getElementById(`editSchool-${classId}`).value.trim(),
    email: document.getElementById(`editEmail-${classId}`).value.trim(),
    remark: document.getElementById(`editRemark-${classId}`).value.trim()
  };

  try {
    const res = await API.post("updateMyApplication", payload);
    showToast(res.message || "수정되었습니다.", "success");
    
    // 로컬 상태 업데이트 후 재렌더링
    const target = AppState.myApplications.find(a => String(a.classId) === String(classId));
    if (target) {
      target.school = payload.school;
      target.email = payload.email;
      target.remark = payload.remark;
    }
    renderMyApplicationsResult();
  } catch (err) {
    showToast(`수정 실패: ${err.message}`, "error");
  }
}

async function cancelMyApply(classId) {
  if (!confirm("정말 이 수업의 참관 신청을 취소하시겠습니까?\n취소 후에는 선착순 정원이 해제됩니다.")) return;

  const user = AppState.currentCheckUser;
  const payload = {
    classId: classId,
    applicantName: user.name,
    phone: user.phone
  };

  try {
    const res = await API.post("cancelMyApplication", payload);
    showToast(res.message || "신청이 취소되었습니다.", "success");
    
    AppState.myApplications = AppState.myApplications.filter(a => String(a.classId) !== String(classId));
    renderMyApplicationsResult();
    await loadInitialData();
  } catch (err) {
    showToast(`취소 실패: ${err.message}`, "error");
  }
}

/**
 * 공지사항 및 게시판 로직
 */
async function loadNoticesData() {
  try {
    const list = await API.get("getNotices");
    AppState.notices = list || [];
    renderNotices();
  } catch (e) {
    console.error(e);
  }
}

function renderNotices() {
  const container = document.getElementById("noticeListContainer");
  if (!container) return;

  const notices = AppState.notices || [];

  if (notices.length === 0) {
    container.innerHTML = `<div class="p-12 text-center text-slate-500 text-sm">등록된 공지사항이 없습니다.</div>`;
    return;
  }

  container.innerHTML = notices.map(item => `
    <div class="p-5 hover:bg-slate-50 transition-colors space-y-2 ${item.isPinned ? "bg-amber-50/40 border-l-4 border-amber-500" : ""}">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          ${item.isPinned ? `<span class="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded">📌 필독</span>` : ""}
          <h3 class="text-base font-bold text-slate-900">${escapeHtml(item.title)}</h3>
        </div>
        <span class="text-xs text-slate-400 shrink-0">${item.createdAt || ""}</span>
      </div>
      <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed">${escapeHtml(item.content)}</p>
      ${item.fileUrl ? `
        <div class="pt-1">
          <a href="${item.fileUrl}" target="_blank" class="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
            <i class="fa-solid fa-paperclip"></i> 첨부파일 다운로드
          </a>
        </div>
      ` : ""}
    </div>
  `).join("");
}

async function loadBoardData() {
  try {
    const list = await API.get("getBoard");
    AppState.board = list || [];
    renderBoard();
  } catch (e) {
    console.error(e);
  }
}

function renderBoardCategoryFilters() {
  const container = document.getElementById("boardCategoryFilterContainer");
  if (!container) return;

  const categories = ["ALL", ...CONFIG.BOARD_CATEGORIES];
  container.innerHTML = categories.map(cat => {
    const isActive = AppState.activeBoardCategory === cat;
    const label = cat === "ALL" ? "전체 글" : cat;
    const cls = isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200";
    return `<button onclick="filterBoardCategory('${cat}')" class="px-3 py-1 rounded-lg text-xs font-semibold transition-all ${cls}">${label}</button>`;
  }).join("");
}

function filterBoardCategory(cat) {
  AppState.activeBoardCategory = cat;
  renderBoardCategoryFilters();
  renderBoard();
}

function renderBoard() {
  const container = document.getElementById("boardListContainer");
  if (!container) return;

  let list = AppState.board || [];
  if (AppState.activeBoardCategory !== "ALL") {
    list = list.filter(b => b.category === AppState.activeBoardCategory);
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="col-span-full bg-white p-12 rounded-2xl text-center text-slate-500 border border-slate-200 text-sm">게시글이 없습니다. 첫 의견을 작성해보세요!</div>`;
    return;
  }

  container.innerHTML = list.map(item => `
    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
      <div class="space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">${escapeHtml(item.category || "자유소통")}</span>
          <span class="text-xs text-slate-400">${item.createdAt || ""}</span>
        </div>
        <h3 class="text-sm font-bold text-slate-900">${escapeHtml(item.title)}</h3>
        <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed">${escapeHtml(item.content)}</p>
      </div>

      <div class="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
        <span class="text-slate-500 font-medium"><i class="fa-solid fa-user-circle text-slate-400 mr-1"></i> ${escapeHtml(item.author)} (${escapeHtml(item.school || "소속미입력")})</span>
        <button onclick="openBoardDeleteModal('${item.id}')" class="text-rose-500 hover:text-rose-700 font-semibold"><i class="fa-solid fa-trash-can mr-1"></i> 삭제</button>
      </div>
    </div>
  `).join("");
}

function openBoardWriteModal() {
  const modal = document.getElementById("boardWriteModal");
  if (modal) modal.classList.remove("hidden");
}

function closeBoardWriteModal() {
  const modal = document.getElementById("boardWriteModal");
  if (modal) modal.classList.add("hidden");
}

async function submitBoardPost(event) {
  event.preventDefault();
  const btn = document.getElementById("boardSubmitBtn");
  const orig = btn.innerHTML;

  const payload = {
    author: document.getElementById("boardAuthor").value.trim(),
    school: document.getElementById("boardSchool").value.trim(),
    category: document.getElementById("boardCategory").value,
    password: document.getElementById("boardPassword").value.trim(),
    title: document.getElementById("boardTitle").value.trim(),
    content: document.getElementById("boardContent").value.trim()
  };

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...`;

    const res = await API.post("createBoardPost", payload);
    showToast(res.message || "글이 등록되었습니다.", "success");
    closeBoardWriteModal();
    await loadBoardData();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function openBoardDeleteModal(postId) {
  document.getElementById("deletePostId").value = postId;
  document.getElementById("deletePostPassword").value = "";
  document.getElementById("boardDeleteModal").classList.remove("hidden");
}

function closeBoardDeleteModal() {
  document.getElementById("boardDeleteModal").classList.add("hidden");
}

async function confirmDeleteBoardPost() {
  const postId = document.getElementById("deletePostId").value;
  const password = document.getElementById("deletePostPassword").value;

  if (!password) {
    showToast("비밀번호를 입력해주세요.", "error");
    return;
  }

  try {
    const res = await API.post("deleteBoardPost", { postId, password });
    showToast(res.message || "삭제되었습니다.", "success");
    closeBoardDeleteModal();
    await loadBoardData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const colors = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    info: "bg-slate-800 text-white"
  };

  const toast = document.createElement("div");
  toast.className = `${colors[type] || colors.info} px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 pointer-events-auto transition-all animate-scaleUp`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
