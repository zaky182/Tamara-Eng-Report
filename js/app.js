/**
 * Main Application Controller
 * Engineering Dept . PT Harapan Mitra Lestari
 */
(() => {
  const MONTHS_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // State Aplikasi
  const state = {
    currentUser: null,
    activeTab: 'dashboard', // 'dashboard' | 'input' | 'admin'
    adminSubTab: 'users',   // 'users' | 'dropdowns' | 'logos'
    users: [],
    dropdowns: {},          // { area: [], wheater: [], manPower: [], instrument: [] }
    reports: [],
    logos: {
      company: 'assets/logo-hml.png',
      pdfLeft: 'assets/logo-dbk.jpeg',
      pdfRight: 'assets/logo-petrosea.jpeg'
    },
    // Form state
    editingReportId: null,
    selectedManPower: [],
    selectedInstrument: [],
    uploadedImages: [],
    lastSubmittedReport: null,
    previewReport: null,
    editingUserId: null
  };

  // Helper DOM
  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message, isError = false) {
    const container = $('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast${isError ? ' toast-error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = '0.2s ease';
      setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  // ==================== DATA LOADING ====================
  async function loadAllData() {
    state.users = await DB.getAll('users');

    const ddList = await DB.getAll('dropdowns');
    state.dropdowns = {};
    ddList.forEach((d) => {
      state.dropdowns[d.key] = Array.isArray(d.items) ? d.items : [];
    });

    const reports = await DB.getAll('reports');
    // Urutkan terbaru di atas
    state.reports = reports.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    // Load custom logos if any
    const companyLogo = await DB.getOne('settings', 'logo_company');
    const pdfLeftLogo = await DB.getOne('settings', 'logo_pdf_left');
    const pdfRightLogo = await DB.getOne('settings', 'logo_pdf_right');

    state.logos.company = (companyLogo && companyLogo.value) || 'assets/logo-hml.png';
    state.logos.pdfLeft = (pdfLeftLogo && pdfLeftLogo.value) || 'assets/logo-dbk.jpeg';
    state.logos.pdfRight = (pdfRightLogo && pdfRightLogo.value) || 'assets/logo-petrosea.jpeg';

    applyLogosToUI();
  }

  function applyLogosToUI() {
    const loginLogo = $('loginCompanyLogo');
    const headerLogo = $('headerCompanyLogo');
    if (loginLogo) loginLogo.src = state.logos.company;
    if (headerLogo) headerLogo.src = state.logos.company;
  }

  // ==================== AUTHENTICATION ====================
  function restoreSession() {
    try {
      const saved = sessionStorage.getItem('hml_eng_session');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      const user = state.users.find((u) => u.id === parsed.id);
      if (user) {
        state.currentUser = user;
        return true;
      }
    } catch (_) {
      // ignore
    }
    return false;
  }

  function showLoginView() {
    $('loginView').classList.remove('hidden');
    $('appShell').classList.add('hidden');
    $('loginUsername').value = '';
    $('loginPassword').value = '';
    $('loginError').classList.add('hidden');
    $('loginUsername').focus();
  }

  function showAppShell() {
    $('loginView').classList.add('hidden');
    $('appShell').classList.remove('hidden');

    $('headerUserName').textContent = state.currentUser.fullName;
    const badge = $('headerRoleBadge');
    badge.textContent = state.currentUser.role === 'admin' ? 'Admin' : 'User';
    badge.className = `role-badge ${state.currentUser.role === 'admin' ? 'role-admin' : 'role-user'}`;

    // Tampilkan tab Admin Panel hanya untuk admin
    const adminTabBtn = $('navAdminBtn');
    if (state.currentUser.role === 'admin') {
      adminTabBtn.classList.remove('hidden');
    } else {
      adminTabBtn.classList.add('hidden');
    }

    switchTab('dashboard');
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;

    const user = state.users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (!user) {
      $('loginError').textContent = 'Username atau password salah. Silakan coba lagi.';
      $('loginError').classList.remove('hidden');
      return;
    }

    state.currentUser = user;
    sessionStorage.setItem('hml_eng_session', JSON.stringify({ id: user.id }));
    $('loginError').classList.add('hidden');
    showAppShell();
    showToast(`Selamat datang, ${user.fullName}!`);
  }

  function handleLogout() {
    state.currentUser = null;
    sessionStorage.removeItem('hml_eng_session');
    showLoginView();
    showToast('Anda telah keluar dari sistem.');
  }

  // ==================== NAVIGATION ====================
  function switchTab(tab) {
    if (tab === 'admin' && state.currentUser.role !== 'admin') {
      tab = 'dashboard';
    }
    state.activeTab = tab;

    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    $('tabDashboard').classList.toggle('hidden', tab !== 'dashboard');
    $('tabInput').classList.toggle('hidden', tab !== 'input');
    $('tabAdmin').classList.toggle('hidden', tab !== 'admin');

    if (tab === 'dashboard') {
      renderDashboard();
    } else if (tab === 'input') {
      populateFormDropdowns();
      renderSelectedChips('manPower');
      renderSelectedChips('instrument');
      renderPhotoPreviews();
    } else if (tab === 'admin') {
      renderAdminPanel();
    }
  }

  // ==================== DASHBOARD ====================
  function renderDashboard() {
    // Filter dropdown Area
    const filterArea = $('filterArea');
    const prevArea = filterArea.value;
    const areaItems = state.dropdowns.area || [];
    filterArea.innerHTML =
      '<option value="">Semua Area</option>' +
      areaItems.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
    filterArea.value = prevArea;

    // Stats
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const reportsThisMonth = state.reports.filter((r) => (r.dateISO || '').startsWith(currentMonthPrefix)).length;
    const totalPhotos = state.reports.reduce((acc, r) => acc + (Array.isArray(r.images) ? r.images.length : 0), 0);
    const uniqueAreas = new Set(state.reports.map((r) => r.area).filter(Boolean)).size;

    $('statTotalReports').textContent = state.reports.length;
    $('statMonthReports').textContent = reportsThisMonth;
    $('statTotalPhotos').textContent = totalPhotos;
    $('statActiveAreas').textContent = uniqueAreas;

    // Filtered list
    const query = ($('filterSearch').value || '').trim().toLowerCase();
    const areaFilter = filterArea.value;
    const dateFilter = $('filterDate').value;

    const filtered = state.reports.filter((r) => {
      if (areaFilter && r.area !== areaFilter) return false;
      if (dateFilter && r.dateISO !== dateFilter) return false;
      if (query) {
        const hay = [
          r.dateFormatted,
          r.area,
          r.job,
          r.wheater,
          (r.manPower || []).join(' '),
          (r.instrument || []).join(' '),
          r.planDesign,
          r.rawDataFile,
          r.createdByName
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    const tbody = $('reportTableBody');
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <h4>Belum ada laporan yang sesuai</h4>
              <p>Klik tombol <strong>+ Input Laporan Baru</strong> untuk membuat laporan harian engineering.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map((r, idx) => {
        const jobPreview = (r.job || '-').split('\n')[0];
        const mpCount = Array.isArray(r.manPower) ? r.manPower.length : 0;
        const imgCount = Array.isArray(r.images) ? r.images.length : 0;
        return `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHtml(r.dateFormatted || '-')}</strong></td>
            <td><span class="badge-blue">${escapeHtml(r.area || '-')}</span></td>
            <td>
              <div style="max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(r.job || '-')}">
                ${escapeHtml(jobPreview)}
              </div>
              <small style="color:var(--text-light);">Raw: ${escapeHtml(r.rawDataFile || '-')}</small>
            </td>
            <td>
              <span>${escapeHtml(r.wheater || '-')}</span><br/>
              <small style="color:var(--text-muted);">${mpCount} Man Power</small>
            </td>
            <td><span class="badge-orange">${imgCount} Foto</span></td>
            <td>
              <div class="action-group">
                <button class="btn btn-orange btn-sm" data-action="pdf" data-id="${r.id}" title="Cetak PDF">Cetak PDF</button>
                <button class="btn btn-outline btn-sm" data-action="preview" data-id="${r.id}" title="Lihat Preview A4">Preview</button>
                <button class="btn btn-outline btn-sm" data-action="edit" data-id="${r.id}" title="Edit Laporan">Edit</button>
                <button class="btn btn-danger btn-sm" data-action="delete" data-id="${r.id}" title="Hapus Laporan">Hapus</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // ==================== DATE DROPDOWN HELPERS ====================
  function initDateDropdowns() {
    const monthSelect = $('inputMonth');
    const yearSelect = $('inputYear');

    monthSelect.innerHTML = MONTHS_ID.map(
      (name, idx) => `<option value="${idx + 1}">${name}</option>`
    ).join('');

    const currentYear = new Date().getFullYear();
    const startYear = Math.min(2020, currentYear - 5);
    const endYear = Math.max(2035, currentYear + 5);
    let yearOpts = '';
    for (let y = startYear; y <= endYear; y++) {
      yearOpts += `<option value="${y}">${y}</option>`;
    }
    yearSelect.innerHTML = yearOpts;

    monthSelect.addEventListener('change', syncDaysInMonth);
    yearSelect.addEventListener('change', syncDaysInMonth);

    setDateDropdownToToday();
  }

  function syncDaysInMonth() {
    const daySelect = $('inputDay');
    const month = parseInt($('inputMonth').value, 10) || 1;
    const year = parseInt($('inputYear').value, 10) || new Date().getFullYear();
    const prevDay = parseInt(daySelect.value, 10) || 1;

    const daysCount = new Date(year, month, 0).getDate();
    let opts = '';
    for (let d = 1; d <= daysCount; d++) {
      opts += `<option value="${d}">${String(d).padStart(2, '0')}</option>`;
    }
    daySelect.innerHTML = opts;
    daySelect.value = String(Math.min(prevDay, daysCount));
  }

  function setDateDropdownToToday() {
    const now = new Date();
    $('inputYear').value = String(now.getFullYear());
    $('inputMonth').value = String(now.getMonth() + 1);
    syncDaysInMonth();
    $('inputDay').value = String(now.getDate());
  }

  function setDateDropdownValues(day, month, year) {
    $('inputYear').value = String(year);
    $('inputMonth').value = String(month);
    syncDaysInMonth();
    $('inputDay').value = String(day);
  }

  // ==================== INPUT REPORT FORM ====================
  function populateFormDropdowns() {
    const areaSelect = $('inputArea');
    const wheaterSelect = $('inputWheater');
    const mpSelect = $('selectManPower');
    const instSelect = $('selectInstrument');

    const prevArea = areaSelect.value;
    const prevWheater = wheaterSelect.value;

    const areas = state.dropdowns.area || [];
    areaSelect.innerHTML =
      '<option value="">-- Pilih Area --</option>' +
      areas.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
    if (prevArea && areas.includes(prevArea)) areaSelect.value = prevArea;
    else if (!state.editingReportId && areas.length > 0) areaSelect.value = areas[0];

    const wheaters = state.dropdowns.wheater || [];
    wheaterSelect.innerHTML =
      '<option value="">-- Pilih Cuaca (Wheater) --</option>' +
      wheaters.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
    if (prevWheater && wheaters.includes(prevWheater)) wheaterSelect.value = prevWheater;
    else if (!state.editingReportId && wheaters.length > 0) wheaterSelect.value = wheaters[0];

    const manPowers = state.dropdowns.manPower || [];
    mpSelect.innerHTML =
      '<option value="">-- Pilih Man Power untuk ditambahkan --</option>' +
      manPowers.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');

    const instruments = state.dropdowns.instrument || [];
    instSelect.innerHTML =
      '<option value="">-- Pilih Instrument untuk ditambahkan --</option>' +
      instruments.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
  }

  function addChipValue(type, value) {
    if (!value) return;
    const list = type === 'manPower' ? state.selectedManPower : state.selectedInstrument;
    if (!list.includes(value)) {
      list.push(value);
      renderSelectedChips(type);
    }
  }

  function removeChipValue(type, index) {
    const list = type === 'manPower' ? state.selectedManPower : state.selectedInstrument;
    list.splice(index, 1);
    renderSelectedChips(type);
  }

  function renderSelectedChips(type) {
    const list = type === 'manPower' ? state.selectedManPower : state.selectedInstrument;
    const container = type === 'manPower' ? $('chipsManPower') : $('chipsInstrument');

    if (list.length === 0) {
      container.innerHTML = `<span class="chips-empty">Belum ada ${type === 'manPower' ? 'Man Power' : 'Instrument'} dipilih (opsional, pilih dari dropdown di atas).</span>`;
      return;
    }

    container.innerHTML = list
      .map(
        (item, idx) => `
          <span class="chip">
            ${escapeHtml(item)}
            <button type="button" data-chip-type="${type}" data-chip-idx="${idx}" title="Hapus">&times;</button>
          </span>
        `
      )
      .join('');
  }

  function resetReportForm() {
    state.editingReportId = null;
    state.selectedManPower = [];
    state.selectedInstrument = [];
    state.uploadedImages = [];
    state.lastSubmittedReport = null;

    $('formHeading').textContent = 'Input Laporan Harian Engineering';
    $('btnSubmitReport').textContent = 'Submit Laporan';
    $('btnCancelEdit').classList.add('hidden');
    $('submitSuccessBox').classList.add('hidden');

    setDateDropdownToToday();
    populateFormDropdowns();

    $('inputJob').value = '';
    $('inputSafetyIssue').value = '';
    $('inputPlanTomorrow').value = '';
    $('inputPlanDesign').value = '';
    $('inputRawDataFile').value = '';

    renderSelectedChips('manPower');
    renderSelectedChips('instrument');
    renderPhotoPreviews();
  }

  function loadReportIntoForm(report) {
    state.editingReportId = report.id;
    state.selectedManPower = Array.isArray(report.manPower) ? [...report.manPower] : [];
    state.selectedInstrument = Array.isArray(report.instrument) ? [...report.instrument] : [];
    state.uploadedImages = Array.isArray(report.images) ? report.images.map((img) => ({ ...img })) : [];
    state.lastSubmittedReport = null;

    switchTab('input');
    populateFormDropdowns();

    $('formHeading').textContent = `Edit Laporan — ${report.dateFormatted}`;
    $('btnSubmitReport').textContent = 'Update & Simpan Laporan';
    $('btnCancelEdit').classList.remove('hidden');
    $('submitSuccessBox').classList.add('hidden');

    setDateDropdownValues(report.dateDay, report.dateMonth, report.dateYear);

    // Pastikan opsi tetap muncul walau item sudah dihapus dari master
    if (report.area && ![...$('inputArea').options].some((o) => o.value === report.area)) {
      $('inputArea').add(new Option(report.area, report.area));
    }
    $('inputArea').value = report.area || '';

    if (report.wheater && ![...$('inputWheater').options].some((o) => o.value === report.wheater)) {
      $('inputWheater').add(new Option(report.wheater, report.wheater));
    }
    $('inputWheater').value = report.wheater || '';

    $('inputJob').value = report.job === '-' ? '' : (report.job || '');
    $('inputSafetyIssue').value = report.safetyIssue === '-' ? '' : (report.safetyIssue || '');
    $('inputPlanTomorrow').value = report.planTomorrow === '-' ? '' : (report.planTomorrow || '');
    $('inputPlanDesign').value = report.planDesign === '-' ? '' : (report.planDesign || '');
    $('inputRawDataFile').value = report.rawDataFile === '-' ? '' : (report.rawDataFile || '');

    renderSelectedChips('manPower');
    renderSelectedChips('instrument');
    renderPhotoPreviews();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== IMAGE UPLOAD & COMPRESSION ====================
  async function handleImageFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      showToast('Pilih file gambar (JPG, PNG, WEBP).', true);
      return;
    }

    const progressEl = $('uploadProgress');
    progressEl.classList.remove('hidden');

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      progressEl.textContent = `Mengompres gambar ${i + 1} dari ${files.length} untuk kualitas cetak A4...`;
      try {
        const compressed = await ImageCompressor.compressFile(files[i]);
        state.uploadedImages.push(compressed);
        successCount++;
      } catch (err) {
        console.error(err);
        showToast(`Gagal memproses ${files[i].name}`, true);
      }
    }

    progressEl.classList.add('hidden');
    progressEl.textContent = '';
    $('inputPhotoFiles').value = '';
    renderPhotoPreviews();

    if (successCount > 0) {
      showToast(`${successCount} gambar berhasil dikompres & ditambahkan (kualitas A4 terjaga).`);
    }
  }

  function renderPhotoPreviews() {
    const grid = $('photoPreviewGrid');
    const countBadge = $('photoCountBadge');
    countBadge.textContent = `${state.uploadedImages.length} Foto`;

    if (state.uploadedImages.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = state.uploadedImages
      .map((img, idx) => {
        const savedPct =
          img.originalSize > 0
            ? Math.max(0, Math.round((1 - img.compressedSize / img.originalSize) * 100))
            : 0;
        const sizeInfo =
          img.originalSize > 0
            ? `${ImageCompressor.formatBytes(img.originalSize)} → ${ImageCompressor.formatBytes(img.compressedSize)} (-${savedPct}%)`
            : ImageCompressor.formatBytes(img.compressedSize);

        return `
          <div class="photo-card">
            <div class="photo-thumb-wrap">
              <span class="photo-order-badge">#${idx + 1}</span>
              <img src="${img.dataUrl}" alt="${escapeHtml(img.name)}" />
            </div>
            <div class="photo-meta">
              <div class="photo-name" title="${escapeHtml(img.name)}">${escapeHtml(img.name)}</div>
              <div class="photo-size-badge">${sizeInfo}</div>
              <div>Resolusi: ${img.width} &times; ${img.height} px</div>
            </div>
            <div class="photo-actions">
              <button type="button" class="btn btn-outline" data-img-act="left" data-img-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Geser Kiri">&larr;</button>
              <button type="button" class="btn btn-outline" data-img-act="right" data-img-idx="${idx}" ${idx === state.uploadedImages.length - 1 ? 'disabled' : ''} title="Geser Kanan">&rarr;</button>
              <button type="button" class="btn btn-danger" data-img-act="remove" data-img-idx="${idx}" title="Hapus">Hapus</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ==================== SUBMIT REPORT ====================
  function freeTextOrDash(val) {
    const trimmed = (val || '').trim();
    return trimmed === '' ? '-' : trimmed;
  }

  async function handleReportSubmit(e) {
    e.preventDefault();

    const day = parseInt($('inputDay').value, 10);
    const month = parseInt($('inputMonth').value, 10);
    const year = parseInt($('inputYear').value, 10);
    const area = $('inputArea').value.trim();
    const wheater = $('inputWheater').value.trim();

    if (!area) {
      showToast('Silakan pilih Area terlebih dahulu.', true);
      $('inputArea').focus();
      return;
    }
    if (!wheater) {
      showToast('Silakan pilih Wheater (Cuaca) terlebih dahulu.', true);
      $('inputWheater').focus();
      return;
    }

    const dateFormatted = `${day} ${MONTHS_ID[month - 1]} ${year}`;
    const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const nowISO = new Date().toISOString();

    const existing = state.editingReportId
      ? state.reports.find((r) => r.id === state.editingReportId)
      : null;

    const reportObj = {
      id: existing ? existing.id : `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dateDay: day,
      dateMonth: month,
      dateYear: year,
      dateFormatted,
      dateISO,
      area,
      job: freeTextOrDash($('inputJob').value),
      wheater,
      manPower: [...state.selectedManPower],
      safetyIssue: freeTextOrDash($('inputSafetyIssue').value),
      planTomorrow: freeTextOrDash($('inputPlanTomorrow').value),
      instrument: [...state.selectedInstrument],
      planDesign: freeTextOrDash($('inputPlanDesign').value),
      rawDataFile: freeTextOrDash($('inputRawDataFile').value),
      images: state.uploadedImages.map((img) => ({ ...img })),
      createdBy: existing ? existing.createdBy : state.currentUser.id,
      createdByName: existing ? existing.createdByName : state.currentUser.fullName,
      createdAt: existing ? existing.createdAt : nowISO,
      updatedAt: nowISO
    };

    await DB.put('reports', reportObj);
    await loadAllData();

    state.lastSubmittedReport = reportObj;
    state.editingReportId = reportObj.id;

    $('submitSuccessInfo').textContent = `Laporan tanggal ${reportObj.dateFormatted} (${reportObj.area}) dengan ${reportObj.images.length} foto dokumentasi telah disimpan.`;
    $('submitSuccessBox').classList.remove('hidden');
    $('submitSuccessBox').scrollIntoView({ behavior: 'smooth', block: 'center' });

    showToast('Laporan berhasil disimpan! Silakan klik Cetak PDF.');
  }

  // ==================== PREVIEW & PRINT PDF ====================
  function openPreviewModal(report) {
    state.previewReport = report;
    $('previewModalTitle').textContent = `Preview Cetak A4 — ${report.dateFormatted} (${report.area})`;
    $('previewSheetContainer').innerHTML = ReportPrinter.buildSheetHTML(report, state.logos);
    $('previewModal').classList.remove('hidden');
  }

  function closePreviewModal() {
    $('previewModal').classList.add('hidden');
    state.previewReport = null;
  }

  async function triggerPrintPDF(report) {
    if (!report) return;
    await ReportPrinter.printPDF(report, state.logos);
  }

  // ==================== ADMIN PANEL ====================
  function renderAdminPanel() {
    document.querySelectorAll('.admin-subtab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.subtab === state.adminSubTab);
    });

    $('adminUsersSection').classList.toggle('hidden', state.adminSubTab !== 'users');
    $('adminDropdownsSection').classList.toggle('hidden', state.adminSubTab !== 'dropdowns');
    $('adminLogosSection').classList.toggle('hidden', state.adminSubTab !== 'logos');

    if (state.adminSubTab === 'users') renderAdminUsers();
    if (state.adminSubTab === 'dropdowns') renderAdminDropdowns();
    if (state.adminSubTab === 'logos') renderAdminLogos();
  }

  function renderAdminUsers() {
    const tbody = $('adminUsersTableBody');
    tbody.innerHTML = state.users
      .map(
        (u, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHtml(u.fullName)}</strong></td>
            <td><code>${escapeHtml(u.username)}</code></td>
            <td>${escapeHtml(u.position || '-')}</td>
            <td><span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role === 'admin' ? 'Admin' : 'User'}</span></td>
            <td>
              <div class="action-group">
                <button class="btn btn-outline btn-sm" data-user-act="edit" data-user-id="${u.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-user-act="delete" data-user-id="${u.id}" ${u.id === state.currentUser.id ? 'disabled title="Tidak dapat menghapus akun sendiri"' : ''}>Hapus</button>
              </div>
            </td>
          </tr>
        `
      )
      .join('');
  }

  function openUserModal(user = null) {
    state.editingUserId = user ? user.id : null;
    $('userModalTitle').textContent = user ? 'Edit User' : 'Tambah User Baru';
    $('userFullName').value = user ? user.fullName : '';
    $('userUsername').value = user ? user.username : '';
    $('userPassword').value = user ? user.password : '';
    $('userPosition').value = user ? (user.position || '') : '';
    $('userRole').value = user ? user.role : 'user';
    $('userModal').classList.remove('hidden');
    $('userFullName').focus();
  }

  function closeUserModal() {
    $('userModal').classList.add('hidden');
    state.editingUserId = null;
  }

  async function handleUserFormSubmit(e) {
    e.preventDefault();
    const fullName = $('userFullName').value.trim();
    const username = $('userUsername').value.trim();
    const password = $('userPassword').value;
    const position = $('userPosition').value.trim();
    const role = $('userRole').value;

    if (!fullName || !username || !password) {
      showToast('Nama lengkap, username, dan password wajib diisi.', true);
      return;
    }

    const duplicate = state.users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== state.editingUserId
    );
    if (duplicate) {
      showToast('Username sudah digunakan user lain.', true);
      return;
    }

    const existing = state.editingUserId
      ? state.users.find((u) => u.id === state.editingUserId)
      : null;

    // Cegah menurunkan role admin terakhir
    if (existing && existing.role === 'admin' && role !== 'admin') {
      const adminCount = state.users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        showToast('Harus ada minimal 1 akun Admin aktif.', true);
        return;
      }
    }

    const userObj = {
      id: existing ? existing.id : `usr-${Date.now()}`,
      fullName,
      username,
      password,
      position,
      role,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    };

    await DB.put('users', userObj);
    await loadAllData();

    // Update currentUser jika mengedit diri sendiri
    if (state.currentUser.id === userObj.id) {
      state.currentUser = userObj;
      $('headerUserName').textContent = userObj.fullName;
    }

    closeUserModal();
    renderAdminUsers();
    showToast(existing ? 'Data user berhasil diperbarui.' : 'User baru berhasil ditambahkan.');
  }

  async function deleteUser(userId) {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;
    if (user.id === state.currentUser.id) {
      showToast('Anda tidak dapat menghapus akun yang sedang digunakan.', true);
      return;
    }
    if (user.role === 'admin' && state.users.filter((u) => u.role === 'admin').length <= 1) {
      showToast('Tidak dapat menghapus satu-satunya Admin.', true);
      return;
    }
    if (!confirm(`Hapus user "${user.fullName}" (${user.username})?`)) return;

    await DB.remove('users', userId);
    await loadAllData();
    renderAdminUsers();
    showToast('User berhasil dihapus.');
  }

  // ---- Master Dropdowns ----
  const DROPDOWN_META = [
    { key: 'area', title: 'Area', placeholder: 'Contoh: Segment C3' },
    { key: 'wheater', title: 'Wheater (Cuaca)', placeholder: 'Contoh: Gerimis' },
    { key: 'manPower', title: 'Man Power', placeholder: 'Contoh: Budi Santoso' },
    { key: 'instrument', title: 'Instrument', placeholder: 'Contoh: TOTAL STATION TOPCON' }
  ];

  function renderAdminDropdowns() {
    const container = $('masterDropdownsGrid');
    container.innerHTML = DROPDOWN_META.map((meta) => {
      const items = state.dropdowns[meta.key] || [];
      const listHtml =
        items.length === 0
          ? '<li class="master-item"><span style="color:var(--text-light);font-weight:400;">Belum ada data</span></li>'
          : items
              .map(
                (val, idx) => `
                  <li class="master-item">
                    <span>${escapeHtml(val)}</span>
                    <div class="action-group">
                      <button type="button" class="btn btn-outline btn-sm" data-dd-act="edit" data-dd-key="${meta.key}" data-dd-idx="${idx}">Edit</button>
                      <button type="button" class="btn btn-danger btn-sm" data-dd-act="delete" data-dd-key="${meta.key}" data-dd-idx="${idx}">Hapus</button>
                    </div>
                  </li>
                `
              )
              .join('');

      return `
        <div class="card">
          <div class="card-header">
            <h3>Dropdown: ${meta.title}</h3>
            <span class="badge-blue">${items.length} item</span>
          </div>
          <div class="card-body">
            <div class="master-add-row">
              <input type="text" class="form-control" id="add-dd-${meta.key}" placeholder="${meta.placeholder}" />
              <button type="button" class="btn btn-orange btn-sm" data-dd-act="add" data-dd-key="${meta.key}">+ Tambah</button>
            </div>
            <ul class="master-list">${listHtml}</ul>
          </div>
        </div>
      `;
    }).join('');
  }

  async function saveDropdownList(key, newItems) {
    const meta = DROPDOWN_META.find((m) => m.key === key);
    await DB.put('dropdowns', {
      key,
      label: meta ? meta.title : key,
      items: newItems
    });
    await loadAllData();
    renderAdminDropdowns();
  }

  // ---- Logo Settings ----
  function renderAdminLogos() {
    $('previewLogoCompany').src = state.logos.company;
    $('previewLogoPdfLeft').src = state.logos.pdfLeft;
    $('previewLogoPdfRight').src = state.logos.pdfRight;
  }

  function handleLogoUpload(settingKey, file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Silakan pilih file gambar (PNG/JPG/SVG).', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      await DB.put('settings', { key: settingKey, value: reader.result });
      await loadAllData();
      renderAdminLogos();
      showToast('Logo berhasil diperbarui.');
    };
    reader.readAsDataURL(file);
  }

  async function resetLogoSetting(settingKey) {
    await DB.remove('settings', settingKey);
    await loadAllData();
    renderAdminLogos();
    showToast('Logo dikembalikan ke default.');
  }

  // ==================== EVENT BINDINGS ====================
  function bindEvents() {
    // Login & Logout
    $('loginForm').addEventListener('submit', handleLoginSubmit);
    $('btnLogout').addEventListener('click', handleLogout);

    // Nav Tabs
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        if (target === 'input' && state.activeTab !== 'input' && !state.editingReportId) {
          resetReportForm();
        }
        switchTab(target);
      });
    });

    // Dashboard actions
    $('btnNewReportFromDash').addEventListener('click', () => {
      resetReportForm();
      switchTab('input');
    });

    $('filterSearch').addEventListener('input', renderDashboard);
    $('filterArea').addEventListener('change', renderDashboard);
    $('filterDate').addEventListener('change', renderDashboard);
    $('btnResetFilters').addEventListener('click', () => {
      $('filterSearch').value = '';
      $('filterArea').value = '';
      $('filterDate').value = '';
      renderDashboard();
    });

    $('reportTableBody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const report = state.reports.find((r) => r.id === id);
      if (!report) return;

      if (action === 'pdf') {
        await triggerPrintPDF(report);
      } else if (action === 'preview') {
        openPreviewModal(report);
      } else if (action === 'edit') {
        loadReportIntoForm(report);
      } else if (action === 'delete') {
        if (!confirm(`Hapus laporan tanggal ${report.dateFormatted} (${report.area})?`)) return;
        await DB.remove('reports', id);
        await loadAllData();
        renderDashboard();
        showToast('Laporan berhasil dihapus.');
      }
    });

    // Input Form Events
    $('btnTodayDate').addEventListener('click', setDateDropdownToToday);

    // Multi-select dropdown Man Power (auto add on select + button)
    $('selectManPower').addEventListener('change', (e) => {
      if (e.target.value) {
        addChipValue('manPower', e.target.value);
        e.target.value = '';
      }
    });

    // Multi-select dropdown Instrument (auto add on select)
    $('selectInstrument').addEventListener('change', (e) => {
      if (e.target.value) {
        addChipValue('instrument', e.target.value);
        e.target.value = '';
      }
    });

    // Remove chip clicks
    ['chipsManPower', 'chipsInstrument'].forEach((id) => {
      $(id).addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-chip-type]');
        if (!btn) return;
        removeChipValue(btn.dataset.chipType, parseInt(btn.dataset.chipIdx, 10));
      });
    });

    // Photo Upload Dropzone
    const dropzone = $('photoDropzone');
    const fileInput = $('inputPhotoFiles');

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleImageFiles(e.target.files));

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      handleImageFiles(e.dataTransfer.files);
    });

    // Photo Preview Actions (reorder & delete)
    $('photoPreviewGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-img-act]');
      if (!btn) return;
      const act = btn.dataset.imgAct;
      const idx = parseInt(btn.dataset.imgIdx, 10);
      if (act === 'remove') {
        state.uploadedImages.splice(idx, 1);
      } else if (act === 'left' && idx > 0) {
        [state.uploadedImages[idx - 1], state.uploadedImages[idx]] = [
          state.uploadedImages[idx],
          state.uploadedImages[idx - 1]
        ];
      } else if (act === 'right' && idx < state.uploadedImages.length - 1) {
        [state.uploadedImages[idx + 1], state.uploadedImages[idx]] = [
          state.uploadedImages[idx],
          state.uploadedImages[idx + 1]
        ];
      }
      renderPhotoPreviews();
    });

    // Submit & Reset Form
    $('reportForm').addEventListener('submit', handleReportSubmit);
    $('btnResetForm').addEventListener('click', () => {
      if (confirm('Kosongkan seluruh isian form?')) resetReportForm();
    });
    $('btnCancelEdit').addEventListener('click', () => {
      resetReportForm();
      switchTab('dashboard');
    });

    // Post-Submit Actions
    $('btnPrintSubmitted').addEventListener('click', () => triggerPrintPDF(state.lastSubmittedReport));
    $('btnPreviewSubmitted').addEventListener('click', () => {
      if (state.lastSubmittedReport) openPreviewModal(state.lastSubmittedReport);
    });
    $('btnCreateAnother').addEventListener('click', () => {
      resetReportForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Preview Modal
    $('btnClosePreview').addEventListener('click', closePreviewModal);
    $('btnClosePreviewFooter').addEventListener('click', closePreviewModal);
    $('btnPrintFromPreview').addEventListener('click', () => triggerPrintPDF(state.previewReport));
    $('previewModal').addEventListener('click', (e) => {
      if (e.target === $('previewModal')) closePreviewModal();
    });

    // Admin Subtabs
    document.querySelectorAll('.admin-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.adminSubTab = btn.dataset.subtab;
        renderAdminPanel();
      });
    });

    // Admin Users
    $('btnAddUser').addEventListener('click', () => openUserModal(null));
    $('btnCloseUserModal').addEventListener('click', closeUserModal);
    $('btnCancelUserModal').addEventListener('click', closeUserModal);
    $('userForm').addEventListener('submit', handleUserFormSubmit);
    $('userModal').addEventListener('click', (e) => {
      if (e.target === $('userModal')) closeUserModal();
    });

    $('adminUsersTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-user-act]');
      if (!btn) return;
      const act = btn.dataset.userAct;
      const id = btn.dataset.userId;
      if (act === 'edit') {
        const user = state.users.find((u) => u.id === id);
        if (user) openUserModal(user);
      } else if (act === 'delete') {
        deleteUser(id);
      }
    });

    // Admin Master Dropdowns
    $('masterDropdownsGrid').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-dd-act]');
      if (!btn) return;
      const act = btn.dataset.ddAct;
      const key = btn.dataset.ddKey;
      const items = [...(state.dropdowns[key] || [])];

      if (act === 'add') {
        const input = $(`add-dd-${key}`);
        const val = (input.value || '').trim();
        if (!val) {
          showToast('Masukkan teks item terlebih dahulu.', true);
          input.focus();
          return;
        }
        if (items.some((x) => x.toLowerCase() === val.toLowerCase())) {
          showToast('Item tersebut sudah ada di daftar.', true);
          return;
        }
        items.push(val);
        await saveDropdownList(key, items);
        showToast(`"${val}" berhasil ditambahkan.`);
      } else if (act === 'edit') {
        const idx = parseInt(btn.dataset.ddIdx, 10);
        const currentVal = items[idx];
        const updated = prompt('Edit item dropdown:', currentVal);
        if (updated === null) return;
        const trimmed = updated.trim();
        if (!trimmed) {
          showToast('Nama item tidak boleh kosong.', true);
          return;
        }
        items[idx] = trimmed;
        await saveDropdownList(key, items);
        showToast('Item dropdown berhasil diperbarui.');
      } else if (act === 'delete') {
        const idx = parseInt(btn.dataset.ddIdx, 10);
        const targetVal = items[idx];
        if (!confirm(`Hapus "${targetVal}" dari daftar dropdown?`)) return;
        items.splice(idx, 1);
        await saveDropdownList(key, items);
        showToast(`"${targetVal}" berhasil dihapus.`);
      }
    });

    // Admin Logo Settings
    $('uploadLogoCompany').addEventListener('change', (e) => {
      if (e.target.files[0]) handleLogoUpload('logo_company', e.target.files[0]);
      e.target.value = '';
    });
    $('uploadLogoPdfLeft').addEventListener('change', (e) => {
      if (e.target.files[0]) handleLogoUpload('logo_pdf_left', e.target.files[0]);
      e.target.value = '';
    });
    $('uploadLogoPdfRight').addEventListener('change', (e) => {
      if (e.target.files[0]) handleLogoUpload('logo_pdf_right', e.target.files[0]);
      e.target.value = '';
    });

    $('resetLogoCompany').addEventListener('click', () => resetLogoSetting('logo_company'));
    $('resetLogoPdfLeft').addEventListener('click', () => resetLogoSetting('logo_pdf_left'));
    $('resetLogoPdfRight').addEventListener('click', () => resetLogoSetting('logo_pdf_right'));
  }

  // ==================== INIT ====================
  async function bootstrap() {
    try {
      await DB.initSeed();
      await loadAllData();
      initDateDropdowns();
      bindEvents();

      if (restoreSession()) {
        showAppShell();
      } else {
        showLoginView();
      }
    } catch (err) {
      console.error('Gagal inisialisasi aplikasi:', err);
      alert('Gagal memuat database lokal browser: ' + err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
