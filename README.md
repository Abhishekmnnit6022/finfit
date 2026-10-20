<p align="center">
  <img src="./assets/images/logoBlack.png#gh-light-mode-only" alt="FinFit Complete Logo" width="300" />
  <img src="./assets/images/logo.png#gh-dark-mode-only" alt="FinFit Complete Logo" width="300" />
</p>

<p align="center">
  <strong>Smart, Local-First Personal Finance and Expense Management</strong>
</p>

<p align="center">
  <a href="https://github.com/Abhishekmnnit6022/finfit/releases/latest/download/FinFit.apk">
    <img src="https://img.shields.io/badge/Download-FinFit%20APK%20(v1.0.0)-2563EB?style=for-the-badge&logo=android&logoColor=white" alt="Download FinFit APK" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Framework-Expo%20SDK%2051-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/React%20Native-0.74-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

---

FinFit is a modern, privacy-focused personal finance tracking and budgeting application built with React Native and Expo. It empowers users to monitor expenses, manage budgets, track multi-currency balances, and gain actionable financial insights through automated analytics, native device security, and AI-powered advisory.

> [!TIP]
> **Direct APK Download**: Download the latest compiled Android application package: **[Download FinFit.apk](https://github.com/Abhishekmnnit6022/finfit/releases/latest/download/FinFit.apk)** *(or view releases via [GitHub Releases](https://github.com/Abhishekmnnit6022/finfit/releases))*.

---

## Key Capabilities

- **Local-First Architecture and Privacy**: All financial records, accounts, and budgets are stored securely on-device using SQLite and AsyncStorage, ensuring complete user privacy, zero mandatory external server dependencies, and full offline usability.
- **AI Financial Advisor**: Contextual spending assessments and conversational financial mentorship powered by Google Gemini and xAI Grok, backed by an autonomous offline heuristic advisory engine.
- **OCR Receipt Scanning and Auto-Categorization**: Automated expense entry using optical character recognition to extract vendor names, amounts, and dates with smart category suggestions.
- **Instant Merchant UPI Payments**: Integrated camera scanner for merchant UPI QR codes with automatic parameter extraction, direct forwarding to installed UPI apps, and prompt post-payment logging.
- **Offline-First Backup and Encrypted QR Sync**: Complete offline data protection with encrypted QR-based device-to-device migration and secure password-protected backups without relying on external servers.
- **Comprehensive Data Export**: Generates branded PDF reports, CSV spreadsheets, and JSON files for auditing, analysis, and personal records.
- **Proactive Budget Alerts**: Real-time category budget utilization with automated notifications at 75%, 90%, and 100% threshold crossings with smart cooldowns.
- **Native Device Security**: Biometric and device PIN authentication (Fingerprint, Face ID, PIN) safeguarding app launch and background resume.
- **Multi-Currency Support**: Real-time conversion across 35 major world currencies with offline fallback rates.
- **Multilingual Support**: Fully localized across 6 languages: English, Hindi, Marathi, Kannada, Tamil, and Urdu.
- **User-Friendly Dual Themes**: Sleek default dark mode with an instant drawer switch toggle, clean card borders, and zero white-screen leaks.

---

## Technical Stack

| Domain | Technology |
| :--- | :--- |
| **Framework** | React Native, Expo SDK 51, Expo Router |
| **Local Database** | Expo SQLite (`expo-sqlite`), AsyncStorage |
| **Security & Auth** | Expo LocalAuthentication (Biometrics, Device PIN) |
| **Styling & Theming** | Dynamic Theme Context (Dark Theme default, Light Theme mode) |
| **AI & LLM Services** | Google Gemini API, xAI Grok, OpenAI REST API |
| **Receipt OCR** | OCR Space REST API |
| **Payments Integration** | Expo IntentLauncher, Deep-Linked Indian UPI URI Handlers |
| **Currency Engine** | ExchangeRate-API |
| **Notifications** | Expo Notifications (Threshold throttling and cooldowns) |
| **Internationalization** | i18next (English, Hindi, Tamil, Kannada, Marathi, Urdu) |

---

## Architecture Highlights

### Dual-Layer Financial Advisory Engine
FinFit implements a resilient dual-layer intelligence architecture:
- **Cloud AI (Primary)**: Generates contextual, conversational spending assessments and budget recommendations powered by Google Gemini and xAI Grok.
- **On-Device Heuristic Engine (Offline Fallback)**: If network connectivity is lost, API rate limits are reached, or cloud services are unreachable, the embedded analysis engine evaluates cash flows, category concentration ratios, and savings trends to deliver structured, actionable advice completely offline.

### Strict Merchant UPI Forwarding & Verification
- Merchant payment QR codes are scanned via the built-in camera scanner.
- The raw `upi://pay` query string is parsed to extract payee information, pre-filling amount and source accounts.
- When confirmed, the payload is forwarded verbatim to the user's selected UPI application via native Android intent.
- Upon returning to FinFit, a verification dialog confirms whether the payment succeeded, logging the record automatically into the SQLite database.

---

## Development Workflows: Expo vs Standalone Build Mode

FinFit supports two distinct development workflows: rapid cross-platform iteration using **Expo Development Mode** and production compilation via **Standalone Build Mode**.

### Mode 1: Expo Development Mode (Rapid Iteration)
Use this mode for UI development, feature iteration, and cross-platform testing with instant Fast Refresh:

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the Expo development server**:
   ```bash
   npx expo start
   ```
   *or:*
   ```bash
   npm start
   ```
3. **Run on your device**:
   - Open the **Expo Go** application on your device and scan the displayed terminal QR code.
   - Alternatively, press `a` in the terminal to connect to an attached Android phone or emulator.

---

### Mode 2: Standalone Build Mode (Building APK)
Compile a standalone, optimized release APK without requiring the Expo Go client:

1. **Generate native Android project configuration**:
   ```bash
   npx expo prebuild --clean
   ```

2. **Compile the Release APK**:
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

3. **Locate your compiled APK**:
   The release APK will be located at:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

4. **Install APK directly via ADB**:
   ```bash
   adb install -r -d FinFit.apk
   ```

---

### Mode 3: Switching Back to Expo Development Mode (Ejecting from Build Mode)
After compiling an APK, cleanly restore the managed Expo workflow:

1. **Remove the generated native `android` folder**:
   - **On Windows (PowerShell)**:
     ```powershell
     Remove-Item -Recurse -Force android
     ```
   - **On macOS/Linux**:
     ```bash
     rm -rf android
     ```

2. **Start Expo with cleared bundler cache**:
   ```bash
   npx expo start -c
   ```
3. The project is now restored to standard Expo managed workflow with zero native build clutter.

---

## Project Structure

```
finfit/
├── app/                        # Expo Router file-based screens
│   ├── (drawer)/               # Navigation drawer and tabs
│   │   ├── (tabs)/             # Main tab views (Home, Budgets, Analysis, Accounts)
│   │   └── _layout.jsx         # Custom drawer navigation and theme toggle switch
│   ├── _layout.jsx             # Root layout, theme provider, and AppAuthGate
│   └── index.jsx               # Onboarding check and slide-to-start entry point
├── components/                 # Reusable UI components
│   ├── AppAuthGate.jsx         # Native biometric and device PIN authentication gate
│   ├── AppGuideOverlay.jsx     # Interactive guided walkthrough for dashboard
│   ├── BudgetGuideOverlay.jsx  # Interactive guided walkthrough for budgets
│   ├── AccountGuideOverlay.jsx # Interactive guided walkthrough for accounts
│   ├── CurrencySettings.jsx    # Curated 35-currency picker with full localization
│   ├── ExpenseCalculator.jsx   # Expense entry and UPI payment launcher
│   ├── MoneyTracker.jsx        # Dashboard, balance summaries, and action FABs
│   ├── Budgetnotification.jsx  # Throttled notification manager
│   ├── ChatInterface.jsx       # AI financial advisor chat interface
│   ├── SyncDataModal.jsx       # QR-based peer-to-peer data sync modal
│   ├── ExportDataModal.jsx     # Branded PDF, CSV, and JSON data export
│   ├── ThemedAlertModal.jsx    # Custom themed dialog and confirmation modals
│   └── globalProvider.jsx      # Central SQLite database and state store
├── constants/                  # Color palettes, theme tokens, and typography
├── utils/                      # Helper services
│   ├── aiService.js            # Multi-provider LLM connector and offline advisory
│   ├── upiService.js           # Merchant UPI deep linking and URI parser
│   ├── currencyService.js      # Multi-tier currency exchange rate engine
│   └── language/               # Translation dictionaries (EN, HI, TM, KN, MR, UR)
├── assets/                     # App icons, splash screens, and images
└── app.json                    # Expo project configuration
```

---

## Core Contributors

**FinFit Project Contributors**

- **Abhishek Rastogi** — [@Abhishekmnnit6022](https://github.com/Abhishekmnnit6022)
- **Harshit Kumar Jayaswal** — [@kharshit801](https://github.com/kharshit801)
- **Aachintya Wairiya** — [@aachintya](https://github.com/aachintya)

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
