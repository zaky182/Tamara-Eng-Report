/**
 * IndexedDB Storage Layer — Engineering Dept . PT Harapan Mitra Lestari
 * Menggunakan IndexedDB agar penyimpanan laporan & foto dokumentasi tidak terbatas (unlimited).
 */
const DB_NAME = 'HML_Engineering_Report_DB';
const DB_VERSION = 1;

const DEFAULT_USERS = [
  {
    id: 'usr-admin-1',
    username: 'admin',
    password: 'admin123',
    fullName: 'Administrator Engineering',
    role: 'admin',
    position: 'Admin Engineering Dept',
    createdAt: new Date().toISOString()
  },
  {
    id: 'usr-user-1',
    username: 'user',
    password: 'user123',
    fullName: 'Heru S',
    role: 'user',
    position: 'Surveyor Engineering',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_DROPDOWNS = [
  {
    key: 'area',
    label: 'Area',
    items: ['Segment C2']
  },
  {
    key: 'wheater',
    label: 'Wheater',
    items: ['Cerah', 'Berawan', 'Mendung', 'Hujan Ringan', 'Hujan Deras']
  },
  {
    key: 'manPower',
    label: 'Man Power',
    items: ['Heru S', 'Mustofa Nur', 'Enggar P']
  },
  {
    key: 'instrument',
    label: 'Instrument',
    items: ['GNSS SOKKIA GRX3', 'LEICA MS60 NOVA']
  }
];

const DEFAULT_SAMPLE_REPORT = {
  id: 'rpt-sample-20261124',
  dateDay: 24,
  dateMonth: 11,
  dateYear: 2026,
  dateFormatted: '24 November 2026',
  dateISO: '2026-11-24',
  area: 'Segment C2',
  job: [
    '1. Situasi jalan sta 14+700-15+520 dan sta 13+700-13+850',
    '2. Pemasangan in out plan csp 3 sta 14+350',
    '3. Pemasangan toe fill sta 14+600-14+650',
    '4. Pengambilan original jalan sta 14+350'
  ].join('\n'),
  wheater: 'Cerah',
  manPower: ['Heru S', 'Mustofa Nur', 'Enggar P'],
  safetyIssue: '-',
  planTomorrow: '-',
  instrument: ['GNSS SOKKIA GRX3', 'LEICA MS60 NOVA'],
  planDesign: 'DESIGN SEGMENT C2.dxf',
  rawDataFile: '261124_ST_HML',
  images: [],
  createdBy: 'usr-user-1',
  createdByName: 'Heru S',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const DB = (() => {
  let dbInstance = null;

  function open() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('username', 'username', { unique: true });
        }
        if (!db.objectStoreNames.contains('dropdowns')) {
          db.createObjectStore('dropdowns', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('reports')) {
          const reportStore = db.createObjectStore('reports', { keyPath: 'id' });
          reportStore.createIndex('dateISO', 'dateISO', { unique: false });
          reportStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        reject(event.target.error || new Error('Gagal membuka IndexedDB'));
      };
    });
  }

  function tx(storeName, mode = 'readonly') {
    return open().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function getAll(storeName) {
    return tx(storeName, 'readonly').then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function getOne(storeName, key) {
    return tx(storeName, 'readonly').then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function put(storeName, item) {
    return tx(storeName, 'readwrite').then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.put(item);
          req.onsuccess = () => resolve(item);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function remove(storeName, key) {
    return tx(storeName, 'readwrite').then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.delete(key);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        })
    );
  }

  async function initSeed() {
    await open();

    const users = await getAll('users');
    if (users.length === 0) {
      for (const u of DEFAULT_USERS) {
        await put('users', u);
      }
    }

    const dropdowns = await getAll('dropdowns');
    if (dropdowns.length === 0) {
      for (const d of DEFAULT_DROPDOWNS) {
        await put('dropdowns', d);
      }
    }

    const seededFlag = await getOne('settings', 'sampleReportSeeded');
    if (!seededFlag) {
      const existingReports = await getAll('reports');
      if (existingReports.length === 0) {
        await put('reports', DEFAULT_SAMPLE_REPORT);
      }
      await put('settings', { key: 'sampleReportSeeded', value: true });
    }
  }

  return {
    initSeed,
    getAll,
    getOne,
    put,
    remove
  };
})();
