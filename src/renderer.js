// ═══════════════════════════════════════════════════════════════════
// Reminder Widget — Renderer Process
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────
  let reminders = [];
  let saveTimeout = null;

  // ─── DOM References ─────────────────────────────────────────────
  const input = document.getElementById('reminderInput');
  const listEl = document.getElementById('reminderList');
  const emptyState = document.getElementById('emptyState');
  const statsText = document.getElementById('statsText');
  const clearDoneBtn = document.getElementById('clearDoneBtn');
  const minimizeBtn = document.getElementById('minimizeBtn');
  const closeBtn = document.getElementById('closeBtn');
  const pinBtn = document.getElementById('pinBtn');

  // ─── Initialize ─────────────────────────────────────────────────
  async function init() {
    reminders = await window.api.loadReminders();
    render();
    input.focus();

    // Pin is active by default (always on top)
    pinBtn.classList.add('active');
  }

  document.addEventListener('DOMContentLoaded', init);

  // ─── Event Listeners ───────────────────────────────────────────
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addReminder();
    }
  });

  clearDoneBtn.addEventListener('click', clearCompleted);
  minimizeBtn.addEventListener('click', () => window.api.minimizeWindow());
  closeBtn.addEventListener('click', () => window.api.closeWindow());

  pinBtn.addEventListener('click', async () => {
    const isOnTop = await window.api.toggleAlwaysOnTop();
    pinBtn.classList.toggle('active', isOnTop);
  });

  // Listen for global shortcut focus
  window.api.onFocusInput(() => {
    input.focus();
    input.select();
  });

  // Keyboard shortcut: Ctrl+N to focus input
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  // ─── CRUD Operations ───────────────────────────────────────────
  function addReminder() {
    const text = input.value.trim();
    if (!text) return;

    const reminder = {
      id: generateId(),
      text: text,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    reminders.unshift(reminder);
    input.value = '';
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
    const itemEl = document.querySelector(`[data-id="${id}"]`);
    if (itemEl) {
      itemEl.classList.add('removing');
      setTimeout(() => {
        reminders = reminders.filter((r) => r.id !== id);
        render();
        scheduleSave();
      }, 250);
    }
  }

  function editReminder(id) {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder || reminder.completed) return;

    const itemEl = document.querySelector(`[data-id="${id}"]`);
    const textEl = itemEl.querySelector('.reminder-text');

    textEl.contentEditable = 'true';
    textEl.classList.add('editing');
    textEl.focus();

    // Place cursor at end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(textEl);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    function finishEdit() {
      textEl.contentEditable = 'false';
      textEl.classList.remove('editing');
      const newText = textEl.textContent.trim();
      if (newText && newText !== reminder.text) {
        reminder.text = newText;
        scheduleSave();
      } else {
        textEl.textContent = reminder.text;
      }
      textEl.removeEventListener('blur', finishEdit);
      textEl.removeEventListener('keydown', handleEditKey);
    }

    function handleEditKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        textEl.blur();
      }
      if (e.key === 'Escape') {
        textEl.textContent = reminder.text;
        textEl.blur();
      }
    }

    textEl.addEventListener('blur', finishEdit);
    textEl.addEventListener('keydown', handleEditKey);
  }

  function clearCompleted() {
    const completedItems = document.querySelectorAll('.reminder-item.completed');
    completedItems.forEach((el) => el.classList.add('removing'));

    setTimeout(() => {
      reminders = reminders.filter((r) => !r.completed);
      render();
      scheduleSave();
    }, 250);
  }

  // ─── Render ─────────────────────────────────────────────────────
  function render() {
    // Keep empty state
    const hasReminders = reminders.length > 0;
    emptyState.classList.toggle('hidden', hasReminders);

    // Update stats
    const total = reminders.length;
    const done = reminders.filter((r) => r.completed).length;
    if (total === 0) {
      statsText.textContent = '0 reminders';
    } else if (done > 0) {
      statsText.textContent = `${done}/${total} completed`;
    } else {
      statsText.textContent = `${total} reminder${total !== 1 ? 's' : ''}`;
    }

    // Clear existing items (but keep empty state)
    const existingItems = listEl.querySelectorAll('.reminder-item');
    existingItems.forEach((el) => el.remove());

    // Render reminders
    reminders.forEach((reminder, index) => {
      const el = createReminderElement(reminder, index);
      listEl.insertBefore(el, emptyState);
    });
  }

  function createReminderElement(reminder, index) {
    const item = document.createElement('div');
    item.className = `reminder-item${reminder.completed ? ' completed' : ''}`;
    item.dataset.id = reminder.id;
    item.style.animationDelay = `${index * 30}ms`;

    item.innerHTML = `
      <label class="reminder-checkbox">
        <input type="checkbox" ${reminder.completed ? 'checked' : ''} />
        <div class="checkbox-visual">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </label>
      <div class="reminder-content">
        <div class="reminder-text">${escapeHtml(reminder.text)}</div>
        <div class="reminder-meta">
          <span class="reminder-time">${formatTime(reminder.createdAt)}</span>
        </div>
      </div>
      <button class="delete-btn" title="Delete reminder">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Event: Toggle
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => toggleReminder(reminder.id));

    // Event: Edit (double-click)
    const textEl = item.querySelector('.reminder-text');
    textEl.addEventListener('dblclick', () => editReminder(reminder.id));

    // Event: Delete
    const deleteBtn = item.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteReminder(reminder.id);
    });

    return item;
  }

  // ─── Helpers ────────────────────────────────────────────────────
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      window.api.saveReminders(reminders);
    }, 300);
  }
})();
