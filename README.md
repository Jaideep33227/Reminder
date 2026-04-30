# Reminder Widget

A productivity-focused, always-on-top desktop widget for Windows. Built with Electron.

Tracks tasks, schedules reminders with native notifications, gamifies productivity with XP and levels, and includes a built-in Pomodoro focus timer.

## Features

### Task Management
- **Always-On-Top Widget** — Frameless window docked to the bottom-right corner of the screen.
- **Quick Add** — Type a task and press Enter. Optionally set a due date, time, priority, and category.
- **Smart Auto-Sorting** — Tasks are automatically grouped into Overdue, Today, Upcoming, and Completed sections, sorted by priority within each group.
- **Search & Filter** — Instant search across all tasks. Filter tabs for All, Urgent, Today, and High Priority.
- **Persistent Storage** — All data is saved locally to JSON and survives app restarts.

### Notifications
- **Time-Based Reminders** — Set a date and time on any task. The app checks every minute and fires a native Windows notification when a task is due.
- **Sound Alerts** — Toggleable notification sound using the Web Audio API.
- **Missed Reminder Tracking** — Overdue tasks that were never acknowledged are counted in your stats.

### Gamification
- **XP System** — Earn XP for completing tasks (+10 standard, +20 for high priority, +15 for Pomodoro sessions).
- **Leveling** — Every 100 XP earns a new level, with a full-screen level-up animation.
- **Daily Streak** — Consecutive active days are tracked. Streak bonuses award extra XP.
- **Stats Dashboard** — View your level, total XP, streak count, tasks completed today, total completed, missed reminders, and a weekly bar chart.

### Focus Timer (Pomodoro)
- **Focus / Short Break / Long Break** modes (25 / 5 / 15 minutes).
- **Animated Ring** — SVG circular progress indicator.
- **Session Counter** — Tracks how many focus sessions you have completed.
- **XP Reward** — Completing a focus session grants 15 XP.

### Integrations
- **Weather** — Set your city in Settings to display current weather conditions in the title bar (powered by wttr.in, no API key needed).
- **Discord Webhook** — Paste a Discord webhook URL in Settings. New tasks are automatically posted to your channel. Includes a Test button.
- **Export Backup** — Save a full JSON backup of your data via native file dialog.

### UI / UX
- **Dark and Light Mode** — Toggle between themes in Settings. Preference is saved.
- **Custom Title Bar** — Draggable, with pin/minimize/close controls.
- **Bottom Navigation** — Four tabs: Tasks, Stats, Timer, Settings.
- **System Tray** — Close or minimize hides to the system tray. Click the tray icon to restore.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (LTS recommended)

### Setup

```bash
git clone https://github.com/Jaideep33227/reminder-widget.git
cd reminder-widget
npm install
```

## Usage

### Development

```bash
npm start
```

### Build for Windows

```bash
npm run build
```

Output is written to the `dist/` directory:
- `Reminder Widget Setup X.X.X.exe` — NSIS installer
- `Reminder Widget X.X.X.exe` — Portable executable

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+R` | Show widget and focus input (global) |
| `Enter` | Save task |

## Project Structure

```
reminder-widget/
├── assets/
│   └── icon.png
├── src/
│   ├── index.html
│   ├── styles.css
│   └── renderer.js
├── main.js
├── preload.js
├── package.json
├── .gitignore
└── README.md
```

## Data Storage

All application data (reminders, XP, settings) is stored at:
```
%APPDATA%/reminder-widget/data/appdata.json
```

## License

MIT
