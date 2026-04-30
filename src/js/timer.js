// timer.js
import { appData, scheduleSave } from './state.js';
import { gainXP } from './gamification.js';
import { playSound } from './audio.js';

let timerInterval = null;
let timerSeconds = 25 * 60;
let timerTotal = 25 * 60;
let timerRunning = false;
let pomodoroSessions = 0;

const CIRCUMFERENCE = 2 * Math.PI * 90;

export function initTimer() {
  document.querySelectorAll('.timer-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timer-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      resetTimer(parseInt(btn.dataset.minutes));
    });
  });

  document.getElementById('timerStartBtn').addEventListener('click', () => {
    if (timerRunning) pauseTimer();
    else startTimer();
  });

  document.getElementById('timerResetBtn').addEventListener('click', () => {
    const active = document.querySelector('.timer-mode.active');
    resetTimer(parseInt(active.dataset.minutes));
  });

  updateTimerDisplay();
}

function startTimer() {
  timerRunning = true;
  document.getElementById('timerStartBtn').textContent = 'Pause';
  timerInterval = setInterval(() => {
    timerSeconds--;
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById('timerStartBtn').textContent = 'Start';
      pomodoroSessions++;
      document.getElementById('timerSessions').textContent = `${pomodoroSessions} session${pomodoroSessions > 1 ? 's' : ''} completed`;
      gainXP(15);
      playSound(appData.settings);
      window.api.showNotification({ title: 'Timer Done', body: 'Take a break or start another session.' });
      scheduleSave();
    }
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timerStartBtn').textContent = 'Start';
}

function resetTimer(minutes) {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = minutes * 60;
  timerTotal = minutes * 60;
  document.getElementById('timerStartBtn').textContent = 'Start';
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timerTime').textContent = `${m}:${s}`;
  const pct = timerSeconds / timerTotal;
  document.getElementById('timerRingFill').style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
}
