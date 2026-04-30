// state.js
export let appData = { reminders: [], stats: {}, settings: {} };

let saveTimeout = null;

export function setAppData(data) {
  // Garbage Collection: Remove completed tasks older than 30 days
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  if (data && Array.isArray(data.reminders)) {
    data.reminders = data.reminders.filter(r => {
      if (!r.completed) return true;
      if (!r.createdAt) return true;
      // Keep if created within 30 days
      return (now - r.createdAt) < THIRTY_DAYS_MS;
    });
  }

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
