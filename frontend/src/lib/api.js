async function http(path, { method = 'GET', body, headers, isForm } = {}) {
  const opts = { method, headers: { ...(headers || {}) } };

  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData — let the browser set Content-Type
    } else {
      opts.headers['Content-Type'] = 'application/json; charset=utf-8';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(path, opts);

  if (res.status === 204) return null;

  const ct = res.headers.get('content-type') || '';
  const payload = ct.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '');

  if (!res.ok) {
    const message =
      (payload && payload.error && payload.error.message) ||
      (typeof payload === 'string' && payload) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

export const API = {
  health: () => http('/health'),

  institute: {
    get: () => http('/api/institute'),
    update: (body) => http('/api/institute', { method: 'PUT', body }),
    uploadLogo: (file) => {
      const fd = new FormData();
      fd.append('logo', file);
      return http('/api/institute/logo', { method: 'PUT', body: fd, isForm: true });
    },
    deleteLogo: () => http('/api/institute/logo', { method: 'DELETE' }),
  },

  classes: {
    list: () => http('/api/classes'),
    get: (id) => http(`/api/classes/${id}`),
    create: (body) => http('/api/classes', { method: 'POST', body }),
    update: (id, body) => http(`/api/classes/${id}`, { method: 'PUT', body }),
    remove: (id) => http(`/api/classes/${id}`, { method: 'DELETE' }),
  },

  subjects: {
    list: (classId) => http(`/api/classes/${classId}/subjects`),
    get: (id) => http(`/api/subjects/${id}`),
    create: (classId, body) => http(`/api/classes/${classId}/subjects`, { method: 'POST', body }),
    update: (id, body) => http(`/api/subjects/${id}`, { method: 'PUT', body }),
    remove: (id) => http(`/api/subjects/${id}`, { method: 'DELETE' }),
  },

  chapters: {
    list: (subjectId) => http(`/api/subjects/${subjectId}/chapters`),
    get: (id) => http(`/api/chapters/${id}`),
    create: (subjectId, body) =>
      http(`/api/subjects/${subjectId}/chapters`, { method: 'POST', body }),
    update: (id, body) => http(`/api/chapters/${id}`, { method: 'PUT', body }),
    remove: (id) => http(`/api/chapters/${id}`, { method: 'DELETE' }),
  },

  types: {
    list: (subjectId) => http(`/api/subjects/${subjectId}/question-types`),
    create: (subjectId, body) =>
      http(`/api/subjects/${subjectId}/question-types`, { method: 'POST', body }),
    update: (id, body) => http(`/api/question-types/${id}`, { method: 'PUT', body }),
    remove: (id) => http(`/api/question-types/${id}`, { method: 'DELETE' }),
  },

  questions: {
    list: (subjectId, params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        qs.set(k, v);
      });
      const tail = qs.toString();
      return http(`/api/subjects/${subjectId}/questions${tail ? '?' + tail : ''}`);
    },
    get: (id) => http(`/api/questions/${id}`),
    create: (subjectId, body) =>
      http(`/api/subjects/${subjectId}/questions`, { method: 'POST', body }),
    createForm: (subjectId, fd) =>
      http(`/api/subjects/${subjectId}/questions`, { method: 'POST', body: fd, isForm: true }),
    update: (id, body) => http(`/api/questions/${id}`, { method: 'PUT', body }),
    updateForm: (id, fd) =>
      http(`/api/questions/${id}`, { method: 'PUT', body: fd, isForm: true }),
    remove: (id) => http(`/api/questions/${id}`, { method: 'DELETE' }),
  },

  generate: (body) => http('/api/generate', { method: 'POST', body }),

  papers: {
    list: () => http('/api/papers'),
    get: (id) => http(`/api/papers/${id}`),
    remove: (id) => http(`/api/papers/${id}`, { method: 'DELETE' }),
  },
};
