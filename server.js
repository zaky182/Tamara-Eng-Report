/**
 * Backend Server — Engineering Dept . PT Harapan Mitra Lestari
 * Stack: Node.js 22 (built-in node:sqlite) + Express
 * Persistent storage: /app/data (database.sqlite + uploads/)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

// Pastikan folder data & uploads tersedia
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Inisialisasi SQLite
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    position TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dropdowns (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    items_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    date_day INTEGER NOT NULL,
    date_month INTEGER NOT NULL,
    date_year INTEGER NOT NULL,
    date_formatted TEXT NOT NULL,
    date_iso TEXT NOT NULL,
    area TEXT NOT NULL,
    job TEXT NOT NULL,
    wheater TEXT NOT NULL,
    man_power_json TEXT NOT NULL,
    safety_issue TEXT NOT NULL,
    plan_tomorrow TEXT NOT NULL,
    instrument_json TEXT NOT NULL,
    plan_design TEXT NOT NULL,
    raw_data_file TEXT NOT NULL,
    images_json TEXT NOT NULL,
    created_by TEXT,
    created_by_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ==================== PASSWORD HASHING ====================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

// ==================== SEED DATA AWAL ====================
function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO users (id, username, password_hash, full_name, role, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const now = new Date().toISOString();
    insertUser.run('usr-admin-1', 'admin', hashPassword('admin123'), 'Administrator Engineering', 'admin', 'Admin Engineering Dept', now);
    insertUser.run('usr-user-1', 'user', hashPassword('user123'), 'Heru S', 'user', 'Surveyor Engineering', now);
  }

  const ddCount = db.prepare('SELECT COUNT(*) AS cnt FROM dropdowns').get().cnt;
  if (ddCount === 0) {
    const insertDd = db.prepare('INSERT INTO dropdowns (key, label, items_json) VALUES (?, ?, ?)');
    insertDd.run('area', 'Area', JSON.stringify(['Segment C2']));
    insertDd.run('wheater', 'Wheater', JSON.stringify(['Cerah', 'Berawan', 'Mendung', 'Hujan Ringan', 'Hujan Deras']));
    insertDd.run('manPower', 'Man Power', JSON.stringify(['Heru S', 'Mustofa Nur', 'Enggar P']));
    insertDd.run('instrument', 'Instrument', JSON.stringify(['GNSS SOKKIA GRX3', 'LEICA MS60 NOVA']));
  }

  const sampleSeeded = db.prepare('SELECT value FROM settings WHERE key = ?').get('sampleReportSeeded');
  if (!sampleSeeded) {
    const rptCount = db.prepare('SELECT COUNT(*) AS cnt FROM reports').get().cnt;
    if (rptCount === 0) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO reports (
          id, date_day, date_month, date_year, date_formatted, date_iso,
          area, job, wheater, man_power_json, safety_issue, plan_tomorrow,
          instrument_json, plan_design, raw_data_file, images_json,
          created_by, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'rpt-sample-20261124',
        24,
        11,
        2026,
        '24 November 2026',
        '2026-11-24',
        'Segment C2',
        [
          '1. Situasi jalan sta 14+700-15+520 dan sta 13+700-13+850',
          '2. Pemasangan in out plan csp 3 sta 14+350',
          '3. Pemasangan toe fill sta 14+600-14+650',
          '4. Pengambilan original jalan sta 14+350'
        ].join('\n'),
        'Cerah',
        JSON.stringify(['Heru S', 'Mustofa Nur', 'Enggar P']),
        '-',
        '-',
        JSON.stringify(['GNSS SOKKIA GRX3', 'LEICA MS60 NOVA']),
        'DESIGN SEGMENT C2.dxf',
        '261124_ST_HML',
        JSON.stringify([]),
        'usr-user-1',
        'Heru S',
        now,
        now
      );
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('sampleReportSeeded', 'true');
  }
}

seedInitialData();

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '25mb' }));

// Static assets yang aman (tidak mengekspos server.js / data/)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

function getToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const row = db
    .prepare(`
      SELECT u.id, u.username, u.full_name, u.role, u.position, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `)
    .get(token);

  if (!row) return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir' });

  req.token = token;
  req.user = {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    position: row.position || '',
    createdAt: row.created_at
  };
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Akses khusus Admin' });
    }
    next();
  });
}

// ==================== HELPER FUNCTIONS ====================
function getLogosObj() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('logo_company', 'logo_pdf_left', 'logo_pdf_right')").all();
  const map = {};
  rows.forEach((r) => {
    map[r.key] = r.value;
  });
  return {
    company: map.logo_company || 'assets/logo-hml.png',
    pdfLeft: map.logo_pdf_left || 'assets/logo-dbk.jpeg',
    pdfRight: map.logo_pdf_right || 'assets/logo-petrosea.jpeg'
  };
}

function getDropdownsMap() {
  const rows = db.prepare('SELECT key, items_json FROM dropdowns').all();
  const map = {};
  rows.forEach((r) => {
    try {
      map[r.key] = JSON.parse(r.items_json);
    } catch (_) {
      map[r.key] = [];
    }
  });
  return map;
}

function formatReportRow(row) {
  return {
    id: row.id,
    dateDay: row.date_day,
    dateMonth: row.date_month,
    dateYear: row.date_year,
    dateFormatted: row.date_formatted,
    dateISO: row.date_iso,
    area: row.area,
    job: row.job,
    wheater: row.wheater,
    manPower: JSON.parse(row.man_power_json || '[]'),
    safetyIssue: row.safety_issue,
    planTomorrow: row.plan_tomorrow,
    instrument: JSON.parse(row.instrument_json || '[]'),
    planDesign: row.plan_design,
    rawDataFile: row.raw_data_file,
    images: JSON.parse(row.images_json || '[]'),
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function saveDataUrlToUploads(dataUrl, prefix = 'img') {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) {
    throw new Error('Format gambar tidak valid');
  }
  const mime = match[1].toLowerCase();
  const base64Data = match[2];
  let ext = 'jpg';
  if (mime.includes('png')) ext = 'png';
  else if (mime.includes('webp')) ext = 'webp';
  else if (mime.includes('svg')) ext = 'svg';
  else if (mime.includes('gif')) ext = 'gif';

  const fileName = `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  const fullPath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
  return `/uploads/${fileName}`;
}

function safeUnlinkUpload(urlPath) {
  if (!urlPath || typeof urlPath !== 'string' || !urlPath.startsWith('/uploads/')) return;
  const baseName = path.basename(urlPath);
  const fullPath = path.join(UPLOADS_DIR, baseName);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (_) {
      // ignore cleanup error
    }
  }
}

// ==================== PUBLIC API ====================
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/public-logos', (_req, res) => {
  res.json({ logos: getLogosObj() });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const row = db
    .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)')
    .get(String(username).trim());

  if (!row || !verifyPassword(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(
    token,
    row.id,
    new Date().toISOString()
  );

  res.json({
    token,
    user: {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      position: row.position || '',
      createdAt: row.created_at
    }
  });
});

app.post('/api/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ ok: true });
});

// ==================== BOOTSTRAP & UPLOAD ====================
app.get('/api/bootstrap', requireAuth, (req, res) => {
  const reports = db
    .prepare('SELECT * FROM reports ORDER BY created_at DESC')
    .all()
    .map(formatReportRow);

  const payload = {
    user: req.user,
    dropdowns: getDropdownsMap(),
    logos: getLogosObj(),
    reports
  };

  if (req.user.role === 'admin') {
    payload.users = db
      .prepare('SELECT id, username, full_name, role, position, created_at FROM users ORDER BY created_at ASC')
      .all()
      .map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        role: u.role,
        position: u.position || '',
        createdAt: u.created_at
      }));
  }

  res.json(payload);
});

app.post('/api/upload', requireAuth, (req, res) => {
  try {
    const { id, name, dataUrl, originalSize, compressedSize, width, height } = req.body || {};
    if (!dataUrl) {
      return res.status(400).json({ error: 'Data gambar kosong' });
    }
    const url = saveDataUrlToUploads(dataUrl, 'doc');
    res.json({
      id: id || `img-${Date.now()}`,
      name: name || 'foto.jpg',
      dataUrl: url,
      originalSize: Number(originalSize) || 0,
      compressedSize: Number(compressedSize) || 0,
      width: Number(width) || 0,
      height: Number(height) || 0
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Gagal mengunggah gambar' });
  }
});

// ==================== REPORTS CRUD ====================
app.get('/api/reports', requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
  res.json(rows.map(formatReportRow));
});

app.post('/api/reports', requireAuth, (req, res) => {
  const b = req.body || {};
  const id = `rpt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO reports (
      id, date_day, date_month, date_year, date_formatted, date_iso,
      area, job, wheater, man_power_json, safety_issue, plan_tomorrow,
      instrument_json, plan_design, raw_data_file, images_json,
      created_by, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    Number(b.dateDay) || 1,
    Number(b.dateMonth) || 1,
    Number(b.dateYear) || new Date().getFullYear(),
    String(b.dateFormatted || '-'),
    String(b.dateISO || ''),
    String(b.area || '-'),
    String(b.job || '-'),
    String(b.wheater || '-'),
    JSON.stringify(Array.isArray(b.manPower) ? b.manPower : []),
    String(b.safetyIssue || '-'),
    String(b.planTomorrow || '-'),
    JSON.stringify(Array.isArray(b.instrument) ? b.instrument : []),
    String(b.planDesign || '-'),
    String(b.rawDataFile || '-'),
    JSON.stringify(Array.isArray(b.images) ? b.images : []),
    req.user.id,
    req.user.fullName,
    now,
    now
  );

  const created = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  res.status(201).json(formatReportRow(created));
});

app.put('/api/reports/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

  const b = req.body || {};
  const now = new Date().toISOString();

  // Bersihkan gambar lama yang dihapus saat edit
  const oldImages = JSON.parse(existing.images_json || '[]');
  const newImages = Array.isArray(b.images) ? b.images : [];
  const newUrls = new Set(newImages.map((img) => img.dataUrl));
  oldImages.forEach((img) => {
    if (img.dataUrl && !newUrls.has(img.dataUrl)) {
      safeUnlinkUpload(img.dataUrl);
    }
  });

  db.prepare(`
    UPDATE reports SET
      date_day = ?, date_month = ?, date_year = ?, date_formatted = ?, date_iso = ?,
      area = ?, job = ?, wheater = ?, man_power_json = ?, safety_issue = ?, plan_tomorrow = ?,
      instrument_json = ?, plan_design = ?, raw_data_file = ?, images_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    Number(b.dateDay) || existing.date_day,
    Number(b.dateMonth) || existing.date_month,
    Number(b.dateYear) || existing.date_year,
    String(b.dateFormatted || existing.date_formatted),
    String(b.dateISO || existing.date_iso),
    String(b.area || '-'),
    String(b.job || '-'),
    String(b.wheater || '-'),
    JSON.stringify(Array.isArray(b.manPower) ? b.manPower : []),
    String(b.safetyIssue || '-'),
    String(b.planTomorrow || '-'),
    JSON.stringify(Array.isArray(b.instrument) ? b.instrument : []),
    String(b.planDesign || '-'),
    String(b.rawDataFile || '-'),
    JSON.stringify(newImages),
    now,
    id
  );

  const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  res.json(formatReportRow(updated));
});

app.delete('/api/reports/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

  const oldImages = JSON.parse(existing.images_json || '[]');
  oldImages.forEach((img) => safeUnlinkUpload(img.dataUrl));

  db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ==================== ADMIN: USERS CRUD ====================
app.post('/api/users', requireAdmin, (req, res) => {
  const { fullName, username, password, position, role } = req.body || {};
  if (!fullName || !username || !password) {
    return res.status(400).json({ error: 'Nama lengkap, username, dan password wajib diisi' });
  }
  const cleanUsername = String(username).trim();
  const dup = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
  if (dup) return res.status(409).json({ error: 'Username sudah digunakan' });

  const id = `usr-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const validRole = role === 'admin' ? 'admin' : 'user';
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO users (id, username, password_hash, full_name, role, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, cleanUsername, hashPassword(String(password)), String(fullName).trim(), validRole, String(position || '').trim(), now);

  res.status(201).json({
    id,
    username: cleanUsername,
    fullName: String(fullName).trim(),
    role: validRole,
    position: String(position || '').trim(),
    createdAt: now
  });
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User tidak ditemukan' });

  const { fullName, username, password, position, role } = req.body || {};
  const cleanUsername = String(username || existing.username).trim();
  const cleanFullName = String(fullName || existing.full_name).trim();
  const validRole = role === 'admin' ? 'admin' : 'user';

  const dup = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?')
    .get(cleanUsername, id);
  if (dup) return res.status(409).json({ error: 'Username sudah digunakan user lain' });

  if (existing.role === 'admin' && validRole !== 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'").get().cnt;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Harus ada minimal 1 akun Admin aktif' });
    }
  }

  const newHash = password && String(password).trim() !== ''
    ? hashPassword(String(password))
    : existing.password_hash;

  db.prepare(
    'UPDATE users SET username = ?, password_hash = ?, full_name = ?, role = ?, position = ? WHERE id = ?'
  ).run(cleanUsername, newHash, cleanFullName, validRole, String(position || '').trim(), id);

  res.json({
    id,
    username: cleanUsername,
    fullName: cleanFullName,
    role: validRole,
    position: String(position || '').trim(),
    createdAt: existing.created_at
  });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
  }
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User tidak ditemukan' });

  if (existing.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'").get().cnt;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Tidak dapat menghapus satu-satunya Admin' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ==================== ADMIN: MASTER DROPDOWNS ====================
const ALLOWED_DROPDOWN_KEYS = {
  area: 'Area',
  wheater: 'Wheater',
  manPower: 'Man Power',
  instrument: 'Instrument'
};

app.put('/api/dropdowns/:key', requireAdmin, (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_DROPDOWN_KEYS[key]) {
    return res.status(400).json({ error: 'Kategori dropdown tidak dikenal' });
  }
  const items = Array.isArray(req.body.items) ? req.body.items.map((x) => String(x).trim()).filter(Boolean) : [];
  db.prepare('INSERT OR REPLACE INTO dropdowns (key, label, items_json) VALUES (?, ?, ?)').run(
    key,
    ALLOWED_DROPDOWN_KEYS[key],
    JSON.stringify(items)
  );
  res.json({ key, items });
});

// ==================== ADMIN: LOGOS ====================
const LOGO_KEY_MAP = {
  company: 'logo_company',
  pdfLeft: 'logo_pdf_left',
  pdfRight: 'logo_pdf_right'
};

app.put('/api/settings/logo/:slot', requireAdmin, (req, res) => {
  const settingKey = LOGO_KEY_MAP[req.params.slot];
  if (!settingKey) return res.status(400).json({ error: 'Slot logo tidak valid' });

  try {
    const { dataUrl } = req.body || {};
    const oldRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey);
    const savedUrl = saveDataUrlToUploads(dataUrl, `logo-${req.params.slot}`);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(settingKey, savedUrl);
    if (oldRow && oldRow.value) safeUnlinkUpload(oldRow.value);
    res.json({ logos: getLogosObj() });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Gagal menyimpan logo' });
  }
});

app.delete('/api/settings/logo/:slot', requireAdmin, (req, res) => {
  const settingKey = LOGO_KEY_MAP[req.params.slot];
  if (!settingKey) return res.status(400).json({ error: 'Slot logo tidak valid' });

  const oldRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey);
  if (oldRow && oldRow.value) safeUnlinkUpload(oldRow.value);
  db.prepare('DELETE FROM settings WHERE key = ?').run(settingKey);
  res.json({ logos: getLogosObj() });
});

// ==================== SPA ENTRYPOINT ====================
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HML Engineering Report server running on http://0.0.0.0:${PORT}`);
  console.log(`Persistent data directory: ${DATA_DIR}`);
});
