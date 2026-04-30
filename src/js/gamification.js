// gamification.js
import { appData, scheduleSave, todayStr } from './state.js';
import { playSound } from './audio.js';
import { renderXpBar } from './ui.js';

const XP_PER_LEVEL = 100;
export const XP_EASY = 5;
export const XP_MEDIUM = 10;
export const XP_HARD = 20;

export const XP_EARLY_BONUS = 5;
export const XP_LATE_BONUS = 2;
const XP_STREAK_3 = 15;
const XP_STREAK_7 = 50;
export const XP_COMBO_BONUS = 15;
export const COMBO_TIME_WINDOW = 10 * 60 * 1000; // 10 minutes

export function gainXP(amount) {
  const oldLevel = Math.floor((appData.stats.xp || 0) / XP_PER_LEVEL) + 1;
  appData.stats.xp = (appData.stats.xp || 0) + amount;
  const newLevel = Math.floor(appData.stats.xp / XP_PER_LEVEL) + 1;
  appData.stats.level = newLevel;

  if (newLevel > oldLevel) showLevelUp(newLevel);
  renderXpBar();
  applyFeatureLocks();
}

export function updateStreak() {
  const today = todayStr();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  
  const last = appData.stats.lastActiveDate;

  if (last === today) return;

  if (last === yesterday) {
    appData.stats.streak = (appData.stats.streak || 0) + 1;
    
    // Streak Milestones
    if (appData.stats.streak === 3) gainXP(XP_STREAK_3);
    if (appData.stats.streak === 7) gainXP(XP_STREAK_7);

  } else if (last !== today) {
    appData.stats.streak = 1;
  }

  appData.stats.lastActiveDate = today;
  scheduleSave();
}

export function applyFeatureLocks() {
  const level = appData.stats.level || 1;
  const themeCont = document.getElementById('themeContainer');
  const soundCont = document.getElementById('soundContainer');
  const statsCont = document.getElementById('advancedStatsContainer');

  if (themeCont) themeCont.classList.toggle('is-locked', level < 3);
  if (soundCont) soundCont.classList.toggle('is-locked', level < 5);
  if (statsCont) statsCont.classList.toggle('is-locked', level < 10);
}

function showLevelUp(level) {
  playSound(appData.settings);
  window.api.showNotification({ title: 'Level Up!', body: `You reached Level ${level}!` });

  let msg = 'Keep going — you are on fire.';
  if (level === 3) msg = 'Themes unlocked! Check settings.';
  if (level === 5) msg = 'Sound Effects unlocked! Check settings.';
  if (level === 10) msg = 'Advanced Stats unlocked!';

  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';
  overlay.innerHTML = `<div class="levelup-card"><h2>Level ${level}</h2><p>${msg}</p></div>`;
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', () => overlay.remove());
  setTimeout(() => { if(document.body.contains(overlay)) overlay.remove(); }, 4000);
}
