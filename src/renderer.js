// Reminder Widget v2 — Renderer
(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────
  let appData = { reminders: [], stats: {}, settings: {} };
  let saveTimeout = null;
  let currentFilter = 'all';
  let searchQuery = '';

  // Pomodoro
  let timerInterval = null;
  let timerSeconds = 25 * 60;
  let timerTotal = 25 * 60;
  let timerRunning = false;
  let pomodoroSessions = 0;

  // XP constants
  const XP_PER_LEVEL = 100;
  const XP_TASK_COMPLETE = 10;
  const XP_HIGH_PRIORITY = 20;
  const XP_STREAK_BONUS = 5;

  // ─── DOM ────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const input = $('reminderInput');
  const listEl = $('reminderList');
  const emptyState = $('emptyState');
  const statsText = $('statsText');

  // ─── Init ───────────────────────────────────────────────────────
  async function init() {
    appData = await window.api.loadData();
    if (!appData.stats) appData.stats = {};
    if (!appData.settings) appData.settings = {};
    if (!appData.reminders) appData.reminders = [];
    if (!appData.stats.dailyCompletions) appData.stats.dailyCompletions = {};

    applyTheme(appData.settings.theme || 'dark');
    applySoundToggle(appData.settings.soundEnabled !== false);
    updateStreak();
    renderTasks();
    renderXpBar();
    renderStats();
    loadWeather();
    loadSettingsUI();

    input.focus();
    $('pinBtn').classList.add('active');

    setInterval(checkNotifications, 60000);
    setTimeout(checkNotifications, 3000);
  }

  document.addEventListener('DOMContentLoaded', init);

  // ─── Navigation ─────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.view).classList.add('active');
      if (btn.dataset.view === 'viewStats') renderStats();
    });
  });

  // ─── Window Controls ────────────────────────────────────────────
  $('minimizeBtn').addEventListener('click', () => window.api.minimizeWindow());
  $('closeBtn').addEventListener('click', () => window.api.closeWindow());
  $('pinBtn').addEventListener('click', async (e) => {
    const on = await window.api.toggleAlwaysOnTop();
    e.currentTarget.classList.toggle('active', on);
  });
  window.api.onFocusInput(() => input.focus());

  // ─── Search & Filters ───────────────────────────────────────────
  $('searchInput').addEventListener('input', (e) => { searchQuery = e.target.value.toLowerCase(); renderTasks(); });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderTasks();
    });
  });

  // ─── Add Form ───────────────────────────────────────────────────
  $('toggleAdvancedBtn').addEventListener('click', () => {
    $('advancedPanel').classList.toggle('visible');
    $('toggleAdvancedBtn').classList.toggle('open');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addReminder(); }
  });

  // ─── CRUD ───────────────────────────────────────────────────────
  function addReminder() {
    const text = input.value.trim();
    if (!text) return;

    const reminder = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: $('dateInput').value || null,
      dueTime: $('timeInput').value || null,
      priority: $('prioritySelect').value,
      category: $('categorySelect').value !== 'none' ? $('categorySelect').value : null,
      notified: false
    };

    appData.reminders.unshift(reminder);
    input.value = '';
    $('dateInput').value = '';
    $('timeInput').value = '';
    $('prioritySelect').value = 'medium';
    $('categorySelect').value = 'none';
    $('advancedPanel').classList.remove('visible');
    $('toggleAdvancedBtn').classList.remove('open');

    // Send to Discord if configured
    if (appData.settings.discordWebhook) {
      window.api.sendDiscordWebhook({
        webhookUrl: appData.settings.discordWebhook,
        content: `New reminder: **${text}**` + (reminder.dueDate ? ` (Due: ${reminder.dueDate})` : '')
      });
    }

    renderTasks();
    scheduleSave();
  }

  function toggleReminder(id) {
    const r = appData.reminders.find(x => x.id === id);
    if (!r) return;
    r.completed = !r.completed;

    if (r.completed) {
      const xpGain = r.priority === 'high' ? XP_HIGH_PRIORITY : XP_TASK_COMPLETE;
      gainXP(xpGain);
      appData.stats.totalCompleted = (appData.stats.totalCompleted || 0) + 1;

      const today = todayStr();
      appData.stats.dailyCompletions[today] = (appData.stats.dailyCompletions[today] || 0) + 1;
    }

    renderTasks();
    renderXpBar();
    scheduleSave();
  }

  function deleteReminder(id) {
    appData.reminders = appData.reminders.filter(x => x.id !== id);
    renderTasks();
    scheduleSave();
  }

  $('clearDoneBtn').addEventListener('click', () => {
    appData.reminders = appData.reminders.filter(x => !x.completed);
    renderTasks();
    scheduleSave();
  });

  // ─── XP & Gamification ─────────────────────────────────────────
  function gainXP(amount) {
    const oldLevel = Math.floor(appData.stats.xp / XP_PER_LEVEL) + 1;
    appData.stats.xp = (appData.stats.xp || 0) + amount;
    const newLevel = Math.floor(appData.stats.xp / XP_PER_LEVEL) + 1;
    appData.stats.level = newLevel;

    if (newLevel > oldLevel) showLevelUp(newLevel);
    renderXpBar();
  }

  function renderXpBar() {
    const xp = appData.stats.xp || 0;
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const xpInLevel = xp % XP_PER_LEVEL;
    const pct = (xpInLevel / XP_PER_LEVEL) * 100;

    $('levelBadge').textContent = `Lv ${level}`;
    $('xpText').textContent = `${xpInLevel} / ${XP_PER_LEVEL} XP`;
    $('xpFill').style.width = pct + '%';

    const streak = appData.stats.streak || 0;
    $('streakBadge').textContent = streak > 0 ? `${streak} day streak` : '';
  }

  function showLevelUp(level) {
    if (appData.settings.soundEnabled !== false) playSound();
    window.api.showNotification({ title: 'Level Up!', body: `You reached Level ${level}!` });

    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = `<div class="levelup-card"><h2>Level ${level}</h2><p>Keep going — you are on fire.</p></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
    setTimeout(() => overlay.remove(), 3000);
  }

  function updateStreak() {
    const today = todayStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const last = appData.stats.lastActiveDate;

    if (last === today) return; // already counted today

    if (last === yesterday) {
      appData.stats.streak = (appData.stats.streak || 0) + 1;
      gainXP(XP_STREAK_BONUS * appData.stats.streak);
    } else if (last !== today) {
      appData.stats.streak = 1; // reset
    }

    appData.stats.lastActiveDate = today;
    scheduleSave();
  }

  // ─── Notifications ──────────────────────────────────────────────
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
        // Check for missed reminders
        if (r.dueDate < today || (r.dueDate === today && r.dueTime < timeStr && !r.notified)) {
          appData.stats.missedReminders = (appData.stats.missedReminders || 0) + 1;
          r.notified = true;
          triggered = true;
        }
      }
    });

    if (triggered) {
      if (appData.settings.soundEnabled !== false) playSound();
      scheduleSave();
      renderTasks();
    }
  }

  function playSound() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch (e) { /* silent fail */ }
  }

  // ─── Render Tasks ───────────────────────────────────────────────
  function renderTasks() {
    // Clear existing
    listEl.querySelectorAll('.reminder-item, .group-header').forEach(el => el.remove());

    let filtered = appData.reminders;
    if (searchQuery) filtered = filtered.filter(r => r.text.toLowerCase().includes(searchQuery));

    const today = todayStr();
    if (currentFilter === 'today') filtered = filtered.filter(r => r.dueDate === today);
    else if (currentFilter === 'high') filtered = filtered.filter(r => r.priority === 'high');
    else if (currentFilter === 'urgent') filtered = filtered.filter(r => r.dueDate && r.dueDate <= today && !r.completed);

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');

      // Smart sort: Urgent first, then Today, then Later, then Completed
      const groups = { urgent: [], today: [], later: [], done: [] };
      filtered.forEach(r => {
        if (r.completed) groups.done.push(r);
        else if (r.dueDate && r.dueDate < today) groups.urgent.push(r);
        else if (r.dueDate === today) groups.today.push(r);
        else groups.later.push(r);
      });

      // Sort within groups by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const sortByPriority = (a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
      Object.values(groups).forEach(g => g.sort(sortByPriority));

      const renderGroup = (label, items) => {
        if (items.length === 0) return;
        const header = document.createElement('div');
        header.className = 'group-header';
        header.textContent = label;
        listEl.insertBefore(header, emptyState);
        items.forEach(r => listEl.insertBefore(createItem(r), emptyState));
      };

      renderGroup('Overdue', groups.urgent);
      renderGroup('Today', groups.today);
      renderGroup('Upcoming', groups.later);
      if (groups.done.length) renderGroup('Completed', groups.done);
    }

    const total = appData.reminders.length;
    const done = appData.reminders.filter(r => r.completed).length;
    statsText.textContent = total === 0 ? '0 tasks' : `${done}/${total} done`;
  }

  function createItem(r) {
    const el = document.createElement('div');
    let classes = 'reminder-item';
    if (r.completed) classes += ' completed';
    if (r.priority === 'high' && !r.completed) classes += ' priority-high';
    if (r.priority === 'low' && !r.completed) classes += ' priority-low';
    el.className = classes;

    let tags = '';
    if (r.dueDate) {
      const isToday = r.dueDate === todayStr();
      const overdue = r.dueDate < todayStr() && !r.completed;
      const label = overdue ? 'Overdue' : isToday ? 'Today' : r.dueDate;
      const time = r.dueTime ? ' ' + r.dueTime : '';
      tags += `<span class="meta-tag ${overdue ? 'due-soon' : ''}">${label}${time}</span>`;
    }
    if (r.priority && r.priority !== 'medium') {
      tags += `<span class="meta-tag priority-tag ${r.priority}">${r.priority === 'high' ? 'High' : 'Low'}</span>`;
    }
    if (r.category) {
      tags += `<span class="meta-tag">${r.category.charAt(0).toUpperCase() + r.category.slice(1)}</span>`;
    }

    el.innerHTML = `
      <label class="reminder-checkbox"><input type="checkbox" ${r.completed ? 'checked' : ''} />
        <div class="checkbox-visual"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </label>
      <div class="reminder-content">
        <div class="reminder-text">${esc(r.text)}</div>
        ${tags ? `<div class="meta-tags">${tags}</div>` : ''}
      </div>
      <button class="delete-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    `;

    el.querySelector('input').addEventListener('change', () => toggleReminder(r.id));
    el.querySelector('.delete-btn').addEventListener('click', () => deleteReminder(r.id));
    return el;
  }

  // ─── Stats Dashboard ───────────────────────────────────────────
  function renderStats() {
    const s = appData.stats;
    const xp = s.xp || 0;
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const xpInLevel = xp % XP_PER_LEVEL;

    $('statLevel').textContent = level;
    $('statXpFill').style.width = ((xpInLevel / XP_PER_LEVEL) * 100) + '%';
    $('statXpSub').textContent = `${xpInLevel} / ${XP_PER_LEVEL} XP (${xp} total)`;
    $('statStreak').textContent = s.streak || 0;
    $('statTotalCompleted').textContent = s.totalCompleted || 0;
    $('statMissed').textContent = s.missedReminders || 0;

    const today = todayStr();
    $('statTodayCount').textContent = (s.dailyCompletions && s.dailyCompletions[today]) || 0;

    // Weekly bar chart
    const chart = $('barChart');
    chart.innerHTML = '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const dayOfWeek = now.getDay();
    let maxVal = 1;
    const weekData = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const val = (s.dailyCompletions && s.dailyCompletions[key]) || 0;
      weekData.push({ label: dayNames[d.getDay()], val, isToday: i === 0 });
      if (val > maxVal) maxVal = val;
    }

    weekData.forEach(d => {
      const col = document.createElement('div');
      col.className = 'bar-col';
      const h = Math.max(2, (d.val / maxVal) * 60);
      col.innerHTML = `<div class="bar-fill" style="height:${h}px;${d.isToday ? 'opacity:1' : 'opacity:0.6'}"></div><span class="bar-label">${d.label}</span>`;
      chart.appendChild(col);
    });

    // Motivational message
    const todayCount = (s.dailyCompletions && s.dailyCompletions[today]) || 0;
    const messages = [
      todayCount === 0 ? 'Start your day strong — complete a task.' :
      todayCount < 3 ? `You completed ${todayCount} task${todayCount > 1 ? 's' : ''} today. Keep it up.` :
      todayCount < 6 ? `${todayCount} tasks done today — you are on a roll.` :
      `${todayCount} tasks crushed today. Incredible work.`
    ];
    $('motivationalMsg').textContent = messages[0];
  }

  // ─── Pomodoro Timer ─────────────────────────────────────────────
  const CIRCUMFERENCE = 2 * Math.PI * 90; // 565.48

  document.querySelectorAll('.timer-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timer-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      resetTimer(parseInt(btn.dataset.minutes));
    });
  });

  $('timerStartBtn').addEventListener('click', () => {
    if (timerRunning) pauseTimer();
    else startTimer();
  });

  $('timerResetBtn').addEventListener('click', () => {
    const active = document.querySelector('.timer-mode.active');
    resetTimer(parseInt(active.dataset.minutes));
  });

  function startTimer() {
    timerRunning = true;
    $('timerStartBtn').textContent = 'Pause';
    timerInterval = setInterval(() => {
      timerSeconds--;
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        $('timerStartBtn').textContent = 'Start';
        pomodoroSessions++;
        $('timerSessions').textContent = `${pomodoroSessions} session${pomodoroSessions > 1 ? 's' : ''} completed`;
        gainXP(15); // XP for completing a focus session
        if (appData.settings.soundEnabled !== false) playSound();
        window.api.showNotification({ title: 'Timer Done', body: 'Take a break or start another session.' });
        scheduleSave();
      }
      updateTimerDisplay();
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    $('timerStartBtn').textContent = 'Start';
  }

  function resetTimer(minutes) {
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = minutes * 60;
    timerTotal = minutes * 60;
    $('timerStartBtn').textContent = 'Start';
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    $('timerTime').textContent = `${m}:${s}`;
    const pct = timerSeconds / timerTotal;
    $('timerRingFill').style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
  }

  updateTimerDisplay();

  // ─── Settings ───────────────────────────────────────────────────
  function loadSettingsUI() {
    $('weatherCityInput').value = appData.settings.weatherCity || '';
    $('discordWebhookInput').value = appData.settings.discordWebhook || '';

    const theme = appData.settings.theme || 'dark';
    $('themeDarkBtn').classList.toggle('active', theme === 'dark');
    $('themeLightBtn').classList.toggle('active', theme === 'light');

    applySoundToggle(appData.settings.soundEnabled !== false);
  }

  $('themeDarkBtn').addEventListener('click', () => setTheme('dark'));
  $('themeLightBtn').addEventListener('click', () => setTheme('light'));

  function setTheme(t) {
    appData.settings.theme = t;
    applyTheme(t);
    $('themeDarkBtn').classList.toggle('active', t === 'dark');
    $('themeLightBtn').classList.toggle('active', t === 'light');
    scheduleSave();
  }

  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }

  $('soundToggle').addEventListener('click', () => {
    const on = !appData.settings.soundEnabled;
    appData.settings.soundEnabled = on;
    applySoundToggle(on);
    scheduleSave();
  });

  function applySoundToggle(on) {
    appData.settings.soundEnabled = on;
    $('soundToggle').classList.toggle('on', on);
  }

  $('saveWeatherBtn').addEventListener('click', () => {
    appData.settings.weatherCity = $('weatherCityInput').value.trim();
    loadWeather();
    scheduleSave();
  });

  $('saveWebhookBtn').addEventListener('click', () => {
    appData.settings.discordWebhook = $('discordWebhookInput').value.trim();
    scheduleSave();
  });

  $('testWebhookBtn').addEventListener('click', async () => {
    const url = $('discordWebhookInput').value.trim();
    if (!url) return;
    const ok = await window.api.sendDiscordWebhook({ webhookUrl: url, content: 'Reminder Widget connected successfully.' });
    $('testWebhookBtn').textContent = ok ? 'Sent' : 'Failed';
    setTimeout(() => { $('testWebhookBtn').textContent = 'Test'; }, 2000);
  });

  $('exportBtn').addEventListener('click', () => window.api.exportBackup());

  // ─── Weather ────────────────────────────────────────────────────
  async function loadWeather() {
    const city = appData.settings.weatherCity;
    if (!city) { $('weatherBadge').textContent = ''; return; }
    const w = await window.api.fetchWeather(city);
    if (w) {
      $('weatherBadge').textContent = `${w.temp}°F · ${w.desc}`;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────
  function todayStr() { return new Date().toISOString().split('T')[0]; }
  function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => window.api.saveData(appData), 300);
  }
})();
