// ui.js
import { appData, todayStr } from './state.js';
import { XP_PER_LEVEL } from './gamification.js';

let currentFilter = 'all';
let searchQuery = '';

export function esc(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

export function bindSearchAndFilters(renderTasksFn) {
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderTasksFn();
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.id === 'focusModeBtn') return;
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderTasksFn();
    });
  });
}

function getCountdownText(dueDate, dueTime) {
  if (!dueDate || !dueTime) return null;
  const now = new Date();
  const target = new Date(`${dueDate}T${dueTime}`);
  const diffMs = target - now;
  if (diffMs <= 0) return null;
  
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  return null;
}

export function updateCountdowns() {
  document.querySelectorAll('.countdown-tag').forEach(tag => {
    const dueDate = tag.dataset.date;
    const dueTime = tag.dataset.time;
    if (dueDate && dueTime) {
      const text = getCountdownText(dueDate, dueTime);
      if (text) {
        tag.innerHTML = `⏱️ ${text}`;
      } else {
        // Time expired, might need a full re-render to remove it from 'upcoming',
        // but for now just clear the tag.
        tag.style.display = 'none';
      }
    }
  });
}

export function renderTasks(toggleReminderFn, deleteReminderFn) {
  const listEl = document.getElementById('reminderList');
  const emptyState = document.getElementById('emptyState');
  const statsText = document.getElementById('statsText');
  
  // Remove existing items, keeping the empty state
  listEl.querySelectorAll('.reminder-item, .group-header').forEach(el => el.remove());

  let filtered = appData.reminders;
  if (searchQuery) filtered = filtered.filter(r => r.text.toLowerCase().includes(searchQuery));

  const today = todayStr();
  if (currentFilter === 'today') filtered = filtered.filter(r => r.dueDate === today);
  else if (currentFilter === 'high') filtered = filtered.filter(r => r.priority === 'high');
  else if (currentFilter === 'urgent') filtered = filtered.filter(r => r.dueDate && r.dueDate <= today && !r.completed);

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    if (searchQuery) {
      emptyState.innerHTML = '<div style="font-size:32px;margin-bottom:12px;">🔍</div><div>No results found</div>';
    } else {
      emptyState.innerHTML = '<div style="font-size:32px;margin-bottom:12px;">📭</div><div>No tasks here</div>';
    }
  } else {
    emptyState.classList.add('hidden');

    const groups = { urgent: [], today: [], later: [], done: [] };
    filtered.forEach(r => {
      if (r.completed) groups.done.push(r);
      else if (r.dueDate && r.dueDate < today) groups.urgent.push(r);
      else if (r.dueDate === today) groups.today.push(r);
      else groups.later.push(r);
    });

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortByPriority = (a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    Object.values(groups).forEach(g => g.sort(sortByPriority));

    const fragment = document.createDocumentFragment();

    const renderGroup = (label, items) => {
      if (items.length === 0) return;
      const header = document.createElement('div');
      header.className = 'group-header';
      header.textContent = label;
      fragment.appendChild(header);
      
      items.forEach(r => {
        const item = createItem(r, toggleReminderFn, deleteReminderFn);
        fragment.appendChild(item);
      });
    };

    renderGroup('Overdue', groups.urgent);
    renderGroup('Today', groups.today);
    renderGroup('Upcoming', groups.later);
    if (groups.done.length) renderGroup('Completed', groups.done);

    listEl.insertBefore(fragment, emptyState);
  }

  const total = appData.reminders.length;
  const done = appData.reminders.filter(r => r.completed).length;
  statsText.textContent = total === 0 ? '0 tasks' : `${done}/${total} done`;
}

function createItem(r, toggleReminderFn, deleteReminderFn) {
  const el = document.createElement('div');
  let classes = 'reminder-item';
  if (r.completed) classes += ' completed';
  if (r.priority === 'high' && !r.completed) classes += ' priority-high';
  if (r.priority === 'low' && !r.completed) classes += ' priority-low';
  el.className = classes;

  let tags = '';
  
  // Live Countdown
  let countdownStr = null;
  if (!r.completed) {
    countdownStr = getCountdownText(r.dueDate, r.dueTime);
  }

  if (countdownStr) {
    tags += `<span class="meta-tag countdown-tag" data-date="${r.dueDate}" data-time="${r.dueTime}">⏱️ ${countdownStr}</span>`;
  } else if (r.dueDate) {
    const isToday = r.dueDate === todayStr();
    const overdue = r.dueDate < todayStr() && !r.completed;
    const label = overdue ? 'Overdue' : isToday ? 'Today' : r.dueDate;
    const time = r.dueTime ? ' ' + r.dueTime : '';
    tags += `<span class="meta-tag ${overdue ? 'due-soon' : ''}">${label}${time}</span>`;
  }
  
  if (r.priority && r.priority !== 'medium') {
    tags += `<span class="meta-tag priority-tag ${r.priority}">${r.priority === 'high' ? 'Hard' : 'Easy'}</span>`;
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

  el.querySelector('input').addEventListener('change', () => toggleReminderFn(r.id));
  el.querySelector('.delete-btn').addEventListener('click', () => deleteReminderFn(r.id));
  return el;
}

export function renderXpBar() {
  const xp = appData.stats.xp || 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;
  const pct = (xpInLevel / XP_PER_LEVEL) * 100;

  document.getElementById('levelBadge').textContent = `Lv ${level}`;
  document.getElementById('xpText').textContent = `${xpInLevel} / ${XP_PER_LEVEL} XP`;
  document.getElementById('xpFill').style.width = pct + '%';

  const streak = appData.stats.streak || 0;
  document.getElementById('streakBadge').textContent = streak > 0 ? `${streak} day streak` : '';
}

export function renderStats() {
  const s = appData.stats;
  const xp = s.xp || 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;

  document.getElementById('statLevel').textContent = level;
  document.getElementById('statXpFill').style.width = ((xpInLevel / XP_PER_LEVEL) * 100) + '%';
  document.getElementById('statXpSub').textContent = `${xpInLevel} / ${XP_PER_LEVEL} XP (${xp} total)`;
  document.getElementById('statStreak').textContent = s.streak || 0;
  document.getElementById('statTotalCompleted').textContent = s.totalCompleted || 0;
  document.getElementById('statMissed').textContent = s.missedReminders || 0;

  const today = todayStr();
  document.getElementById('statTodayCount').textContent = (s.dailyCompletions && s.dailyCompletions[today]) || 0;

  const chart = document.getElementById('barChart');
  chart.innerHTML = '';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  let maxVal = 1;
  const weekData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
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

  const todayCount = (s.dailyCompletions && s.dailyCompletions[today]) || 0;
  const messages = [
    todayCount === 0 ? 'Start your day strong — complete a task.' :
    todayCount < 3 ? `You completed ${todayCount} task${todayCount > 1 ? 's' : ''} today. Keep it up.` :
    todayCount < 6 ? `${todayCount} tasks done today — you are on a roll.` :
    `${todayCount} tasks crushed today. Incredible work.`
  ];
  document.getElementById('motivationalMsg').textContent = messages[0];
}
