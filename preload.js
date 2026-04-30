const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  showNotification: (opts) => ipcRenderer.invoke('show-notification', opts),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  fetchWeather: (city) => ipcRenderer.invoke('fetch-weather', city),
  sendDiscordWebhook: (opts) => ipcRenderer.invoke('send-discord-webhook', opts),
  onFocusInput: (cb) => ipcRenderer.on('focus-input', cb),
});
