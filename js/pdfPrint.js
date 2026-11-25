/**
 * A4 Report Renderer & Direct PDF Generator (Mobile & Desktop Compatible)
 * Menggunakan jsPDF untuk menghasilkan file PDF A4 langsung (bekerja di semua HP Android/iOS & Desktop)
 * dengan urutan & tampilan mengikuti template:
 * 1. Header Logo Kiri (DBK) & Logo Kanan (PETROSEA)
 * 2. Grid Foto Dokumentasi Proporsional (2 kolom, tanpa batas jumlah)
 * 3. Judul: DAILY SURVEY ACTIVITY (selalu satu halaman dengan tabel)
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

        <div class="report-table-block">
          <div class="report-doc-title">DAILY SURVEY ACTIVITY</div>

          <table class="report-info-table">
            <tbody>
              <tr>
                <td class="col-label">Day / Date</td>
                <td class="col-value">${escapeHtml(report.dateFormatted || '-')}</td>
              </tr>
              <tr>
                <td class="col-label">Area</td>
                <td class="col-value">${escapeHtml(valueOrDash(report.area))}</td>
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
      </div>
    `;
  }

  // ==================== IMAGE LOADER FOR JSPDF ====================
  function loadImageAsCanvasData(src, asPng = false) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;

      const finish = (val) => {
        if (done) return;
        done = true;
        resolve(val);
      };

      const timer = setTimeout(() => finish(null), 10000);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const w = img.naturalWidth || img.width || 100;
          const h = img.naturalHeight || img.height || 100;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!asPng) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
          }
          ctx.drawImage(img, 0, 0, w, h);
          const format = asPng ? 'PNG' : 'JPEG';
          const mime = asPng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(mime, 0.9);
          finish({ dataUrl, format, width: w, height: h });
        } catch (_) {
          finish(null);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };

      img.src = src;
    });
  }

  function fitInsideBox(imgW, imgH, boxW, boxH) {
    const ratio = Math.min(boxW / imgW, boxH / imgH);
    const drawW = imgW * ratio;
    const drawH = imgH * ratio;
    return {
      w: drawW,
      h: drawH,
      offsetX: (boxW - drawW) / 2,
      offsetY: (boxH - drawH) / 2
    };
  }

  function formatListForPdf(items) {
    if (!Array.isArray(items) || items.length === 0) return ['-'];
    return items.map((item) => `•  ${String(item)}`);
  }

  function splitMultiline(doc, text, maxWidth) {
    const rawLines = String(text || '-').split(/\r?\n/);
    const out = [];
    rawLines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line === '' ? ' ' : line, maxWidth);
      wrapped.forEach((w) => out.push(w));
    });
    return out.length > 0 ? out : ['-'];
  }

  // ==================== DIRECT PDF GENERATION (A4) ====================
  async function generateDirectPDF(report, logos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageW = 210;
    const pageH = 297;
    const marginX = 12;
    const marginTop = 10;
    const marginBottom = 12;
    const contentW = pageW - marginX * 2; // 186mm
    const maxY = pageH - marginBottom;

    let y = marginTop;

    // 1. Header Logo Kiri & Kanan
    const leftLogoSrc = (logos && logos.pdfLeft) || 'assets/logo-dbk.jpeg';
    const rightLogoSrc = (logos && logos.pdfRight) || 'assets/logo-petrosea.jpeg';

    const [leftImg, rightImg] = await Promise.all([
      loadImageAsCanvasData(leftLogoSrc, true),
      loadImageAsCanvasData(rightLogoSrc, true)
    ]);

    let headerHeight = 14;
    if (leftImg) {
      const fitted = fitInsideBox(leftImg.width, leftImg.height, 44, 13);
      doc.addImage(leftImg.dataUrl, leftImg.format, marginX, y + fitted.offsetY, fitted.w, fitted.h);
      headerHeight = Math.max(headerHeight, fitted.h + 2);
    }
    if (rightImg) {
      const fitted = fitInsideBox(rightImg.width, rightImg.height, 58, 11);
      doc.addImage(
        rightImg.dataUrl,
        rightImg.format,
        pageW - marginX - fitted.w,
        y + fitted.offsetY,
        fitted.w,
        fitted.h
      );
      headerHeight = Math.max(headerHeight, fitted.h + 2);
    }

    y += headerHeight + 2;

    // 2. Grid Foto Dokumentasi (2 kolom, proporsional, tanpa batas jumlah)
    const images = Array.isArray(report.images) ? report.images : [];
    if (images.length > 0) {
      const loadedPhotos = await Promise.all(
        images.map((img) => loadImageAsCanvasData(img.dataUrl, false))
      );

      const cellW = contentW / 2; // 93mm
      const cellH = 62;           // Proporsional ~4:3, muat 2 baris + tabel di halaman 1
      const pad = 2.2;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);

      for (let i = 0; i < loadedPhotos.length; i += 2) {
        if (y + cellH > maxY) {
          doc.addPage();
          y = marginTop;
        }

        for (let col = 0; col < 2; col++) {
          const cellX = marginX + col * cellW;
          doc.rect(cellX, y, cellW, cellH);

          const photo = loadedPhotos[i + col];
          if (photo) {
            const fitted = fitInsideBox(photo.width, photo.height, cellW - pad * 2, cellH - pad * 2);
            doc.addImage(
              photo.dataUrl,
              photo.format,
              cellX + pad + fitted.offsetX,
              y + pad + fitted.offsetY,
              fitted.w,
              fitted.h
            );
          }
        }
        y += cellH;
      }

      y += 5;
    }

    // 3. Hitung ukuran blok Judul "DAILY SURVEY ACTIVITY" + Tabel Laporan
    const labelColW = 52;
    const valColW = contentW - labelColW; // 134mm
    const cellPadX = 3;
    const cellPadY = 2.2;
    const lineH = 4.6;
    const minRowH = 7.8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    const rows = [
      { label: 'Day / Date', type: 'text', lines: splitMultiline(doc, report.dateFormatted || '-', valColW - cellPadX * 2) },
      { label: 'Area', type: 'text', lines: splitMultiline(doc, valueOrDash(report.area), valColW - cellPadX * 2) },
      { label: 'Job', type: 'text', lines: splitMultiline(doc, valueOrDash(report.job), valColW - cellPadX * 2) },
      { label: 'Wheater', type: 'wheater', text: valueOrDash(report.wheater), lines: [valueOrDash(report.wheater)] },
      { label: 'Man Power', type: 'text', lines: splitMultiline(doc, formatListForPdf(report.manPower).join('\n'), valColW - cellPadX * 2) },
      { label: 'Safety Issue', type: 'text', lines: splitMultiline(doc, valueOrDash(report.safetyIssue), valColW - cellPadX * 2) },
      { label: 'Plan Tomorrow', type: 'text', lines: splitMultiline(doc, valueOrDash(report.planTomorrow), valColW - cellPadX * 2) },
      { label: 'Instrument', type: 'text', lines: splitMultiline(doc, formatListForPdf(report.instrument).join('\n'), valColW - cellPadX * 2) },
      { label: 'Plan Design', type: 'text', lines: splitMultiline(doc, valueOrDash(report.planDesign), valColW - cellPadX * 2) },
      { label: 'Raw Data File', type: 'text', lines: splitMultiline(doc, valueOrDash(report.rawDataFile), valColW - cellPadX * 2) }
    ];

    rows.forEach((row) => {
      row.height = Math.max(minRowH, row.lines.length * lineH + cellPadY * 2);
    });

    const titleH = 9;
    const totalTableH = rows.reduce((sum, r) => sum + r.height, 0);

    // Pastikan judul "DAILY SURVEY ACTIVITY" SELALU 1 halaman bersama tabel laporan
    if (y + titleH + totalTableH > maxY && y > marginTop + 5) {
      doc.addPage();
      y = marginTop + 2;
    }

    // Gambar Judul
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('DAILY SURVEY ACTIVITY', pageW / 2, y + 5, { align: 'center' });
    y += titleH;

    // Gambar Tabel Laporan
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);

    rows.forEach((row) => {
      // Proteksi jika 1 tabel sangat panjang (melebihi 1 halaman penuh)
      if (y + row.height > maxY) {
        doc.addPage();
        y = marginTop;
      }

      // Kotak kolom kiri (label) & kanan (value)
      doc.rect(marginX, y, labelColW, row.height);
      doc.rect(marginX + labelColW, y, valColW, row.height);

      // Teks Label (normal)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(row.label, marginX + cellPadX, y + cellPadY + 3.4);

      // Teks Value (bold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);

      if (row.type === 'wheater') {
        const checkBoxW = 9;
        // Garis pemisah kotak centang
        doc.line(marginX + labelColW + checkBoxW, y, marginX + labelColW + checkBoxW, y + row.height);

        // Gambar tanda centang vektor tajam (✓) di tengah kotak
        const cx = marginX + labelColW + checkBoxW / 2;
        const cy = y + row.height / 2;
        doc.setLineWidth(0.45);
        doc.line(cx - 1.6, cy + 0.1, cx - 0.3, cy + 1.4);
        doc.line(cx - 0.3, cy + 1.4, cx + 1.9, cy - 1.5);
        doc.setLineWidth(0.25);

        doc.text(row.text, marginX + labelColW + checkBoxW + cellPadX, y + cellPadY + 3.4);
      } else {
        row.lines.forEach((line, idx) => {
          doc.text(line, marginX + labelColW + cellPadX, y + cellPadY + 3.4 + idx * lineH);
        });
      }

      y += row.height;
    });

    const safeArea = (report.area || 'Report').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const safeDate = report.dateISO || 'Date';
    const fileName = `Daily_Survey_Activity_${safeDate}_${safeArea}.pdf`;

    doc.save(fileName);
  }

  // ==================== MAIN ENTRYPOINT ====================
  async function printPDF(report, logos) {
    if (window.jspdf && window.jspdf.jsPDF) {
      await generateDirectPDF(report, logos);
      return;
    }

    // Fallback aman ke window.print() jika jsPDF tidak tersedia
    const printArea = document.getElementById('printArea');
    printArea.innerHTML = buildSheetHTML(report, logos);

    const originalTitle = document.title;
    const safeArea = (report.area || 'Report').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const safeDate = report.dateISO || 'Date';
    document.title = `Daily_Survey_Activity_${safeDate}_${safeArea}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 600);
    }, 150);
  }

  return {
    buildSheetHTML,
    printPDF
  };
})();
