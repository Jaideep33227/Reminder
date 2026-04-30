const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, globalShortcut, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Data Persistence ───────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const DATA_FILE = path.join(DATA_DIR, 'reminders.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadReminders() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load reminders:', err);
  }
  return [];
}

function saveReminders(reminders) {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(reminders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save reminders:', err);
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

  const winWidth = 420; // Slightly wider for new features
  const winHeight = 650; // Taller for more content
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
  tray.setToolTip('Smart Reminder Widget');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Widget',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ─── IPC Handlers ───────────────────────────────────────────────────
ipcMain.handle('load-reminders', () => {
  return loadReminders();
});

ipcMain.handle('save-reminders', (_event, reminders) => {
  saveReminders(reminders);
  return true;
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    const current = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!current);
    return !current;
  }
  return true;
});

// Notifications
ipcMain.handle('show-notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: title,
      body: body,
      icon: getIconPath(),
      silent: true // We'll play custom sound in renderer
    });
    notif.show();
    
    notif.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
});

// Export Backup
ipcMain.handle('export-backup', async () => {
  if (!mainWindow) return false;
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Reminders Backup',
    defaultPath: path.join(app.getPath('documents'), 'reminders-backup.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  
  if (filePath) {
    const data = loadReminders();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }
  return false;
});

// ─── App Lifecycle ──────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  globalShortcut.register('Ctrl+Shift+R', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
      mainWindow.webContents.send('focus-input');
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Don't quit — we live in the tray
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
