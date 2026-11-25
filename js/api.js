/**
 * REST API Client — Engineering Dept . PT Harapan Mitra Lestari
 * Menghubungkan frontend ke backend Node.js + SQLite (Dokploy).
 */
const API = (() => {
  const TOKEN_KEY = 'hml_eng_auth_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request gagal (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    getToken,
    setToken,

    getPublicLogos: () => request('/api/public-logos'),

    login: async (username, password) => {
      const res = await request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setToken(res.token);
      return res;
    },

    logout: async () => {
      try {
        if (getToken()) {
          await request('/api/logout', { method: 'POST' });
        }
      } finally {
        setToken('');
      }
    },

    bootstrap: () => request('/api/bootstrap'),

    uploadPhoto: (photoObj) =>
      request('/api/upload', {
        method: 'POST',
        body: JSON.stringify(photoObj)
      }),

    createReport: (reportObj) =>
      request('/api/reports', {
        method: 'POST',
        body: JSON.stringify(reportObj)
      }),

    updateReport: (id, reportObj) =>
      request(`/api/reports/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(reportObj)
      }),

    deleteReport: (id) =>
      request(`/api/reports/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      }),

    createUser: (userObj) =>
      request('/api/users', {
        method: 'POST',
        body: JSON.stringify(userObj)
      }),

    updateUser: (id, userObj) =>
      request(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(userObj)
      }),

    deleteUser: (id) =>
      request(`/api/users/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      }),

    saveDropdown: (key, items) =>
      request(`/api/dropdowns/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({ items })
      }),

    uploadLogo: (slot, dataUrl) =>
      request(`/api/settings/logo/${encodeURIComponent(slot)}`, {
        method: 'PUT',
        body: JSON.stringify({ dataUrl })
      }),

    resetLogo: (slot) =>
      request(`/api/settings/logo/${encodeURIComponent(slot)}`, {
        method: 'DELETE'
      })
  };
})();
