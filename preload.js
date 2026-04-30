const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadReminders: () => ipcRenderer.invoke('load-reminders'),
  saveReminders: (reminders) => ipcRenderer.invoke('save-reminders', reminders),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  onFocusInput: (callback) => ipcRenderer.on('focus-input', callback),
});
