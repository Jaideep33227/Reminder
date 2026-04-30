# ✨ Reminder Widget

A lightweight, always-on-top desktop reminder assistant for Windows. Built with Electron.

![Dark Mode Widget](https://img.shields.io/badge/theme-dark%20mode-6c63ff?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=for-the-badge&logo=windows)
![Electron](https://img.shields.io/badge/Electron-33+-47848F?style=for-the-badge&logo=electron)

---

## 🎯 Features

- **Always-On-Top** — Floating widget docked to the bottom-right corner
- **Quick Add** — Type and press Enter to instantly add reminders
- **Edit / Delete** — Double-click to edit, hover to reveal delete
- **Toggle Complete** — Checkbox with animated strikethrough
- **Persistent Storage** — Reminders saved to local JSON (survives restarts)
- **System Tray** — Minimize/close hides to tray, right-click for options
- **Pin/Unpin** — Toggle always-on-top from the title bar
- **Keyboard Shortcuts**:
  - `Ctrl+Shift+R` — Show widget and focus input (global)
  - `Ctrl+N` — Focus input (in-app)
  - `Enter` — Save reminder
- **Dark Mode** — Premium glassmorphism design with smooth animations
- **Draggable** — Custom title bar for repositioning

---

## 📦 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended, v18+)
- npm (comes with Node.js)

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/reminder-widget.git
cd reminder-widget

# Install dependencies
npm install
```

---

## 🚀 Usage

### Run in Development

```bash
npm start
```

The widget will appear in the bottom-right corner of your screen.

### Build for Windows (.exe)

```bash
npm run build
```

The installer and portable `.exe` will be generated in the `dist/` folder:
- `dist/Reminder Widget Setup X.X.X.exe` — NSIS installer
- `dist/Reminder Widget X.X.X.exe` — Portable executable

---

## 🗂️ Project Structure

```
reminder-widget/
├── assets/
│   └── icon.png          # App icon
├── src/
│   ├── index.html        # UI layout
│   ├── styles.css        # Dark mode stylesheet
│   └── renderer.js       # Frontend logic
├── main.js               # Electron main process
├── preload.js            # Secure IPC bridge
├── package.json          # Config & dependencies
├── .gitignore
└── README.md
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+R` | Show widget & focus input (global) |
| `Ctrl+N` | Focus input field |
| `Enter` | Add reminder |
| `Escape` | Cancel editing |
| `Double-click` | Edit a reminder |

---

## 🎨 Design

- **Color scheme**: Deep purple-blue dark mode (`#0f0f1a` → `#6c63ff` accents)
- **Typography**: Inter (Google Fonts)
- **Animations**: Slide-in/out, checkbox pop, hover glow
- **Window**: Frameless, rounded corners, glassmorphism

---

## 🔧 Configuration

Reminders are stored at:
```
%APPDATA%/reminder-widget/data/reminders.json
```

---

## 📋 GitHub Setup

```bash
# Initialize git
git init

# Add all files
git add .

# Initial commit
git commit -m "✨ Initial commit — Reminder Widget v1.0.0"

# Add your remote
git remote add origin https://github.com/YOUR_USERNAME/reminder-widget.git

# Push
git push -u origin main
```

---

## 📄 License

MIT © Jaideep
