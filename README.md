

<p align="center">
  <img src="./assets/images/logoBlack.png#gh-light-mode-only" alt="FinFit Complete Logo" width="300" />
  <img src="./assets/images/logo.png#gh-dark-mode-only" alt="FinFit Complete Logo" width="300" />
</p>

<p align="center">
  <strong>Smart, Local-First Personal Finance & Expense Management</strong>
</p>

<p align="center">
  <a href="https://github.com/Abhishekmnnit6022/finfit/releases/download/v1.0.0/FinFit.apk">
    <img src="https://img.shields.io/badge/Download-FinFit%20APK%20(v1.0.0)-2563EB?style=for-the-badge&logo=android&logoColor=white" alt="Download FinFit APK" />
  </a>
  <a href="https://github.com/Abhishekmnnit6022/finfit/releases">
    <img src="https://img.shields.io/badge/GitHub-Releases-10B981?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Releases" />
  </a>
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-6366F1?style=for-the-badge" alt="Platforms" />
</p>

---

FinFit is a modern, privacy-focused personal finance tracking and budgeting application built with React Native and Expo. It empowers users to monitor expenses, manage budgets, track multi-currency balances, and gain actionable financial insights through automated analytics and AI-powered advisory.

> [!TIP]
> **Direct APK Download**: You can download the pre-compiled standalone Android APK directly from our [GitHub Releases](https://github.com/Abhishekmnnit6022/finfit/releases) or via the [Direct APK Download Link](https://github.com/Abhishekmnnit6022/finfit/releases/download/v1.0.0/FinFit.apk).

---

## Key Capabilities

- **Local-First Architecture**: Financial records are stored securely on-device using SQLite and AsyncStorage, ensuring complete privacy and offline usability.
- **AI Financial Advisor**: Provides tailored spending assessments and conversational financial mentorship powered by Google Gemini and xAI Grok, backed by an intelligent offline student advisory engine.
- **OCR Receipt Scanning**: Fast automated expense entry using optical character recognition to extract total amounts and vendors directly from paper receipts or gallery images, with inline detail verification and editing before saving.
- **Deep-Linked UPI Payments**: Directly launches installed Indian UPI payment apps (Google Pay, PhonePe, Paytm, BHIM, CRED) for seamless payment execution while logging transactions.
- **Live Multi-Currency Conversion**: Real-time cross-currency rates with multi-tier fallback tables, enabling users to log and view expenses across global currencies.
- **Proactive Budget Alerts**: Automated notifications for categories exceeding 75%, 90%, and 100% of budgeted limits, featuring strict 3-hour cooldowns and single daily alerts to prevent notification fatigue.
- **Data Export & Portability**: Generates branded financial reports (`FinFit_Expense_Report.pdf`, CSV, and JSON) for external auditing and backups.
- **Device-Level Security**: Biometric and PIN authentication via Expo Local Authentication (Fingerprint, Face ID, PIN).

---

## Technical Stack

| Domain | Technology |
| :--- | :--- |
| **Framework** | React Native, Expo SDK 51, Expo Router |
| **Local Database** | Expo SQLite (`expo-sqlite`), AsyncStorage |
| **Styling & Theme** | Custom Dark Theme (`#101010` background, electric blue accents) |
| **AI & LLM Services** | Google Gemini API, xAI Grok, OpenAI REST API |
| **Receipt OCR** | OCR Space REST API |
| **Currency Rates** | ExchangeRate-API (live pairs with offline fallback matrix) |
| **Native Integrations** | Expo Notifications, Expo IntentLauncher, Expo LocalAuthentication |
| **Internationalization** | i18next (English, Hindi, Tamil) |

---

## Architecture Highlights

### 1. Developer Remote Configuration
FinFit integrates a silent remote configuration architecture. Production API keys (Gemini, Grok, OCR, Currency) can be updated via a developer-controlled GitHub Gist without requiring application re-compilation or APK redistribution. The client checks for updates asynchronously with a 2-minute cache cycle and falls back to bundled keys offline.

### 2. Dual Floating Action System
The dashboard incorporates dual floating action buttons:
- **Calculator FAB**: Opens an inline expense calculator for manual calculations, category selection, and instant UPI checkout.
- **Camera FAB**: Opens receipt image capture with direct OCR text extraction and automated field pre-filling with verification options.

### 3. Fail-Safe Offline Advisory Engine
If third-party LLM providers encounter rate limits or network unavailability, the built-in financial analysis engine automatically evaluates the user's recent cash flow, category concentration, and savings rates to deliver structured, bulleted advice without throwing unhandled exceptions.

---

## Development Workflows: Expo vs Build Mode

FinFit supports both rapid development via the managed **Expo Development Mode** and full offline standalone APK compilation via **Build Mode**.

### 🟢 Mode 1: Expo Development Mode (Default)
Use this mode for rapid UI development, feature iteration, and cross-platform testing with instant Hot Module Reloading (HMR).

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start Expo dev server**:
   ```bash
   npx expo start
   ```
   *or:*
   ```bash
   npm start
   ```
3. **Run on your device**:
   - Open the **Expo Go** app on your phone and scan the QR code displayed in the terminal.
   - Or press `a` in the terminal to launch directly on a connected Android phone or emulator.

---

### 🔨 Mode 2: Switching to Standalone Build Mode (Building APK)
When you are ready to compile a standalone, optimized release APK (`FinFit.apk`) without requiring Expo Go:

1. **Generate native Android project configuration**:
   ```bash
   npx expo prebuild --clean
   ```
   *(This generates the native `android/` directory with production AndroidManifest, native plugins, launcher mipmap icons, and permissions).*

2. **Compile the Release APK locally**:
   - **On Windows (PowerShell/CMD)**:
     ```powershell
     cd android
     .\gradlew.bat assembleRelease
     cd ..
     ```
   - **On macOS/Linux**:
     ```bash
     cd android
     ./gradlew assembleRelease
     cd ..
     ```
   - *Or use the npm script:*
     ```bash
     npm run build:apk
     ```

3. **Locate your compiled APK**:
   The generated release APK will be located at:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

4. **Install APK directly onto a connected phone via ADB**:
   ```bash
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```

---

### 🔄 Mode 3: Switching Back to Expo Development Mode from Build Mode
After building your APK, return to the clean Expo managed workflow:

1. **Remove the generated native `android` folder**:
   - **On Windows (PowerShell)**:
     ```powershell
     Remove-Item -Recurse -Force android
     ```
   - **On macOS/Linux (Bash)**:
     ```bash
     rm -rf android
     ```

2. **Start Expo with cleared bundler cache**:
   ```bash
   npx expo start -c
   ```
3. You are now back in standard Expo managed mode with zero native build clutter!

---

## Project Structure

```
finfit/
├── app/                        # Expo Router file-based screens
│   ├── (drawer)/               # Navigation drawer and tabs
│   │   ├── (tabs)/             # Main tab views (Home, Budgets, Analysis, Accounts)
│   │   └── _layout.jsx         # Custom drawer navigation
│   └── _layout.jsx             # Root layout and theme providers
├── components/                 # Reusable UI components
│   ├── ExpenseCalculator.jsx   # Expense entry and UPI app launcher
│   ├── MoneyTracker.jsx        # Dashboard, balance summaries, and dual FABs
│   ├── Budgetnotification.jsx  # Notification manager with 3h/1-day throttling
│   ├── ChatInterface.jsx       # AI financial advisor chat interface
│   ├── OCRService.js           # Receipt scanning and text parsing
│   └── globalProvider.jsx      # Central SQLite database and state store
├── constants/                  # Color palettes, theme tokens, and typography
├── utils/                      # Helper services
│   ├── aiService.js            # Multi-provider LLM connector & student engine
│   ├── remoteConfig.js         # Remote key synchronization
│   ├── currencyService.js      # Multi-tier currency exchange engine
│   └── language/               # Translation dictionaries (EN, HI, TM)
├── assets/                     # App icons, splash screens, and images
└── app.json                    # Expo project configuration
```

---

## Core Contributors

**Team Auxin**

- **Abhishek Rastogi** — [@Abhishekmnnit6022](https://github.com/Abhishekmnnit6022)
- **Harshit Kumar Jayaswal** — [@kharshit801](https://github.com/kharshit801)
- **Aachintya Wairiya** — [@aachintya](https://github.com/aachintya)

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
