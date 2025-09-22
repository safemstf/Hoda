# Hoda - Voice-First Browser Extension

> **Syntax Squad** - CSCE 5430 Software Engineering Project

A voice-first browser extension for Edge and Chromium that enables visually impaired and low-computer-literacy users to navigate, read, and interact with web pages using natural speech with local-first privacy and an optional cloud webLLM.

## 🎯 Project Vision

Empowering users with visual impairments and low computer literacy to browse the web independently through intuitive voice commands, maintaining privacy through local-first processing.

## 👥 Team - Syntax Squad

| Name | Role | EUID | Email |
|------|------|------|-------|
| Safe Mustafa | Scrum Master | shm0066 | safemustafa@my.unt.edu |
| Fatema Khatun | Developer | fk0174 | fatemakhatun@my.unt.edu |
| Michael Oluwole | Developer | moo0019 | michaeloluwole@my.unt.edu |
| Sai Shishir Koppula | Developer | sk4165 | SaiShishirKoppula@my.unt.edu |
| Sumanth Penna | Developer | sp3300 | Sumanthpenna@my.unt.edu |
| Syed Ali | Developer | sha0019 | SyedAli@my.unt.edu |
| Arkaan Sheikh | Developer | ms2510 | arkaansheikh@my.unt.edu |

## 👤 User Personas

### Aisha - Blind Professional (34)
- **Tech Level**: Moderate (uses screen readers)
- **Goals**: Quick navigation, email interaction, form completion
- **Pain Points**: Slow linear screen-reader navigation

### George - Low-Vision Elderly (72) 
- **Tech Level**: Low comfort with technology
- **Goals**: Read news/articles aloud, text scaling, clear confirmations
- **Pain Points**: Small text, confusing interfaces

### Nora - Caregiver/Power-User (45)
- **Tech Level**: High technical comfort
- **Goals**: Configure assistants for others, manage privacy settings
- **Pain Points**: Complex onboarding processes

## ✨ Core Features

### 🗣️ Voice Navigation
- Scroll up/down with voice commands
- List and open links by index or text
- Back/forward navigation with spoken confirmations

### 📖 Text-to-Speech
- Read page content in semantic order
- Adjustable speech rate and voice selection
- Play/pause/stop controls

### 📝 Form Interaction
- Voice-driven form filling
- Dropdown and checkbox selection
- Form validation with spoken feedback

### 🔍 Accessibility Controls
- Voice-controlled zoom (in/out/reset)
- Text scaling with layout preservation
- Clear audio confirmations and error recovery

### 🔒 Privacy-First Design
- Local-first processing
- Optional cloud webLLM with explicit opt-in
- No data collection without consent

## 🚀 Development Roadmap

### Sprint 1 (Weeks 1-3)
- Core voice page navigation
- Baseline text-to-speech
- On/off toggle with spoken onboarding

### Sprint 2 (Weeks 4-6)
- Voice-driven form filling
- Voice zoom & text scaling
- Audio confirmations & error recovery

### Sprint 3 (Weeks 7-9)
- Microsoft Edge packaging & verification
- WebLLM natural intent parsing (local-first)

## 🛠️ Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Chrome/Chromium or Microsoft Edge browser
- Microphone access

### Installation

```bash
# Clone the repository
git clone https://github.com/safemstf/Hoda.git
cd Hoda

# Install dependencies
npm install

# Build the extension
npm run build

# Load in browser (development mode)
npm run dev
```

### Loading the Extension

#### Chrome/Chromium:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

#### Microsoft Edge:
1. Open `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## 🎙️ Usage

1. **Activate**: Click the extension icon or use keyboard shortcut
2. **Tutorial**: First-time users get a spoken onboarding tour
3. **Voice Commands**:
   - "scroll up/down" - Navigate the page
   - "list links" - Enumerate clickable links
   - "open link 3" - Open specific link by number
   - "read page" - Start text-to-speech
   - "zoom in/out" - Adjust page zoom
   - "fill name John Doe" - Enter form data

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run accessibility tests
npm run test:a11y
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Follow ESLint configuration
- Use meaningful commit messages
- Add tests for new features
- Update documentation

## 📋 User Stories & Issues

Track our progress through [GitHub Issues](https://github.com/safemstf/Hoda/issues). Each user story is tagged with:
- **Priority**: P1 (Critical), P2 (Important), P3 (Enhancement)
- **Sprint**: Sprint-1, Sprint-2, Sprint-3
- **Type**: Feature, Bug, Documentation

## 🔧 Technical Stack

- **Frontend**: HTML, CSS, JavaScript
- **Extension APIs**: Chrome Extension Manifest V3
- **Speech**: Web Speech API, SpeechSynthesis API
- **ML**: WebLLM (local-first processing)
- **Build**: Webpack, Babel
- **Testing**: Jest, Puppeteer

## 📄 Privacy Policy

This extension prioritizes user privacy:
- **Local Processing**: Speech recognition and commands processed locally
- **Optional Cloud**: WebLLM cloud features require explicit opt-in
- **No Tracking**: No analytics or user behavior tracking
- **Minimal Permissions**: Only requests necessary browser permissions

## 📚 Documentation

- [User Guide](docs/user-guide.md)
- [Developer Guide](docs/developer-guide.md)
- [API Reference](docs/api-reference.md)
- [Accessibility Guidelines](docs/accessibility.md)

## 📞 Support

For questions or issues:
- Create a [GitHub Issue](https://github.com/safemstf/Hoda/issues)
- Contact the Scrum Master: safemustafa@my.unt.edu

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎓 Academic Project

This is an academic project for CSCE 5430 Software Engineering at the University of North Texas. Developed by Syntax Squad (Group 1) for Fall 2025.

---

**Empowering accessible web browsing through voice technology** 🗣️✨
