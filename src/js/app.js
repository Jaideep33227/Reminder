// app.js
import { appData, setAppData, scheduleSave, todayStr, generateId } from './state.js';
import { gainXP, updateStreak, applyFeatureLocks, XP_HARD, XP_MEDIUM, XP_EASY, XP_EARLY_BONUS, XP_LATE_BONUS, XP_COMBO_BONUS, COMBO_TIME_WINDOW } from './gamification.js';
import { initTimer } from './timer.js';
import { playSound } from './audio.js';
import { bindSearchAndFilters, updateCountdowns, renderTasks, renderXpBar, renderStats } from './ui.js';

let pendingDeletedTask = null;
let deletedTaskTimeout = null;

async function init() {
  const loadedData = await window.api.loadData();
  
  if (!loadedData.stats) loadedData.stats = {};
  if (!loadedData.settings) loadedData.settings = {};
  if (!loadedData.reminders) loadedData.reminders = [];
  if (!loadedData.stats.dailyCompletions) loadedData.stats.dailyCompletions = {};
  if (!loadedData.stats.recentCompletions) loadedData.stats.recentCompletions = [];
  
  // Ensure legacy tasks have xpGiven flag
  loadedData.reminders.forEach(r => {
    if (r.completed && r.xpGiven === undefined) r.xpGiven = true;
    if (!r.completed && r.xpGiven === undefined) r.xpGiven = false;
  });

  setAppData(loadedData);

  applyTheme(appData.settings.theme || 'dark');
  applySoundToggle(appData.settings.soundEnabled !== false);
  updateStreak();
  applyFeatureLocks();
  
  bindSearchAndFilters(doRenderTasks);
  doRenderTasks();
  renderXpBar();
  renderStats();
  loadWeather();
  loadSettingsUI();
  initTimer();

  document.getElementById('reminderInput').focus();
  document.getElementById('pinBtn').classList.add('active');

  setInterval(checkNotifications, 60000); // Check every minute
  setTimeout(checkNotifications, 3000);
  bindEvents();
}

function doRenderTasks() {
  renderTasks(toggleReminder, deleteReminder);
}

