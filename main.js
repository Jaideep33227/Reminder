const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, globalShortcut, Notification, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Data Persistence ───────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const DATA_FILE = path.join(DATA_DIR, 'appdata.json');

const DEFAULT_DATA = {
  reminders: [],
  stats: {
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: null,
    totalCompleted: 0,
    dailyCompletions: {},
    missedReminders: 0
  },
  settings: {
    discordWebhook: '',
    weatherCity: '',
    soundEnabled: true,
    theme: 'dark'
  }
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAppData() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Merge with defaults so new fields are always present
      return {
        reminders: parsed.reminders || [],
        stats: { ...DEFAULT_DATA.stats, ...parsed.stats },
        settings: { ...DEFAULT_DATA.settings, ...parsed.settings }
      };
    }
  } catch (err) {
    console.error('Failed to load app data:', err);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveAppData(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save app data:', err);
  }
}

// ─── Window & Tray ──────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;

function getIconPath() {
  return path.join(__dirname, 'assets', 'icon.png');
}

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 420;
  const winHeight = 680;
  const margin = 16;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenW - winWidth - margin,
    y: screenH - winHeight - margin,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const iconPath = getIconPath();
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Reminder Widget');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Widget',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { isQuitting = true; app.quit(); },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.focus();
      else { mainWindow.show(); mainWindow.focus(); }
    }
  });
}

// ─── IPC Handlers ───────────────────────────────────────────────────
ipcMain.handle('load-data', () => loadAppData());
ipcMain.handle('save-data', (_event, data) => { saveAppData(data); return true; });
ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.hide(); });
ipcMain.handle('close-window', () => { if (mainWindow) mainWindow.hide(); });

ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    const current = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!current);
    return !current;
  }
  return true;
});

let isMiniMode = false;
ipcMain.handle('toggle-mini-mode', () => {
  if (mainWindow) {
    isMiniMode = !isMiniMode;
    if (isMiniMode) {
      mainWindow.setSize(420, 100, true);
    } else {
      mainWindow.setSize(420, 680, true);
    }
    return isMiniMode;
  }
  return false;
});

ipcMain.handle('show-notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    const notif = new Notification({ title, body, icon: getIconPath(), silent: true });
    notif.show();
    notif.on('click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
  }
});

ipcMain.handle('export-backup', async () => {
  if (!mainWindow) return false;
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Backup',
    defaultPath: path.join(app.getPath('documents'), 'reminders-backup.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (filePath) {
    const data = loadAppData();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }
  return false;
});

ipcMain.handle('import-backup', async () => {
  if (!mainWindow) return null;
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Backup',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (filePaths && filePaths.length > 0) {
    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8');
      const parsed = JSON.parse(raw);
      saveAppData(parsed);
      return parsed;
    } catch (e) {
      console.error('Failed to import backup', e);
      return null;
    }
  }
  return null;
});

// Fetch weather from wttr.in (no API key needed)
ipcMain.handle('fetch-weather', async (_event, city) => {
  if (!city) return null;
  return new Promise((resolve) => {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    const request = net.request(url);
    let body = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk.toString(); });
      response.on('end', () => {
        try {
          const json = JSON.parse(body);
          const current = json.current_condition[0];
          resolve({
            temp: current.temp_F,
            tempC: current.temp_C,
            desc: current.weatherDesc[0].value,
            humidity: current.humidity,
            feelsLike: current.FeelsLikeF
          });
        } catch {
          resolve(null);
        }
      });
    });
    request.on('error', () => resolve(null));
    request.end();
  });
});

// Send Discord webhook
ipcMain.handle('send-discord-webhook', async (_event, { webhookUrl, content }) => {
  if (!webhookUrl) return false;
  return new Promise((resolve) => {
    const url = new URL(webhookUrl);
    const postData = JSON.stringify({ content });
    const request = net.request({
      method: 'POST',
      url: webhookUrl,
    });
    request.setHeader('Content-Type', 'application/json');
    request.on('response', (response) => {
      resolve(response.statusCode >= 200 && response.statusCode < 300);
    });
    request.on('error', () => resolve(false));
    request.write(postData);
    request.end();
  });
});

// ─── App Lifecycle ──────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  globalShortcut.register('Ctrl+Shift+R', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.focus();
      else { mainWindow.show(); mainWindow.focus(); }
      mainWindow.webContents.send('focus-input');
    }
  });
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => { /* stay in tray */ });
app.on('activate', () => {
  if (mainWindow === null) createWindow();
  else mainWindow.show();
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
