import { bnNum, downloadBase64File } from './utils.js';

/**
 * One API surface for both shells:
 *  - Tauri (desktop/mobile): calls the `api_call` Rust command
 *  - Browser: loads the Rust WebAssembly module and calls its `call` export
 * There is no HTTP server and no REST API.
 */
const isTauri = () =>
  typeof window !== 'undefined' &&
  !!(window.__TAURI_INTERNALS__ || window.__TAURI__);

function failure(raw) {
  const status =
    raw && typeof raw === 'object' && typeof raw.status === 'number' ? raw.status : undefined;
  const message =
    raw && typeof raw === 'object' && typeof raw.message === 'string'
      ? raw.message
      : typeof raw === 'string' && raw
        ? raw
        : undefined;
  const error = new Error(
    message || `অনুরোধ ব্যর্থ হয়েছে${status ? ` (${bnNum(status)})` : ''}`
  );
  if (status) error.status = status;
  error.payload = raw;
  return error;
}

let wasmReady = null;

async function callRaw(op, payload) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('api_call', { op, payload: payload ?? null });
  }
  if (!wasmReady) {
    wasmReady = (async () => {
      const mod = await import('../wasm/questionbank_wasm.js');
      await mod.default();
      await mod.boot();
      return mod;
    })();
  }
  const wasm = await wasmReady;
  return wasm.call(op, payload ?? null);
}

export async function call(op, payload) {
  try {
    return await callRaw(op, payload);
  } catch (raw) {
    throw failure(raw);
  }
}

/**
 * Saves an exported file. Desktop writes it to the Downloads folder through
 * the Tauri shell; the browser uses a normal Blob download.
 */
export async function saveDownload(file) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('save_backup_file', {
      filename: file.filename,
      data_base64: file.data_base64,
    });
  }
  downloadBase64File(file);
  return '';
}

export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      resolve(text.slice(text.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('ফাইল পড়া যায়নি'));
    reader.readAsDataURL(file);
  });

async function formPayload(formData) {
  const payload = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      payload[key] = value;
    } else if (value && typeof value.arrayBuffer === 'function') {
      payload[key] = {
        data_base64: await fileToBase64(value),
        filename: value.name || '',
      };
    }
  }
  return payload;
}

const compact = (params) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );

export const API = {
  health: () => call('health'),

  institute: {
    get: () => call('institute.get'),
    update: (body) => call('institute.update', body),
    uploadLogo: async (file) =>
      call('institute.upload_logo', {
        logo: {
          data_base64: await fileToBase64(file),
          filename: file?.name || '',
        },
      }),
    deleteLogo: () => call('institute.delete_logo'),
  },

  classes: {
    list: () => call('classes.list'),
    get: (id) => call('classes.get', { id }),
    create: (body) => call('classes.create', body),
    update: (id, body) => call('classes.update', { id, ...body }),
    remove: (id) => call('classes.delete', { id }),
  },

  subjects: {
    list: (classId) => call('subjects.list', { class_id: classId }),
    get: (id) => call('subjects.get', { id }),
    create: (classId, body) => call('subjects.create', { class_id: classId, ...body }),
    update: (id, body) => call('subjects.update', { id, ...body }),
    remove: (id) => call('subjects.delete', { id }),
  },

  chapters: {
    list: (subjectId) => call('chapters.list', { subject_id: subjectId }),
    get: (id) => call('chapters.get', { id }),
    create: (subjectId, body) => call('chapters.create', { subject_id: subjectId, ...body }),
    update: (id, body) => call('chapters.update', { id, ...body }),
    remove: (id) => call('chapters.delete', { id }),
  },

  types: {
    list: (subjectId) => call('types.list', { subject_id: subjectId }),
    create: (subjectId, body) => call('types.create', { subject_id: subjectId, ...body }),
    update: (id, body) => call('types.update', { id, ...body }),
    remove: (id) => call('types.delete', { id }),
  },

  questions: {
    list: (subjectId, params = {}) =>
      call('questions.list', { subject_id: subjectId, ...compact(params) }),
    get: (id) => call('questions.get', { id }),
    create: (subjectId, body) => call('questions.create', { subject_id: subjectId, ...body }),
    createForm: async (subjectId, formData) =>
      call('questions.create', {
        subject_id: subjectId,
        ...(await formPayload(formData)),
      }),
    update: (id, body) => call('questions.update', { id, ...body }),
    updateForm: async (id, formData) =>
      call('questions.update', { id, ...(await formPayload(formData)) }),
    remove: (id) => call('questions.delete', { id }),
  },

  generate: (body) => call('generate', body),

  papers: {
    list: () => call('papers.list'),
    get: (id) => call('papers.get', { id }),
    update: (id, paper) => call('papers.update', { id, paper }),
    remove: (id) => call('papers.delete', { id }),
  },

  transfer: {
    exportFile: (options = {}) => call('export', options),
    importFile: (options) => call('import', options),
  },

  backup: {
    exportFull: () => call('backup.export', { scope: 'full' }),
    exportClass: (classId) => call('backup.export', { scope: 'class', class_id: classId }),
    restore: (options) => call('backup.restore', options),
  },

  presets: {
    list: () => call('presets.list'),
    save: (name, layout) => call('presets.save', { name, layout }),
    remove: (id) => call('presets.delete', { id }),
  },
};
