/**
 * ==================================================================
 * 🏫 프론트엔드 메인 애플리케이션 모듈 (js/app.js)
 * ==================================================================
 */

const AppState = {
  activeTab: "classes",
  classes: [],
  notices: [],
  board: [],
  config: {},
  activeSubjectFilter: "ALL",
  activeBoardCategory: "ALL",
  searchQuery: "",
  myApplications: [],
  currentCheckUser: { name: "", phone: "" }
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  try {
    checkAdminAuthState();
    await loadInitialData();
    renderSubjectFilters();
    renderBoardCategoryFilters();
    navigateTab(AppState.activeTab);
  } catch (err) {
    showToast("초기 데이터를 불러오는데 실패하였습니다.", "error");
    console.error(err);
  }
}

async function loadInitialData() {
  try {
    const data = await API.get("getInitialData");
    AppState.classes = data.classes || [];
    AppState.notices = data.notices || [];
    AppState.config = data.config || {};

    if (AppState.config.EVENT_TITLE) {
      const headerTitle = document.getElementById("headerTitle");
      if (headerTitle) headerTitle.textContent = AppState.config.EVENT_TITLE;
    }

    updateHeaderStats();
    renderClasses();
  } catch (err) {
    console.error("초기 데이터 로드 에러:", err);
  }
}

function updateHeaderStats() {
  const classes = AppState.classes || [];
  const statTotalClasses = document.getElementById("statTotalClasses");
  const statTotalApplicants = document.getElementById("statTotalApplicants");
  const statAvailableClasses = document.getElementById("statAvailableClasses");

  if (statTotalClasses) statTotalClasses.textContent = classes.length;

  let totalApps = 0;
  let availableCount = 0;

  classes.forEach(c => {
    totalApps += (c.currentApplied || 0);
    if (!c.isFull && c.status !== "CLOSED" && !c.isDeadlinePassed) {
      availableCount++;
    }
  });

  if (statTotalApplicants) statTotalApplicants.textContent = totalApps;
  if (statAvailableClasses) statAvailableClasses.textContent = availableCount;
}