function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.view).classList.add('active');
      if (btn.dataset.view === 'viewStats') renderStats();
    });
  });

  // Window Controls & Modes
  document.getElementById('minimizeBtn').addEventListener('click', () => window.api.minimizeWindow());
  
  document.getElementById('closeBtn').addEventListener('click', () => {
    const today = todayStr();
    const hasUnfinishedHigh = appData.reminders.some(r => !r.completed && r.priority === 'high' && r.dueDate === today);
    if (hasUnfinishedHigh) {
      window.api.showNotification({ title: 'Priority Lock Active', body: 'Complete your high-priority tasks for today before closing!' });
      return;
    }
    window.api.closeWindow();
  });

  document.getElementById('pinBtn').addEventListener('click', async (e) => {
    const on = await window.api.toggleAlwaysOnTop();
    e.currentTarget.classList.toggle('active', on);
  });
  window.api.onFocusInput(() => document.getElementById('reminderInput').focus());

  document.getElementById('miniModeBtn').addEventListener('click', async () => {
    const isMini = await window.api.toggleMiniMode();
    document.body.classList.toggle('mini-mode', isMini);
  });

  document.getElementById('focusModeBtn').addEventListener('click', () => {
    document.body.classList.toggle('focus-mode');
  });

  // Add Form & Brain Dump
  document.getElementById('toggleAdvancedBtn').addEventListener('click', () => {
    document.getElementById('advancedPanel').classList.toggle('visible');
    document.getElementById('toggleAdvancedBtn').classList.toggle('open');
  });

  document.getElementById('reminderInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addReminder(); }
  });

  document.getElementById('undoBtn').addEventListener('click', () => {
    if (pendingDeletedTask) {
      appData.reminders.unshift(pendingDeletedTask);
      pendingDeletedTask = null;
      document.getElementById('undoToast').classList.remove('visible');
      clearTimeout(deletedTaskTimeout);
      doRenderTasks();
      scheduleSave();
    }
  });

  document.getElementById('clearDoneBtn').addEventListener('click', () => {
    appData.reminders = appData.reminders.filter(x => !x.completed);
    doRenderTasks();
    scheduleSave();
  });

  // Settings Events
  document.getElementById('themeDarkBtn').addEventListener('click', () => {
    if (document.getElementById('themeContainer').classList.contains('is-locked')) return;
    setTheme('dark');
  });
  document.getElementById('themeLightBtn').addEventListener('click', () => {
    if (document.getElementById('themeContainer').classList.contains('is-locked')) return;
    setTheme('light');
  });

  document.getElementById('soundToggle').addEventListener('click', () => {
    if (document.getElementById('soundContainer').classList.contains('is-locked')) return;
    const on = !appData.settings.soundEnabled;
    appData.settings.soundEnabled = on;
    applySoundToggle(on);
    scheduleSave();
  });

  document.getElementById('saveWeatherBtn').addEventListener('click', () => {
    appData.settings.weatherCity = document.getElementById('weatherCityInput').value.trim();
    loadWeather();
    scheduleSave();
  });

  document.getElementById('saveWebhookBtn').addEventListener('click', () => {
    appData.settings.discordWebhook = document.getElementById('discordWebhookInput').value.trim();
    scheduleSave();
  });

  document.getElementById('testWebhookBtn').addEventListener('click', async () => {
    const url = document.getElementById('discordWebhookInput').value.trim();
    if (!url) return;
    const ok = await window.api.sendDiscordWebhook({ webhookUrl: url, content: 'Reminder Widget connected successfully.' });
    document.getElementById('testWebhookBtn').textContent = ok ? 'Sent' : 'Failed';
    setTimeout(() => { document.getElementById('testWebhookBtn').textContent = 'Test'; }, 2000);
  });

  document.getElementById('exportBtn').addEventListener('click', () => window.api.exportBackup());
  
  document.getElementById('importBtn').addEventListener('click', async () => {
    const importedData = await window.api.importBackup();
    if (importedData) {
      setAppData(importedData);
      doRenderTasks();
      renderStats();
      loadSettingsUI();
      applyFeatureLocks();
      window.api.showNotification({ title: 'Success', body: 'Backup imported successfully.' });
    }
  });
}

function addReminder() {
  const input = document.getElementById('reminderInput');
  const fullText = input.value.trim();
  if (!fullText) return;

  const parts = fullText.split(/,| and |;/i).map(p => p.trim()).filter(Boolean);

  parts.forEach(text => {
    const reminder = {
      id: generateId(),
      text,
      completed: false,
      xpGiven: false,
      createdAt: Date.now(),
      dueDate: document.getElementById('dateInput').value || null,
      dueTime: document.getElementById('timeInput').value || null,
      priority: document.getElementById('prioritySelect').value,
      category: document.getElementById('categorySelect').value !== 'none' ? document.getElementById('categorySelect').value : null,
      notified: false
    };
    appData.reminders.unshift(reminder);

    if (appData.settings.discordWebhook) {
      window.api.sendDiscordWebhook({
        webhookUrl: appData.settings.discordWebhook,
        content: `New reminder: **${text}**` + (reminder.dueDate ? ` (Due: ${reminder.dueDate})` : '')
      });
    }
  });

  input.value = '';
  document.getElementById('dateInput').value = '';
  document.getElementById('timeInput').value = '';
  document.getElementById('prioritySelect').value = 'medium';
  document.getElementById('categorySelect').value = 'none';
  document.getElementById('advancedPanel').classList.remove('visible');
  document.getElementById('toggleAdvancedBtn').classList.remove('open');

  doRenderTasks();
  scheduleSave();
}

