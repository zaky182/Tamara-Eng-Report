/**
 * A4 Report Renderer & PDF Print Engine
 * Urutan & tampilan mengikuti template DOCX:
 * 1. Header Logo Kiri (DBK) & Logo Kanan (PETROSEA)
 * 2. Grid Foto Dokumentasi Proporsional (2 kolom, tanpa batas jumlah)
 * 3. Judul: DAILY SURVEY ACTIVITY
 * 4. Tabel Laporan Engineering
 */
const ReportPrinter = (() => {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function valueOrDash(val) {
    if (val === null || val === undefined) return '-';
    const trimmed = String(val).trim();
    return trimmed === '' ? '-' : trimmed;
  }

  function renderBulletOrDash(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<span>-</span>';
    }
    const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `<ul class="report-bullet-list">${lis}</ul>`;
  }

  function renderPhotosSection(images) {
    if (!Array.isArray(images) || images.length === 0) {
      return '';
    }

    const cells = images
      .map(
        (img, idx) => `
          <div class="report-photo-cell">
            <img src="${img.dataUrl}" alt="Dokumentasi ${idx + 1}" />
          </div>
        `
      )
      .join('');

    // Jika jumlah gambar ganjil, tambahkan sel kosong agar border tabel 2 kolom tetap rapi
    const filler = images.length % 2 === 1 ? '<div class="report-photo-cell empty-cell"></div>' : '';

    return `
      <div class="report-photos-section">
        <div class="report-photo-grid">
          ${cells}
          ${filler}
        </div>
      </div>
    `;
  }

  function buildSheetHTML(report, logos) {
    const leftLogo = (logos && logos.pdfLeft) || 'assets/logo-dbk.jpeg';
    const rightLogo = (logos && logos.pdfRight) || 'assets/logo-petrosea.jpeg';

    const jobText = valueOrDash(report.job);
    const safetyText = valueOrDash(report.safetyIssue);
    const planTomorrowText = valueOrDash(report.planTomorrow);
    const planDesignText = valueOrDash(report.planDesign);
    const rawDataText = valueOrDash(report.rawDataFile);
    const wheaterText = valueOrDash(report.wheater);

    return `
      <div class="report-sheet">
        <div class="report-header-logos">
          <img class="logo-left" src="${leftLogo}" alt="Logo Kiri" />
          <img class="logo-right" src="${rightLogo}" alt="Logo Kanan" />
        </div>

        ${renderPhotosSection(report.images)}

        <div class="report-doc-title">DAILY SURVEY ACTIVITY</div>

        <table class="report-info-table">
          <tbody>
            <tr>
              <td class="col-label">Day / Date</td>
              <td class="col-value">: ${escapeHtml(report.dateFormatted || '-')}</td>
            </tr>
            <tr>
              <td class="col-label">Area</td>
              <td class="col-value">: ${escapeHtml(valueOrDash(report.area))}</td>
            </tr>
            <tr>
              <td class="col-label">Job</td>
              <td class="col-value"><div class="multiline-text">${escapeHtml(jobText)}</div></td>
            </tr>
            <tr>
              <td class="col-label">Wheater</td>
              <td class="col-value">
                <table class="weather-inline-table">
                  <tr>
                    <td class="weather-check-cell">&radic;</td>
                    <td>${escapeHtml(wheaterText)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="col-label">Man Power</td>
              <td class="col-value">${renderBulletOrDash(report.manPower)}</td>
            </tr>
            <tr>
              <td class="col-label">Safety Issue</td>
              <td class="col-value"><div class="multiline-text">${escapeHtml(safetyText)}</div></td>
            </tr>
            <tr>
              <td class="col-label">Plan Tomorrow</td>
              <td class="col-value"><div class="multiline-text">${escapeHtml(planTomorrowText)}</div></td>
            </tr>
            <tr>
              <td class="col-label">Instrument</td>
              <td class="col-value">${renderBulletOrDash(report.instrument)}</td>
            </tr>
            <tr>
              <td class="col-label">Plan Design</td>
              <td class="col-value"><div class="multiline-text">${escapeHtml(planDesignText)}</div></td>
            </tr>
            <tr>
              <td class="col-label">Raw Data File</td>
              <td class="col-value"><div class="multiline-text">${escapeHtml(rawDataText)}</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    return Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            img.onload = resolve;
            img.onerror = resolve;
          })
      )
    );
  }

  async function printPDF(report, logos) {
    const printArea = document.getElementById('printArea');
    printArea.innerHTML = buildSheetHTML(report, logos);

    await waitForImages(printArea);

    const originalTitle = document.title;
    const safeArea = (report.area || 'Report').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const safeDate = report.dateISO || 'Date';
    document.title = `Daily_Survey_Activity_${safeDate}_${safeArea}`;

    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 600);
  }

  return {
    buildSheetHTML,
    printPDF
  };
})();