function navigateTab(tabName) {
  AppState.activeTab = tabName;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("bg-indigo-800", "text-white");
    btn.classList.add("text-indigo-200", "hover:bg-indigo-800", "hover:text-white");
  });

  const activeBtn = document.getElementById(`tabBtn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove("text-indigo-200", "hover:bg-indigo-800", "hover:text-white");
    activeBtn.classList.add("bg-indigo-800", "text-white");
  }

  document.querySelectorAll(".tab-content").forEach(section => {
    section.classList.add("hidden");
  });

  const activeSection = document.getElementById(`view-${tabName}`);
  if (activeSection) {
    activeSection.classList.remove("hidden");
  }

  const heroBanner = document.getElementById("heroBanner");
  if (heroBanner) {
    if (tabName === "classes") {
      heroBanner.classList.remove("hidden");
    } else {
      heroBanner.classList.add("hidden");
    }
  }

  if (tabName === "notices") {
    loadNoticesData();
  } else if (tabName === "board") {
    loadBoardData();
  } else if (tabName === "admin") {
    checkAdminAuthState();
  }
}

/* ==================================================================
 * 수업 목록 및 검색/필터링
 * ================================================================== */
function renderSubjectFilters() {
  const container = document.getElementById("subjectFilterContainer");
  if (!container) return;

  const subjects = ["ALL", ...CONFIG.SUBJECT_CATEGORIES];
  container.innerHTML = subjects.map(sub => {
    const isActive = AppState.activeSubjectFilter === sub;
    const label = sub === "ALL" ? "전체 교과" : sub;
    const cls = isActive 
      ? "bg-indigo-600 text-white shadow-sm font-bold" 
      : "bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium";
    
    return `<button onclick="filterBySubject('${sub}')" class="px-3 py-1.5 rounded-xl text-xs transition-all ${cls}">${label}</button>`;
  }).join("");
}

function filterBySubject(subject) {
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

function renderClasses() {
  const grid = document.getElementById("classListGrid");
  if (!grid) return;

  let filtered = AppState.classes || [];

  if (AppState.activeSubjectFilter !== "ALL") {
    filtered = filtered.filter(c => c.subject === AppState.activeSubjectFilter);
  }

  if (AppState.searchQuery) {
    const q = AppState.searchQuery;
    filtered = filtered.filter(c => 
      c.teacher.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      c.topic.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-3">
        <div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 text-xl">
          <i class="fa-solid fa-magnifying-glass"></i>
        </div>
        <p class="font-semibold text-sm">검색 조건에 해당하거나 개설된 수업이 없습니다.</p>
        <p class="text-xs text-slate-400">다른 교과 카테고리를 선택하시거나 검색어를 변경해 보세요.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(c => renderClassCardHtml(c)).join("");
}

function renderClassCardHtml(c) {
  const isClosed = c.isFull || c.status === "CLOSED" || c.isDeadlinePassed;
  let badgeText = "신청 가능";
  let badgeClass = "bg-emerald-500 text-white";

  if (c.status === "CLOSED") {
    badgeText = "관리자 마감";
    badgeClass = "bg-rose-500 text-white";
  } else if (c.isDeadlinePassed) {
    badgeText = "기한 마감";
    badgeClass = "bg-rose-500 text-white";
  } else if (c.isFull) {
    badgeText = "선착순 마감";
    badgeClass = "bg-rose-500 text-white";
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4">
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">${escapeHtml(c.subject)}</span>
          <span class="px-2.5 py-1 rounded-lg text-xs font-bold ${badgeClass}">${badgeText}</span>
        </div>

        <div>
          <h3 class="text-base font-bold text-slate-900 leading-snug line-clamp-2">${escapeHtml(c.topic)}</h3>
          <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <i class="fa-solid fa-chalkboard-user text-indigo-600"></i>
            <span class="font-bold text-slate-800">${escapeHtml(c.teacher)} 선생님</span> (${escapeHtml(c.gradeGroup)})
          </p>
        </div>

        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
          <p class="flex items-center gap-1.5">
            <i class="fa-regular fa-clock text-slate-400"></i>
            <span>${escapeHtml(c.dateTime)}</span>
          </p>
          <p class="flex items-center gap-1.5">
            <i class="fa-solid fa-location-dot text-slate-400"></i>
            <span>${escapeHtml(c.location)}</span>
          </p>
          ${c.deadline ? `
            <p class="flex items-center gap-1.5 text-amber-700 font-medium pt-0.5">
              <i class="fa-solid fa-hourglass-half text-amber-600"></i>
              <span>마감기한: ${escapeHtml(c.deadline)}</span>
            </p>
          ` : ""}
        </div>

        <p class="text-xs text-slate-500 line-clamp-3 leading-relaxed">${escapeHtml(c.description || "상세 수업 소개가 준비 중입니다.")}</p>

        ${c.fileUrl ? `
          <div class="pt-1">
            <a href="${c.fileUrl}" target="_blank" class="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
              <i class="fa-solid fa-file-pdf"></i> ${escapeHtml(c.fileName || "수업지도안 다운로드")}
            </a>
          </div>
        ` : ""}
      </div>

      <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div class="text-xs">
          <span class="text-slate-400">신청 인원: </span>
          <span class="font-extrabold text-indigo-600">${c.currentApplied || 0}</span>
          <span class="text-slate-400"> / ${c.capacity > 0 ? c.capacity + '명' : '제한없음'}</span>
        </div>

        <button onclick="openApplyModal('${c.id}')" ${isClosed ? 'disabled' : ''} class="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isClosed ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow'}">
          ${isClosed ? '신청 마감' : '참관 신청하기'}
        </button>
      </div>
    </div>
  `;
}

/* ==================================================================
 * 참관 신청 모달 처리
 * ================================================================== */
function openApplyModal(classId) {
  const target = AppState.classes.find(c => String(c.id) === String(classId));
  if (!target) return;

  document.getElementById("applyClassId").value = target.id;
  document.getElementById("modalClassSubject").textContent = target.subject;
  document.getElementById("modalClassTopic").textContent = target.topic;
  document.getElementById("modalClassTeacher").textContent = `${target.teacher} 선생님 | ${target.location} (${target.dateTime})`;

  const modal = document.getElementById("applyModal");
  if (modal) modal.classList.remove("hidden");
}

function closeApplyModal() {
  const modal = document.getElementById("applyModal");
  if (modal) modal.classList.add("hidden");
}

