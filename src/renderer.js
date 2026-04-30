// ═══════════════════════════════════════════════════════════════════
// Smart Reminder Widget — Renderer Process
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────
  let reminders = [];
  let saveTimeout = null;
  let currentFilter = 'all';
  let searchQuery = '';
  
  // Settings from localStorage
  let isSoundEnabled = localStorage.getItem('soundEnabled') !== 'false';
  let isDarkMode = localStorage.getItem('theme') !== 'light';

  // ─── DOM References ─────────────────────────────────────────────
  const input = document.getElementById('reminderInput');
  const listEl = document.getElementById('reminderList');
  const emptyState = document.getElementById('emptyState');
  const statsText = document.getElementById('statsText');
  
  const searchInput = document.getElementById('searchInput');
  const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
  const advancedPanel = document.getElementById('advancedPanel');
  
  const dateInput = document.getElementById('dateInput');
  const timeInput = document.getElementById('timeInput');
  const prioritySelect = document.getElementById('prioritySelect');
  const categorySelect = document.getElementById('categorySelect');
  
  const themeBtn = document.getElementById('themeBtn');
  const soundBtn = document.getElementById('soundBtn');
  const backupBtn = document.getElementById('backupBtn');
  const filterTabs = document.querySelectorAll('.filter-tab');

  // ─── Initialize ─────────────────────────────────────────────────
  async function init() {
    reminders = await window.api.loadReminders();
    
    // Set theme
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    updateSoundIcon();
    
    render();
    input.focus();

    // Default pin status
    document.getElementById('pinBtn').classList.add('active');

    // Start background notification checker
    setInterval(checkNotifications, 60000); // check every minute
    setTimeout(checkNotifications, 2000); // check on startup
  }

  document.addEventListener('DOMContentLoaded', init);

  // ─── Top Bar & Theme Actions ────────────────────────────────────
  themeBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  });

  soundBtn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('soundEnabled', isSoundEnabled);
    updateSoundIcon();
    if (isSoundEnabled) playSound(); // Preview sound
  });

  function updateSoundIcon() {
    soundBtn.innerHTML = isSoundEnabled ? 
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' : 
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    soundBtn.classList.toggle('muted', !isSoundEnabled);
  }

  backupBtn.addEventListener('click', async () => {
    await window.api.exportBackup();
  });

  // ─── Search & Filters ───────────────────────────────────────────
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    render();
  });

  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      filterTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      render();
    });
  });

  // ─── Add Form Actions ───────────────────────────────────────────
  toggleAdvancedBtn.addEventListener('click', () => {
    advancedPanel.classList.toggle('visible');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addReminder();
    }
  });

  // ─── CRUD Operations ───────────────────────────────────────────
  function addReminder() {
    const text = input.value.trim();
    if (!text) return;

    const reminder = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      text: text,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: dateInput.value || null,
      dueTime: timeInput.value || null,
      priority: prioritySelect.value,
      category: categorySelect.value !== 'none' ? categorySelect.value : null,
      notified: false
    };

    reminders.unshift(reminder);
    
    // Reset inputs
    input.value = '';
    dateInput.value = '';
    timeInput.value = '';
    prioritySelect.value = 'medium';
    categorySelect.value = 'none';
    advancedPanel.classList.remove('visible');

    render();
    scheduleSave();
  }

  function toggleReminder(id) {
    const reminder = reminders.find((r) => r.id === id);
    if (reminder) {
      reminder.completed = !reminder.completed;
      render();
      scheduleSave();
    }
  }

  function deleteReminder(id) {
    reminders = reminders.filter((r) => r.id !== id);
    render();
    scheduleSave();
  }

  document.getElementById('clearDoneBtn').addEventListener('click', () => {
    reminders = reminders.filter((r) => !r.completed);
    render();
    scheduleSave();
  });

  // ─── Notification System ────────────────────────────────────────
  function checkNotifications() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    let triggered = false;

    reminders.forEach(r => {
      if (!r.completed && !r.notified && r.dueDate === todayStr && r.dueTime === timeStr) {
        window.api.showNotification({
          title: r.category ? `${r.category.toUpperCase()} Reminder` : 'Reminder Due!',
          body: r.text
        });
        r.notified = true;
        triggered = true;
      }
    });

    if (triggered) {
      if (isSoundEnabled) playSound();
      scheduleSave();
      render();
    }
  }

  function playSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  // ─── Window Controls ────────────────────────────────────────────
  document.getElementById('minimizeBtn').addEventListener('click', () => window.api.minimizeWindow());
  document.getElementById('closeBtn').addEventListener('click', () => window.api.closeWindow());
  document.getElementById('pinBtn').addEventListener('click', async (e) => {
    const isOnTop = await window.api.toggleAlwaysOnTop();
    e.currentTarget.classList.toggle('active', isOnTop);
  });

  window.api.onFocusInput(() => {
    input.focus();
  });

  // ─── Render ─────────────────────────────────────────────────────
  function render() {
    listEl.innerHTML = '';
    let filtered = reminders;

    // Apply Search
    if (searchQuery) {
      filtered = filtered.filter(r => r.text.toLowerCase().includes(searchQuery));
    }

    // Apply Tab Filters
    const todayStr = new Date().toISOString().split('T')[0];
    if (currentFilter === 'today') {
      filtered = filtered.filter(r => r.dueDate === todayStr);
    } else if (currentFilter === 'high') {
      filtered = filtered.filter(r => r.priority === 'high');
    } else if (currentFilter === 'work') {
      filtered = filtered.filter(r => r.category === 'work');
    }

    if (filtered.length === 0) {
      listEl.appendChild(emptyState);
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach((r) => listEl.appendChild(createReminderElement(r)));
    }

    // Update Stats
    const total = reminders.length;
    const done = reminders.filter(r => r.completed).length;
    statsText.textContent = total === 0 ? '0 reminders' : `${done}/${total} completed`;
  }

  function createReminderElement(reminder) {
    const item = document.createElement('div');
    item.className = `reminder-item ${reminder.completed ? 'completed' : ''}`;
    
    let tagsHTML = '';
    
    if (reminder.dueDate) {
      const isToday = reminder.dueDate === new Date().toISOString().split('T')[0];
      const dateText = isToday ? 'Today' : reminder.dueDate;
      const timeText = reminder.dueTime ? ` @ ${reminder.dueTime}` : '';
      tagsHTML += `<span class="meta-tag ${isToday ? 'due-soon' : ''}">Due: ${dateText}${timeText}</span>`;
    }
    
    if (reminder.priority && reminder.priority !== 'medium') {
      const pIcons = { high: 'High', low: 'Low' };
      tagsHTML += `<span class="meta-tag priority-tag ${reminder.priority}">${pIcons[reminder.priority]}</span>`;
    }
    
    if (reminder.category) {
      tagsHTML += `<span class="meta-tag">${reminder.category.charAt(0).toUpperCase() + reminder.category.slice(1)}</span>`;
    }

    item.innerHTML = `
      <label class="reminder-checkbox">
        <input type="checkbox" ${reminder.completed ? 'checked' : ''} />
        <div class="checkbox-visual">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </label>
      <div class="reminder-content">
        <div class="reminder-text">${escapeHtml(reminder.text)}</div>
        ${tagsHTML ? `<div class="meta-tags">${tagsHTML}</div>` : ''}
      </div>
      <button class="delete-btn" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    item.querySelector('input[type="checkbox"]').addEventListener('change', () => toggleReminder(reminder.id));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteReminder(reminder.id));

    return item;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      window.api.saveReminders(reminders);
    }, 300);
  }
})();