function toggleReminder(id) {
  const r = appData.reminders.find(x => x.id === id);
  if (!r) return;

  if (!r.completed) {
    if (Date.now() - r.createdAt < 5000) {
      window.api.showNotification({ title: 'Spam Protection', body: 'Task completed too quickly! No XP awarded.' });
      r.completed = true;
    } else {
      r.completed = true;
      if (!r.xpGiven) {
        let xpToGive = 0;
        if (r.priority === 'high') xpToGive += XP_HARD;
        else if (r.priority === 'medium') xpToGive += XP_MEDIUM;
        else xpToGive += XP_EASY;

        const today = todayStr();
        if (r.dueDate) {
          if (r.dueDate > today) xpToGive += XP_EARLY_BONUS;
          if (r.dueDate < today) xpToGive += XP_LATE_BONUS;
        }

        gainXP(xpToGive);
        r.xpGiven = true;
        
        const now = Date.now();
        appData.stats.recentCompletions = appData.stats.recentCompletions.filter(t => now - t < COMBO_TIME_WINDOW);
        appData.stats.recentCompletions.push(now);

        if (appData.stats.recentCompletions.length >= 3) {
          gainXP(XP_COMBO_BONUS);
          appData.stats.recentCompletions = [];
          window.api.showNotification({ title: '🔥 COMBO BONUS!', body: '3 tasks completed quickly. +15 XP!' });
        }
      }

      appData.stats.totalCompleted = (appData.stats.totalCompleted || 0) + 1;
      const today = todayStr();
      appData.stats.dailyCompletions[today] = (appData.stats.dailyCompletions[today] || 0) + 1;
    }
  } else {
    r.completed = false;
  }

  doRenderTasks();
  renderXpBar();
  scheduleSave();
}

function deleteReminder(id) {
  const index = appData.reminders.findIndex(x => x.id === id);
  if (index === -1) return;

  pendingDeletedTask = appData.reminders[index];
  appData.reminders.splice(index, 1);
  
  doRenderTasks();
  scheduleSave();

  const undoToast = document.getElementById('undoToast');
  undoToast.classList.add('visible');
  clearTimeout(deletedTaskTimeout);
  deletedTaskTimeout = setTimeout(() => {
    undoToast.classList.remove('visible');
    pendingDeletedTask = null;
  }, 5000);
}

function checkNotifications() {
  const now = new Date();
  const today = todayStr();
  const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  let triggered = false;

  appData.reminders.forEach(r => {
    if (!r.completed && !r.notified && r.dueDate && r.dueTime) {
      if (r.dueDate === today && r.dueTime === timeStr) {
        window.api.showNotification({ title: 'Reminder Due', body: r.text });
        r.notified = true;
        triggered = true;
      }
      if (r.dueDate < today || (r.dueDate === today && r.dueTime < timeStr && !r.notified)) {
        appData.stats.missedReminders = (appData.stats.missedReminders || 0) + 1;
        r.notified = true;
        triggered = true;
      }
    }
  });

  if (triggered) {
    playSound(appData.settings);
    scheduleSave();
  }
  
  // PERFORMANCE FIX: Only update countdown text, do not rebuild the whole DOM
  updateCountdowns();
}

function loadSettingsUI() {
  document.getElementById('weatherCityInput').value = appData.settings.weatherCity || '';
  document.getElementById('discordWebhookInput').value = appData.settings.discordWebhook || '';

  const theme = appData.settings.theme || 'dark';
  document.getElementById('themeDarkBtn').classList.toggle('active', theme === 'dark');
  document.getElementById('themeLightBtn').classList.toggle('active', theme === 'light');

  applySoundToggle(appData.settings.soundEnabled !== false);
}

function setTheme(t) {
  appData.settings.theme = t;
  applyTheme(t);
  document.getElementById('themeDarkBtn').classList.toggle('active', t === 'dark');
  document.getElementById('themeLightBtn').classList.toggle('active', t === 'light');
  scheduleSave();
}

function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }

function applySoundToggle(on) {
  appData.settings.soundEnabled = on;
  document.getElementById('soundToggle').classList.toggle('on', on);
}

async function loadWeather() {
  const city = appData.settings.weatherCity;
  if (!city) { document.getElementById('weatherBadge').textContent = ''; return; }
  const w = await window.api.fetchWeather(city);
  if (w) {
    document.getElementById('weatherBadge').textContent = `${w.temp}°F · ${w.desc}`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
