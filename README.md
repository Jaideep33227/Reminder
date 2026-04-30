# Reminder Widget

A lightweight, always-on-top desktop reminder assistant for Windows. Built with Electron.

## Features

- **Always-On-Top** — Floating widget docked to the bottom-right corner.
- **Smart Time-Based Reminders** — Background checks and native Windows notifications for scheduled tasks.
- **Quick Add** — Type and press Enter to instantly add reminders, with advanced options for due dates and times.
- **Organization** — Supports priority levels (High, Medium, Low) and categories (Work, Personal, School).
- **Search & Filters** — Instantly filter your tasks by search query or category tabs.
- **Persistent Storage** — Reminders are saved to a local JSON file to survive restarts.
- **System Tray Integration** — Minimize/close the app to hide it to the system tray. Right-click the tray icon for options.
- **Light & Dark Mode** — Clean UI that supports toggling between light and dark themes.
- **Export & Backup** — Native backup feature to export your data.
- **Keyboard Shortcuts** — Global shortcuts to quickly bring up the widget and add tasks.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended, v18+)
- npm (comes with Node.js)

### Setup

```bash
# Clone the repository
git clone https://github.com/Jaideep33227/reminder-widget.git
cd reminder-widget

# Install dependencies
npm install
```

## Usage

### Run in Development

```bash
npm start
```

The widget will launch and appear in the bottom-right corner of your primary display.

### Build for Windows (.exe)

```bash
npm run build
```

The installer and portable `.exe` will be generated in the `dist/` directory:
- `dist/Reminder Widget Setup X.X.X.exe` — NSIS installer
- `dist/Reminder Widget X.X.X.exe` — Portable executable

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+R` | Show widget and focus input (global) |
| `Ctrl+N` | Focus input field (in-app) |
| `Enter` | Save reminder |
| `Escape` | Cancel editing / Close advanced panel |

## Project Structure

```
reminder-widget/
├── assets/
│   └── icon.png          # App icon
├── src/
│   ├── index.html        # UI layout
│   ├── styles.css        # Stylesheet (Light/Dark themes)
│   └── renderer.js       # Frontend application logic
├── main.js               # Electron main process and IPC handlers
├── preload.js            # Secure IPC context bridge
├── package.json          # Configuration and dependencies
├── .gitignore            # Git ignore rules
└── README.md             # Project documentation
```

## Configuration

Application data is stored locally in the standard Windows AppData directory:
```
%APPDATA%/reminder-widget/data/reminders.json
```

## License

MIT © Jaideep33227
