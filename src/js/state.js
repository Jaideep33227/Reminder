// state.js
export let appData = { reminders: [], stats: {}, settings: {} };

let saveTimeout = null;

export function setAppData(data) {
  appData = data;
}

export function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => window.api.saveData(appData), 300);
}

export function todayStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