async function submitApplication(event) {
  event.preventDefault();
  const btn = document.getElementById("applySubmitBtn");
  const origText = btn.innerHTML;

  const payload = {
    classId: document.getElementById("applyClassId").value,
    applicantName: document.getElementById("applyName").value.trim(),
    school: document.getElementById("applySchool").value.trim(),
    phone: document.getElementById("applyPhone").value.trim(),
    email: document.getElementById("applyEmail").value.trim(),
    remark: document.getElementById("applyRemark").value.trim()
  };

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 접수 중...`;

    const res = await API.post("applyClass", payload);
    showToast(res.message || "참관 신청이 정상 완료되었습니다.", "success");
    closeApplyModal();
    
    document.getElementById("applyForm").reset();
    await loadInitialData();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

/* ==================================================================
 * 본인 참관 신청 확인 / 수정 / 취소 모달
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
  const btn = document.getElementById("checkSubmitBtn");

  if (!name || !phone) return;

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 조회 중...`;

    const list = await API.post("checkMyApplications", { applicantName: name, phone: phone });
    AppState.myApplications = list || [];
    AppState.currentCheckUser = { name, phone };

    closeCheckApplyModal();
    renderMyApplicationsResult();

    const resultModal = document.getElementById("myApplyResultModal");
    if (resultModal) resultModal.classList.remove("hidden");
  } catch (err) {
    showToast(`조회 실패: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `신청 내역 조회`;
  }
}

function renderMyApplicationsResult() {
  const container = document.getElementById("myApplyListContainer");
  if (!container) return;

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

      <div id="myAppView-${a.classId}" class="space-y-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
        <p><strong>신청자:</strong> ${escapeHtml(a.applicantName)} (${escapeHtml(a.school)})</p>
        <p><strong>연락처:</strong> ${escapeHtml(a.phone)} | <strong>이메일:</strong> ${escapeHtml(a.email || "미입력")}</p>
        <p><strong>기대사항/비고:</strong> ${escapeHtml(a.remark || "없음")}</p>
      </div>

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

/* ==================================================================
 * 공지사항 및 게시판 로직 (비밀글 및 파일 첨부 지원)
 * ================================================================== */
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
    const list = await API.get("getBoard", { adminPassword: AdminState.adminPassword });
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
    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between ${item.isSecret ? "bg-amber-50/20 border-amber-200" : ""}">
      <div class="space-y-2">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">${escapeHtml(item.category || "자유소통")}</span>
            ${item.isSecret ? `<span class="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200"><i class="fa-solid fa-lock mr-1"></i>비밀글</span>` : ""}
          </div>
          <span class="text-xs text-slate-400">${item.createdAt || ""}</span>
        </div>
        <h3 class="text-sm font-bold ${item.isSecret ? "text-amber-900" : "text-slate-900"}">${escapeHtml(item.title)}</h3>
        <p class="text-xs ${item.isSecret ? "text-slate-400 italic" : "text-slate-600"} whitespace-pre-line leading-relaxed">${escapeHtml(item.content)}</p>
        
        ${item.fileUrl ? `
          <div class="pt-1">
            <a href="${item.fileUrl}" target="_blank" class="inline-flex items-center gap-1.5 text-xs text-indigo-700 font-semibold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors">
              <i class="fa-solid fa-paperclip"></i> ${escapeHtml(item.fileName || "첨부파일 다운로드")}
            </a>
          </div>
        ` : ""}
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

  const fileInput = document.getElementById("boardFileInput");
  let fileData = null;

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    try {
      fileData = await readFileAsBase64(file);
    } catch (e) {
      showToast("파일을 읽는 도중 오류가 발생했습니다.", "error");
      return;
    }
  }

  const payload = {
    author: document.getElementById("boardAuthor").value.trim(),
    school: document.getElementById("boardSchool").value.trim(),
    category: document.getElementById("boardCategory").value,
    password: document.getElementById("boardPassword").value.trim(),
    title: document.getElementById("boardTitle").value.trim(),
    content: document.getElementById("boardContent").value.trim(),
    isSecret: document.getElementById("boardIsSecret").checked,
    fileData: fileData
  };

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...`;

    const res = await API.post("createBoardPost", payload);
    showToast(res.message || "글이 성공적으로 등록되었습니다.", "success");
    closeBoardWriteModal();
    
    document.getElementById("boardTitle").value = "";
    document.getElementById("boardContent").value = "";
    document.getElementById("boardPassword").value = "";
    if (fileInput) fileInput.value = "";
    document.getElementById("boardIsSecret").checked = false;

    await loadBoardData();
  } catch (err) {
    showToast(`등록 실패: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function openBoardDeleteModal(postId) {
  document.getElementById("deletePostId").value = postId;
  document.getElementById("deletePostPassword").value = "";
  const modal = document.getElementById("boardDeleteModal");
  if (modal) modal.classList.remove("hidden");
}

function closeBoardDeleteModal() {
  const modal = document.getElementById("boardDeleteModal");
  if (modal) modal.classList.add("hidden");
}

async function confirmDeleteBoardPost() {
  const postId = document.getElementById("deletePostId").value;
  const pw = document.getElementById("deletePostPassword").value.trim();

  if (!pw) {
    showToast("비밀번호를 입력해주세요.", "error");
    return;
  }

  try {
    const res = await API.post("deleteBoardPost", { postId, password: pw }, AdminState.adminPassword);
    showToast(res.message || "삭제되었습니다.", "success");
    closeBoardDeleteModal();
    await loadBoardData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* ==================================================================
 * 공통 유틸리티 (토스트, HTML 이스케이프)
 * ================================================================== */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  const bgMap = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    info: "bg-slate-800 text-white"
  };
  const iconMap = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info"
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto ${bgMap[type] || bgMap.info}`;
  toast.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.info}"></i> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  }, 10);

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
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
