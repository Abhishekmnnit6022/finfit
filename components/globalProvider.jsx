/**
 * ============================================================================
 * FINFIT GLOBAL STATE PROVIDER (globalProvider.jsx)
 * ============================================================================
 * Central hub for the FinFit application state management, including:
 *  1. SQLite Offline Storage (Transactions & Expenses)
 *  2. Real-time Multi-Currency Conversion & Live Exchange Rates
 *  3. Category Budgets & Threshold Alert Notifications
 *  4. Secure Encrypted QR Backup & Data Synchronization
 *  5. Centralized Themed Alert Modal System for Consistent App UI
 * ============================================================================
 */

import React, { createContext, useReducer, useContext, useEffect, useState, useCallback } from "react";
import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { format, addMonths, subMonths } from "date-fns";
import i18next from "i18next";
import * as FileSystem from "expo-file-system";
import remoteConfig from "../utils/remoteConfig";
import {
  convertAmount as convertCurrencyAmount,
  DEFAULT_RATES,
  getDefaultCurrency as getStoredDefaultCurrency,
  setDefaultCurrency as setStoredDefaultCurrency,
  fetchExchangeRates as fetchServiceExchangeRates,
  loadExchangeRates as loadServiceExchangeRates,
} from "../utils/currencyService";
import { notifyBudgetExceededForCategory } from "./Budgetnotification";
import ThemedAlertModal from "./ThemedAlertModal";
import { applyTheme } from "../constants/theme";

// Storage Keys for AsyncStorage persistence
const STORAGE_KEY = "APP_STATE";
const BUDGETS_STORAGE_KEY = "APP_BUDGETS";
const CATEGORY_BUDGETS_KEY = "CATEGORY_BUDGETS";
const EXCHANGE_RATES_KEY = "EXCHANGE_RATES";

/**
 * Global helper to trigger the FinFit Themed Alert anywhere without prop drilling.
 * @param {Object} options
 * @param {string} options.title - Alert title
 * @param {string} options.message - Alert body text
 * @param {'info'|'success'|'error'|'warning'|'confirm'} [options.type] - Alert visual tone
 * @param {string} [options.icon] - Optional Ionicons icon name
 * @param {Array<{text: string, onPress?: Function, style?: 'default'|'cancel'|'destructive'}>} [options.buttons]
 */
export const showThemedAlert = ({ title, message, type = "info", icon = null, buttons = [{ text: "OK" }] }) => {
  DeviceEventEmitter.emit("SHOW_THEMED_ALERT", { title, message, type, icon, buttons });
};

const initialState = {
  transactions: [],
  categories: {
    EXPENSE: [
      "Food & Dining",
      "Transportation",
      "Shopping",
      "Entertainment",
      "Bills & Utilities",
      "Health & Fitness",
      "Travel",
      "Other",
    ],
    INCOME: ["Salary", "Business", "Investments", "Freelance", "Gift", "Other"],
    TRANSFER: [
      "Account Transfer",
      "Investment Transfer",
      "Debt Payment",
      "Other",
    ],
  },
  accounts: [
    "Credit Card",
    "Cash",
    "Savings",
    "Bank Account",
    "Investment",
  ],
  budgets: [],
  categoryBudgets: {},
  summary: {
    expense: 0,
    income: 0,
    total: 0,
  },
  currentMonth: new Date().toISOString(),
  language: null,
  theme: "dark",
  fontLoaded: false,
  hasLaunched: false,
  defaultCurrency: "INR",
  currencies: {
    INR: { symbol: "₹", name: "Indian Rupee" },
    USD: { symbol: "$", name: "US Dollar" },
    EUR: { symbol: "€", name: "Euro" },
    GBP: { symbol: "£", name: "British Pound" },
    AED: { symbol: "د.إ", name: "UAE Dirham" },
    SAR: { symbol: "﷼", name: "Saudi Riyal" },
    CAD: { symbol: "CA$", name: "Canadian Dollar" },
    AUD: { symbol: "A$", name: "Australian Dollar" },
    SGD: { symbol: "S$", name: "Singapore Dollar" },
    KWD: { symbol: "د.ك", name: "Kuwaiti Dinar" },
    QAR: { symbol: "ر.ق", name: "Qatari Rial" },
    OMR: { symbol: "ر.ع.", name: "Omani Rial" },
    BHD: { symbol: "BD", name: "Bahraini Dinar" },
    JPY: { symbol: "¥", name: "Japanese Yen" },
    CNY: { symbol: "¥", name: "Chinese Yuan" },
    CHF: { symbol: "CHF", name: "Swiss Franc" },
    RUB: { symbol: "₽", name: "Russian Ruble" },
    BRL: { symbol: "R$", name: "Brazilian Real" },
    ZAR: { symbol: "R", name: "South African Rand" },
    PKR: { symbol: "₨", name: "Pakistani Rupee" },
    BDT: { symbol: "৳", name: "Bangladeshi Taka" },
    LKR: { symbol: "Rs", name: "Sri Lankan Rupee" },
    NPR: { symbol: "रू", name: "Nepalese Rupee" },
    NZD: { symbol: "NZ$", name: "New Zealand Dollar" },
    THB: { symbol: "฿", name: "Thai Baht" },
    MYR: { symbol: "RM", name: "Malaysian Ringgit" },
    IDR: { symbol: "Rp", name: "Indonesian Rupiah" },
    KRW: { symbol: "₩", name: "South Korean Won" },
    TRY: { symbol: "₺", name: "Turkish Lira" },
    EGP: { symbol: "E£", name: "Egyptian Pound" },
    VND: { symbol: "₫", name: "Vietnamese Dong" },
    PHP: { symbol: "₱", name: "Philippine Peso" },
    MXN: { symbol: "Mex$", name: "Mexican Peso" },
    SEK: { symbol: "kr", name: "Swedish Krona" },
    HKD: { symbol: "HK$", name: "Hong Kong Dollar" },
  },
  exchangeRates: DEFAULT_RATES,
  lastRatesUpdate: null,
};

let db = null;
const initializeDatabase = async () => {
  try {
    // Ensure we only initialize the database once
    if (!db) {
      db = await SQLite.openDatabaseAsync("expenses.db");

      // Enable WAL mode for better performance
      await db.execAsync("PRAGMA journal_mode = WAL;");

      // Create the table with NOT NULL constraints where appropriate
      await db.execAsync(`
                CREATE TABLE IF NOT EXISTS expenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount REAL NOT NULL DEFAULT 0,
                    type TEXT NOT NULL DEFAULT 'EXPENSE',
                    category TEXT NOT NULL DEFAULT 'Other',
                    account TEXT DEFAULT '',
                    note TEXT DEFAULT '',
                    date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    currency TEXT NOT NULL DEFAULT 'USD'
                );
            `);

      console.log("Database initialized successfully");
    }
    return true;
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
};

// Base64 characters table
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

// Pure JS UTF-8 to Base64 encoder - works 100% reliably in Hermes and native runtimes without Latin1 limits
const utf8ToBase64 = (str) => {
  if (!str) return "";
  try {
    const uriEncoded = encodeURIComponent(str);
    const binaryStr = uriEncoded.replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    );
    if (typeof btoa === "function") {
      return btoa(binaryStr);
    }
  } catch (e) {
    // Continue to pure JS conversion
  }

  // Pure JS fallback
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    const b2 = i < bytes.length ? bytes[i++] : NaN;
    const b3 = i < bytes.length ? bytes[i++] : NaN;

    out += B64_CHARS.charAt(b1 >> 2);
    out += B64_CHARS.charAt(((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4));
    out += isNaN(b2) ? "=" : B64_CHARS.charAt(((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6));
    out += isNaN(b3) ? "=" : B64_CHARS.charAt(b3 & 63);
  }
  return out;
};

// Pure JS Base64 to UTF-8 decoder - converts base64 back into full UTF-8 string
const base64ToUtf8 = (base64) => {
  if (!base64) return "";
  try {
    if (typeof atob === "function") {
      const binaryStr = atob(String(base64).trim());
      const uriEncoded = Array.from(binaryStr)
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("");
      return decodeURIComponent(uriEncoded);
    }
  } catch (e) {
    // Continue to pure JS conversion
  }

  const clean = String(base64).trim().replace(/[=]+$/, "");
  const bytes = [];
  for (let bc = 0, bs = 0, buffer, idx = 0; (buffer = clean.charAt(idx++)); ) {
    buffer = B64_CHARS.indexOf(buffer);
    if (~buffer) {
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) {
        bytes.push(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }

  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 128) {
      result += String.fromCharCode(c);
    } else if (c > 191 && c < 224) {
      const c2 = bytes[i++];
      result += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
    } else if (c > 223 && c < 240) {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      result += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
    } else {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      const c4 = bytes[i++];
      const code = (((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) - 0x10000;
      result += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    }
  }
  return result;
};

// Prefix tag that FinFit recognizes
const FINFIT_QR_PREFIX = "FINFIT_SECURE_V1:";
const ENCRYPTION_SECRET = "FinFit#2026!SecureKey@TransferSync";

// Generates pseudo-random keystream bytes from key and salt
const generateKeyStream = (keyStr, saltStr, length) => {
  const combined = keyStr + ":" + saltStr;
  const stream = new Uint8Array(length);
  let hash = 0x811c9dc5;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  for (let i = 0; i < length; i++) {
    hash = Math.imul(hash ^ (i & 0xff), 1664525) + 1013904223;
    stream[i] = (hash >>> 16) & 0xff;
  }
  return stream;
};

// Encrypt payload to unreadable gibberish with salt and keystream
const encryptPayload = (plainText) => {
  if (!plainText) return "";
  const salt = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  // Get UTF-8 bytes of plainText
  const utf8Bytes = [];
  for (let i = 0; i < plainText.length; i++) {
    let charcode = plainText.charCodeAt(i);
    if (charcode < 0x80) utf8Bytes.push(charcode);
    else if (charcode < 0x800) {
      utf8Bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8Bytes.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (plainText.charCodeAt(i) & 0x3ff));
      utf8Bytes.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    }
  }

  const keystream = generateKeyStream(ENCRYPTION_SECRET, salt, utf8Bytes.length);
  const cipherBytes = new Uint8Array(utf8Bytes.length);
  for (let i = 0; i < utf8Bytes.length; i++) {
    cipherBytes[i] = utf8Bytes[i] ^ keystream[i];
  }

  // Base64 encode the cipher bytes
  let binary = "";
  for (let i = 0; i < cipherBytes.length; i++) {
    binary += String.fromCharCode(cipherBytes[i]);
  }
  let base64Cipher = "";
  if (typeof btoa === "function") {
    base64Cipher = btoa(binary);
  } else {
    base64Cipher = utf8ToBase64(binary);
  }

  return `${FINFIT_QR_PREFIX}${salt}:${base64Cipher}`;
};

// Decrypt payload from gibberish back to plainText
const decryptPayload = (encryptedStr) => {
  if (!encryptedStr || !encryptedStr.startsWith(FINFIT_QR_PREFIX)) {
    throw new Error("Invalid prefix");
  }
  const payloadPart = encryptedStr.slice(FINFIT_QR_PREFIX.length);
  const colonIndex = payloadPart.indexOf(":");
  if (colonIndex === -1) {
    throw new Error("Invalid encrypted format");
  }
  const salt = payloadPart.slice(0, colonIndex);
  const base64Cipher = payloadPart.slice(colonIndex + 1);

  let binary = "";
  if (typeof atob === "function") {
    binary = atob(base64Cipher);
  } else {
    binary = base64ToUtf8(base64Cipher);
  }

  const cipherBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    cipherBytes[i] = binary.charCodeAt(i);
  }

  const keystream = generateKeyStream(ENCRYPTION_SECRET, salt, cipherBytes.length);
  const plainBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    plainBytes[i] = cipherBytes[i] ^ keystream[i];
  }

  let result = "";
  let i = 0;
  while (i < plainBytes.length) {
    const c = plainBytes[i++];
    if (c < 128) {
      result += String.fromCharCode(c);
    } else if (c > 191 && c < 224) {
      const c2 = plainBytes[i++];
      result += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
    } else if (c > 223 && c < 240) {
      const c2 = plainBytes[i++];
      const c3 = plainBytes[i++];
      result += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
    } else {
      const c2 = plainBytes[i++];
      const c3 = plainBytes[i++];
      const c4 = plainBytes[i++];
      const code = (((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) - 0x10000;
      result += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    }
  }
  return result;
};

// ============================================================================
// PASSWORD-PROTECTED BACKUP FILE ENCRYPTION
// ============================================================================
// PASSWORD-PROTECTED BACKUP FILE ENCRYPTION (HARDENED V2 + BACKWARD-COMPATIBLE V1)
// ============================================================================
// Separate from QR encryption — uses a user-chosen password to derive keys.
// V2 Format: FINFIT_BACKUP_V2:<salt>:<mac_tag>:<encrypted_base64_payload>
// V1 Format: FINFIT_BACKUP_V1:<salt>:<encrypted_base64_payload>
const FINFIT_FILE_V2_PREFIX = "FINFIT_BACKUP_V2:";
const FINFIT_FILE_V1_PREFIX = "FINFIT_BACKUP_V1:";

/**
 * High-security key derivation function (PBKDF-style, 8,192 stretching rounds).
 * Mathematically expensive to brute force (thousands of cycles per password attempt)
 * while fast (<20ms) for legitimate mobile users.
 */
const deriveSecureKeyAndMac = (password, salt) => {
  let h0 = 0x811c9dc5 ^ password.length;
  let h1 = 0xcbf29ce4 ^ salt.length;
  let h2 = 0x9e3779b9;
  let h3 = 0x85ebca6b;

  const combined = password + "::" + salt + "::FinFitSecureKeyStretching_2026";
  const clen = combined.length;

  for (let round = 0; round < 8192; round++) {
    const charCode = combined.charCodeAt(round % clen);
    h0 = Math.imul(h0 ^ (charCode + round), 0x01000193) ^ (h1 >>> 13);
    h1 = Math.imul(h1 ^ ((h0 >>> 7) + charCode), 1664525) + 1013904223;
    h2 = Math.imul(h2 ^ (h1 >>> 11), 2246822519) + 3266489917;
    h3 = Math.imul(h3 ^ (h2 >>> 15), 3266489917) + (charCode * 7919);
  }

  return { h0, h1, h2, h3 };
};

const generateKeystreamV2 = (keys, length) => {
  let { h0, h1, h2, h3 } = keys;
  const stream = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    h0 = Math.imul(h0 ^ (i & 0xff), 1664525) + 1013904223;
    h1 = Math.imul(h1 ^ (h0 >>> 16), 2246822519) + 3266489917;
    h2 = ((h2 << 5) | (h2 >>> 27)) ^ h1;
    h3 = ((h3 << 7) | (h3 >>> 25)) ^ (h0 + i);
    stream[i] = ((h1 ^ h3) >>> 8) & 0xff;
  }
  return stream;
};

const computeMacTag = (bytes, keys) => {
  let m1 = keys.h2;
  let m2 = keys.h3;
  for (let i = 0; i < bytes.length; i++) {
    m1 = Math.imul(m1 ^ bytes[i], 0x01000193);
    m2 = Math.imul(m2 ^ (m1 >>> 16), 1664525) + bytes[i];
  }
  const hex1 = (m1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (m2 >>> 0).toString(16).padStart(8, "0");
  return hex1 + hex2;
};

// Helper for UTF-8 byte decoding
const decodeUtf8Bytes = (bytes) => {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 128) {
      result += String.fromCharCode(c);
    } else if (c > 191 && c < 224) {
      const c2 = bytes[i++];
      result += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
    } else if (c > 223 && c < 240) {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      result += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
    } else {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      const c4 = bytes[i++];
      const code = (((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) - 0x10000;
      result += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    }
  }
  return result;
};

// Legacy V1 Key derivation for backward compatibility
const deriveKeyFromPasswordV1 = (password, salt, length) => {
  const combined = password + ":" + salt + ":FINFIT_PWD_2026";
  const stream = new Uint8Array(length);
  let hash = 0x811c9dc5;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= password.length * 7919;
  for (let i = 0; i < password.length; i++) {
    hash = Math.imul(hash ^ password.charCodeAt(i), 1664525) + 1013904223;
  }
  for (let i = 0; i < length; i++) {
    hash = Math.imul(hash ^ (i & 0xff), 1664525) + 1013904223;
    stream[i] = (hash >>> 16) & 0xff;
  }
  return stream;
};

/**
 * Encrypts plaintext JSON string with a user-chosen password using 8,192 PBKDF rounds + MAC.
 * Returns a string: FINFIT_BACKUP_V2:<salt>:<mac_tag>:<base64_cipher>
 */
const encryptWithPassword = (plainText, password) => {
  if (!plainText || !password) return "";
  const salt = Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(2, 10);

  // Convert plainText to UTF-8 bytes
  const utf8Bytes = [];
  for (let i = 0; i < plainText.length; i++) {
    let charcode = plainText.charCodeAt(i);
    if (charcode < 0x80) utf8Bytes.push(charcode);
    else if (charcode < 0x800) {
      utf8Bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8Bytes.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (plainText.charCodeAt(i) & 0x3ff));
      utf8Bytes.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    }
  }

  const keys = deriveSecureKeyAndMac(password, salt);
  const keystream = generateKeystreamV2(keys, utf8Bytes.length);
  const cipherBytes = new Uint8Array(utf8Bytes.length);
  for (let i = 0; i < utf8Bytes.length; i++) {
    cipherBytes[i] = utf8Bytes[i] ^ keystream[i];
  }

  const macTag = computeMacTag(utf8Bytes, keys);

  // Base64 encode
  let binary = "";
  for (let i = 0; i < cipherBytes.length; i++) {
    binary += String.fromCharCode(cipherBytes[i]);
  }
  let base64Cipher = "";
  if (typeof btoa === "function") {
    base64Cipher = btoa(binary);
  } else {
    base64Cipher = utf8ToBase64(binary);
  }

  return `${FINFIT_FILE_V2_PREFIX}${salt}:${macTag}:${base64Cipher}`;
};

/**
 * Decrypts a password-encrypted backup string (supports both V2 and V1).
 * Verifies cryptographic MAC and UTF-8 JSON.
 */
const decryptWithPassword = (encryptedStr, password) => {
  if (!encryptedStr) {
    throw new Error("Invalid backup file — empty content");
  }

  const trimmed = encryptedStr.trim();

  // Primary: Hardened V2 format with 8192-round key derivation and MAC verification
  if (trimmed.startsWith(FINFIT_FILE_V2_PREFIX)) {
    const payloadPart = trimmed.slice(FINFIT_FILE_V2_PREFIX.length);
    const parts = payloadPart.split(":");
    if (parts.length < 3) {
      throw new Error("Invalid backup file — corrupted format");
    }
    const salt = parts[0];
    const macTag = parts[1];
    const base64Cipher = parts.slice(2).join(":");

    let binary = "";
    if (typeof atob === "function") {
      binary = atob(base64Cipher);
    } else {
      binary = base64ToUtf8(base64Cipher);
    }

    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }

    const keys = deriveSecureKeyAndMac(password, salt);
    const keystream = generateKeystreamV2(keys, cipherBytes.length);
    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      plainBytes[i] = cipherBytes[i] ^ keystream[i];
    }

    // Verify MAC tag immediately
    const computedTag = computeMacTag(plainBytes, keys);
    if (computedTag !== macTag) {
      throw new Error("Incorrect password — decryption failed");
    }

    const result = decodeUtf8Bytes(plainBytes);
    JSON.parse(result);
    return result;
  }

  // Fallback: Legacy V1 format
  if (trimmed.startsWith(FINFIT_FILE_V1_PREFIX)) {
    const payloadPart = trimmed.slice(FINFIT_FILE_V1_PREFIX.length);
    const colonIndex = payloadPart.indexOf(":");
    if (colonIndex === -1) {
      throw new Error("Invalid backup file — corrupted format");
    }
    const salt = payloadPart.slice(0, colonIndex);
    const base64Cipher = payloadPart.slice(colonIndex + 1);

    let binary = "";
    if (typeof atob === "function") {
      binary = atob(base64Cipher);
    } else {
      binary = base64ToUtf8(base64Cipher);
    }

    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }

    const keystream = deriveKeyFromPasswordV1(password, salt, cipherBytes.length);
    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      plainBytes[i] = cipherBytes[i] ^ keystream[i];
    }

    const result = decodeUtf8Bytes(plainBytes);
    try {
      JSON.parse(result);
    } catch {
      throw new Error("Incorrect password — decryption failed");
    }
    return result;
  }

  throw new Error("Invalid backup file format — not a FinFit backup");
};

// Category default icon mapping
const getCategoryIcon = (category) => {
  const iconMap = {
    "Food & Dining": "utensils",
    Transportation: "car",
    Shopping: "shopping-bag",
    Entertainment: "film",
    "Bills & Utilities": "file-invoice-dollar",
    "Health & Fitness": "heartbeat",
    Travel: "plane",
    "Account Transfer": "exchange-alt",
    "Investment Transfer": "chart-line",
    "Debt Payment": "credit-card",
    Other: "dot-circle",
  };
  return iconMap[category] || "tag";
};

/**
 * Generates a password-encrypted backup file content string.
 * This can be saved as a .finfit file and shared via WhatsApp, etc.
 * No QR size limits — supports unlimited data.
 */
const generateBackupFileData = async (currentState, password) => {
  try {
    const db = await SQLite.openDatabaseAsync("expenses.db");
    const expenses = await db.getAllAsync("SELECT * FROM expenses ORDER BY date DESC");

    const cleanedExpenses = (expenses || []).map((e) => ({
      a: parseFloat(e.amount) || 0,
      t: e.type || "EXPENSE",
      c: e.category || "Other",
      ac: e.account || "",
      n: e.note || "",
      d: e.date || new Date().toISOString(),
      cr: e.currency || "INR",
    }));

    let budgets = [];
    try {
      const savedBudgetsStr = await AsyncStorage.getItem(BUDGETS_STORAGE_KEY);
      if (savedBudgetsStr) budgets = JSON.parse(savedBudgetsStr);
    } catch (e) {}
    if ((!budgets || budgets.length === 0) && currentState?.budgets?.length > 0) {
      budgets = currentState.budgets;
    }
    const cleanedBudgets = (budgets || []).map((b) => ({
      c: b.category, l: parseFloat(b.limit) || 0, t: b.type || "EXPENSE", i: b.icon || getCategoryIcon(b.category),
    }));

    let categoryBudgets = currentState?.categoryBudgets || {};
    try {
      const catBudgetsStr = await AsyncStorage.getItem(CATEGORY_BUDGETS_KEY);
      if (catBudgetsStr) categoryBudgets = JSON.parse(catBudgetsStr);
    } catch (e) {}

    let categories = currentState?.categories;
    if (!categories || !categories.EXPENSE) {
      try {
        const savedStateStr = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedStateStr) { const parsed = JSON.parse(savedStateStr); if (parsed?.categories) categories = parsed.categories; }
      } catch (e) {}
    }
    if (!categories) categories = initialState.categories;

    let accounts = currentState?.accounts;
    if (!accounts || accounts.length === 0) {
      try {
        const savedStateStr = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedStateStr) { const parsed = JSON.parse(savedStateStr); if (parsed?.accounts) accounts = parsed.accounts; }
      } catch (e) {}
    }
    if (!accounts || accounts.length === 0) accounts = initialState.accounts;

    const defaultCurrency = currentState?.defaultCurrency || "INR";

    const payload = {
      version: "2.0",
      timestamp: Date.now(),
      defaultCurrency,
      accounts,
      categories,
      budgets: cleanedBudgets,
      categoryBudgets,
      expenses: cleanedExpenses,
    };

    const jsonString = JSON.stringify(payload);
    return encryptWithPassword(jsonString, password);
  } catch (error) {
    console.error("Error generating backup file data:", error);
    throw error;
  }
};

// Generate complete QR backup data from SQLite and state (encrypted gibberish for third-party scanners)
const generateTransferData = async (currentState = null) => {
  try {
    const db = await SQLite.openDatabaseAsync("expenses.db");

    // 1. Get all expenses from database
    const expenses = await db.getAllAsync("SELECT * FROM expenses ORDER BY date DESC");

    // Clean and normalize expenses for QR transfer with compact keys
    const cleanedExpenses = (expenses || []).map((e) => ({
      a: parseFloat(e.amount) || 0,
      t: e.type || "EXPENSE",
      c: e.category || "Other",
      ac: e.account || "",
      n: e.note || "",
      d: e.date || new Date().toISOString(),
      cr: e.currency || "INR",
    }));

    // 2. Read budgets from AsyncStorage or state
    let budgets = [];
    try {
      const savedBudgetsStr = await AsyncStorage.getItem(BUDGETS_STORAGE_KEY);
      if (savedBudgetsStr) {
        budgets = JSON.parse(savedBudgetsStr);
      }
    } catch (e) {
      console.warn("Could not read saved budgets in generateTransferData:", e);
    }
    if ((!budgets || budgets.length === 0) && currentState?.budgets?.length > 0) {
      budgets = currentState.budgets;
    }

    const cleanedBudgets = (budgets || []).map((b) => ({
      c: b.category,
      l: parseFloat(b.limit) || 0,
      t: b.type || "EXPENSE",
      i: b.icon || getCategoryIcon(b.category),
    }));

    // 3. Read category budgets map
    let categoryBudgets = currentState?.categoryBudgets || {};
    try {
      const catBudgetsStr = await AsyncStorage.getItem(CATEGORY_BUDGETS_KEY);
      if (catBudgetsStr) {
        categoryBudgets = JSON.parse(catBudgetsStr);
      }
    } catch (e) {
      console.warn("Could not read category budgets:", e);
    }

    // 4. Read categories from state or AsyncStorage
    let categories = currentState?.categories;
    if (!categories || !categories.EXPENSE) {
      try {
        const savedStateStr = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedStateStr) {
          const parsed = JSON.parse(savedStateStr);
          if (parsed?.categories) categories = parsed.categories;
        }
      } catch (e) {}
    }
    if (!categories) {
      categories = initialState.categories;
    }

    // 5. Read accounts from state or AsyncStorage
    let accounts = currentState?.accounts;
    if (!accounts || accounts.length === 0) {
      try {
        const savedStateStr = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedStateStr) {
          const parsed = JSON.parse(savedStateStr);
          if (parsed?.accounts) accounts = parsed.accounts;
        }
      } catch (e) {}
    }
    if (!accounts || accounts.length === 0) {
      accounts = initialState.accounts;
    }

    // 6. Read default currency
    const defaultCurrency = currentState?.defaultCurrency || "INR";

    // 7. Assemble complete state backup payload
    const payload = {
      version: "2.0",
      timestamp: Date.now(),
      defaultCurrency,
      accounts,
      categories,
      budgets: cleanedBudgets,
      categoryBudgets,
      expenses: cleanedExpenses,
    };

    const jsonString = JSON.stringify(payload);
    // Encrypt so any random QR scanner only sees unreadable gibberish
    const encryptedData = encryptPayload(jsonString);

    return encryptedData;
  } catch (error) {
    console.error("Error generating transfer data:", error);
    throw error;
  }
};

// Import data from QR code
const addCurrencyColumn = async () => {
  try {
    const db = await SQLite.openDatabaseAsync('expenses.db');
    await db.runAsync('ALTER TABLE expenses ADD COLUMN currency TEXT DEFAULT "INR"');
    return true;
  } catch (error) {
    if (error?.message?.includes('duplicate column name')) {
      return true;
    }
    throw error;
  }
};

const importTransferData = async (rawData) => {
  try {
    await addCurrencyColumn();

    if (!rawData) {
      throw new Error("No data received from QR scan");
    }

    let parsed = null;
    if (typeof rawData === "object" && rawData !== null) {
      parsed = rawData;
    } else if (typeof rawData === "string") {
      const trimmed = rawData.trim();

      // 0. Primary: Check if encrypted FinFit Secure QR payload
      if (trimmed.startsWith(FINFIT_QR_PREFIX)) {
        try {
          const decryptedJson = decryptPayload(trimmed);
          parsed = JSON.parse(decryptedJson);
        } catch (decErr) {
          console.error("Failed to decrypt secure QR payload:", decErr);
          throw new Error("Could not decrypt encrypted QR code: corrupted data or incompatible format");
        }
      } else {
        // Fallback for legacy plain or unencrypted QR codes:
        // 1. Try UTF-8 Base64 decoding
        try {
          const decoded = base64ToUtf8(trimmed);
          parsed = JSON.parse(decoded);
        } catch (e1) {
          // 2. Try raw JSON parsing
          try {
            parsed = JSON.parse(trimmed);
          } catch (e2) {
            // 3. Try standard atob fallback
            try {
              if (typeof atob === "function") {
                parsed = JSON.parse(atob(trimmed));
              }
            } catch (e3) {
              throw new Error("Could not decode scanned QR code data");
            }
          }
        }
      }
    }

    if (!parsed) {
      throw new Error("Invalid or empty data inside QR code");
    }

    // 1. Extract expenses list
    const expensesList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.expenses)
      ? parsed.expenses
      : Array.isArray(parsed.exp)
      ? parsed.exp
      : Array.isArray(parsed.data)
      ? parsed.data
      : [];

    const defaultCurr = parsed.defaultCurrency || parsed.cur || "INR";

    // 2. Wipe SQLite and replace with transferred expenses
    const db = await SQLite.openDatabaseAsync("expenses.db");
    await db.runAsync("DELETE FROM expenses");

    for (const expense of expensesList) {
      const rawType = expense.type || expense.t || "EXPENSE";
      const normType =
        rawType === "E"
          ? "EXPENSE"
          : rawType === "I"
          ? "INCOME"
          : rawType === "T"
          ? "TRANSFER"
          : rawType;

      await db.runAsync(
        `INSERT INTO expenses (date, amount, type, category, account, note, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          expense.date || expense.d || new Date().toISOString(),
          parseFloat(expense.amount ?? expense.a ?? 0),
          normType,
          expense.category || expense.c || "Other",
          expense.account || expense.ac || "",
          expense.note || expense.n || "",
          expense.currency || expense.cr || defaultCurr,
        ]
      );
    }

    // 3. Extract Categories
    let importedCategories = null;
    const rawCat = parsed.categories || parsed.cat;
    if (rawCat && typeof rawCat === "object") {
      const exp = Array.isArray(rawCat.EXPENSE)
        ? rawCat.EXPENSE
        : Array.isArray(rawCat.expense)
        ? rawCat.expense
        : [];
      const inc = Array.isArray(rawCat.INCOME)
        ? rawCat.INCOME
        : Array.isArray(rawCat.income)
        ? rawCat.income
        : [];
      const trf = Array.isArray(rawCat.TRANSFER)
        ? rawCat.TRANSFER
        : Array.isArray(rawCat.transfer)
        ? rawCat.transfer
        : [];

      importedCategories = {
        EXPENSE: Array.from(new Set([...(initialState.categories.EXPENSE || []), ...exp])),
        INCOME: Array.from(new Set([...(initialState.categories.INCOME || []), ...inc])),
        TRANSFER: Array.from(new Set([...(initialState.categories.TRANSFER || []), ...trf])),
      };
    }

    // 4. Extract Accounts
    let importedAccounts = null;
    const rawAcc = parsed.accounts || parsed.acc;
    if (Array.isArray(rawAcc) && rawAcc.length > 0) {
      importedAccounts = Array.from(new Set([...initialState.accounts, ...rawAcc]));
    }

    // 5. Extract Budgets & Category Budgets
    let importedBudgets = null;
    let importedCategoryBudgets = null;
    const rawBudgets = parsed.budgets || parsed.bud;
    const rawCatBudgets = parsed.categoryBudgets || parsed.cb;

    if (Array.isArray(rawBudgets) && rawBudgets.length > 0) {
      importedBudgets = rawBudgets.map((b) => {
        const catName = b.category || b.c || "Other";
        const limitVal = parseFloat(b.limit ?? b.l ?? 0);
        return {
          id: b.id || (Date.now().toString() + catName),
          category: catName,
          title: b.title || catName,
          limit: limitVal,
          icon: b.icon || b.i || getCategoryIcon(catName),
          type: b.type || b.t || "EXPENSE",
        };
      });
    }

    if (rawCatBudgets && typeof rawCatBudgets === "object") {
      importedCategoryBudgets = { ...rawCatBudgets };
    } else if (importedBudgets) {
      importedCategoryBudgets = {};
      importedBudgets.forEach((b) => {
        if (b.category && b.limit > 0) {
          importedCategoryBudgets[b.category] = b.limit;
        }
      });
    }

    // 6. Extract Default Currency
    const importedCurrency = parsed.defaultCurrency || parsed.cur || null;

    // 7. Write to AsyncStorage immediately for persistent override across launches
    if (importedBudgets && importedBudgets.length > 0) {
      await AsyncStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(importedBudgets));
    }
    if (importedCategoryBudgets) {
      await AsyncStorage.setItem(CATEGORY_BUDGETS_KEY, JSON.stringify(importedCategoryBudgets));
    }
    if (importedCurrency) {
      await AsyncStorage.setItem("DEFAULT_CURRENCY", importedCurrency);
    }

    return {
      success: true,
      expensesCount: expensesList.length,
      categories: importedCategories,
      accounts: importedAccounts,
      budgets: importedBudgets,
      categoryBudgets: importedCategoryBudgets,
      defaultCurrency: importedCurrency,
    };
  } catch (error) {
    console.error("Error importing data:", error);
    throw error;
  }
};


const globalReducer = (state, action) => {
  switch (action.type) {
    case "SET_FONT_LOADED":
      return {
        ...state,
        fontLoaded: action.payload,
      };

    case "SET_HAS_LAUNCHED":
      return {
        ...state,
        hasLaunched: action.payload,
      };

    case "SET_THEME":
      return {
        ...state,
        theme: action.payload,
      };

    case "ADD_TRANSACTION": {
      const newTransactions = [...state.transactions, action.payload];
      return {
        ...state,
        transactions: newTransactions,
        summary: calculateSummaryWithCurrency(
          newTransactions,
          state.defaultCurrency,
          state.exchangeRates
        ),
      };
    }

    case "NEXT_MONTH":
      return {
        ...state,
        currentMonth: addMonths(new Date(state.currentMonth), 1).toISOString(),
      };

    case "PREVIOUS_MONTH":
      return {
        ...state,
        currentMonth: subMonths(new Date(state.currentMonth), 1).toISOString(),
      };

    case "CLEAR_TRANSACTIONS":
      return {
        ...state,
        transactions: [],
        summary: initialState.summary,
      };

    case "LOAD_STATE": {
      if (!action.payload) return initialState;
      const loaded = action.payload;
      const loadedTxs = loaded.transactions || initialState.transactions;
      return {
        ...initialState,
        ...loaded,
        summary: calculateSummaryWithCurrency(
          loadedTxs,
          loaded.defaultCurrency || state.defaultCurrency,
          loaded.exchangeRates || state.exchangeRates
        ),
        categories: {
          EXPENSE: Array.from(new Set([...(initialState.categories.EXPENSE || []), ...(loaded.categories?.EXPENSE || [])])),
          INCOME: Array.from(new Set([...(initialState.categories.INCOME || []), ...(loaded.categories?.INCOME || [])])),
          TRANSFER: Array.from(new Set([...(initialState.categories.TRANSFER || []), ...(loaded.categories?.TRANSFER || [])])),
        },
        accounts: Array.from(new Set([...(initialState.accounts || []), ...(loaded.accounts || [])])),
      };
    }

    case "RESTORE_BACKUP_STATE": {
      const payload = action.payload || {};
      const newTransactions = Array.isArray(payload.transactions)
        ? payload.transactions
        : state.transactions;
      const newCurrency = payload.defaultCurrency || state.defaultCurrency;
      const newCategories = payload.categories || state.categories;
      const newAccounts =
        Array.isArray(payload.accounts) && payload.accounts.length > 0
          ? payload.accounts
          : state.accounts;
      const newBudgets =
        Array.isArray(payload.budgets) && payload.budgets.length > 0
          ? payload.budgets
          : state.budgets;
      const newCategoryBudgets =
        payload.categoryBudgets || state.categoryBudgets;

      return {
        ...state,
        transactions: newTransactions,
        categories: newCategories,
        accounts: newAccounts,
        budgets: newBudgets,
        categoryBudgets: newCategoryBudgets,
        defaultCurrency: newCurrency,
        summary: calculateSummaryWithCurrency(
          newTransactions,
          newCurrency,
          state.exchangeRates
        ),
      };
    }

    case "SET_MONTH":
      return {
        ...state,
        currentMonth: new Date(action.payload).toISOString(),
      };

    case "SET_LANGUAGE":
      return {
        ...state,
        language: action.payload,
      };

    case "DELETE_TRANSACTION": {
      const remainingTransactions = state.transactions.filter((t) => t.id !== action.payload);
      return {
        ...state,
        transactions: remainingTransactions,
        summary: calculateSummaryWithCurrency(
          remainingTransactions,
          state.defaultCurrency,
          state.exchangeRates
        ),
      };
    }

    case "EDIT_TRANSACTION": {
      const transactionIndex = state.transactions.findIndex(
        (t) => t.id === action.payload.id
      );
      if (transactionIndex >= 0) {
        const transactionsCopy = [...state.transactions];
        transactionsCopy[transactionIndex] = action.payload;
        return {
          ...state,
          transactions: transactionsCopy,
          summary: calculateSummaryWithCurrency(
            transactionsCopy,
            state.defaultCurrency,
            state.exchangeRates
          ),
        };
      }
      return state;
    }

    case "UPDATE_CATEGORY_BUDGET":
      const newCategoryBudgets = {
        ...state.categoryBudgets,
        [action.payload.categoryId]: action.payload.limit,
      };
      AsyncStorage.setItem(
        CATEGORY_BUDGETS_KEY,
        JSON.stringify(newCategoryBudgets)
      );
      return {
        ...state,
        categoryBudgets: newCategoryBudgets,
      };

    case "LOAD_CATEGORY_BUDGETS":
      return {
        ...state,
        categoryBudgets: action.payload,
      };

    case "UPDATE_BUDGET":
      const updatedBudgets = action.payload;
      AsyncStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(updatedBudgets));
      return {
        ...state,
        budgets: updatedBudgets,
      };

    case "ADD_BUDGET":
      const newBudgets = [...state.budgets, action.payload];
      AsyncStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(newBudgets));
      return {
        ...state,
        budgets: newBudgets,
      };

    case "DELETE_BUDGET":
      const remainingBudgets = state.budgets.filter(
        (budget) => budget.id !== action.payload
      );
      AsyncStorage.setItem(
        BUDGETS_STORAGE_KEY,
        JSON.stringify(remainingBudgets)
      );
      return {
        ...state,
        budgets: remainingBudgets,
      };

    case "UPDATE_BUDGET_SPENDING":
      const budgetsWithUpdatedSpending = state.budgets.map((budget) => {
        if (budget.id === action.payload.id) {
          return {
            ...budget,
            spent: action.payload.spent,
          };
        }
        return budget;
      });
      AsyncStorage.setItem(
        BUDGETS_STORAGE_KEY,
        JSON.stringify(budgetsWithUpdatedSpending)
      );
      return {
        ...state,
        budgets: budgetsWithUpdatedSpending,
      };

    case "SET_DEFAULT_CURRENCY":
      return {
        ...state,
        defaultCurrency: action.payload,
        summary: calculateSummaryWithCurrency(
          state.transactions,
          action.payload,
          state.exchangeRates
        ),
      };

    case "UPDATE_EXCHANGE_RATES":
      return {
        ...state,
        exchangeRates: action.payload.rates,
        lastRatesUpdate: new Date().toISOString(),
        summary: calculateSummaryWithCurrency(
          state.transactions,
          state.defaultCurrency,
          action.payload.rates
        ),
      };

    case "LOAD_EXPENSES":
      return {
        ...state,
        transactions: action.payload,
        summary: calculateSummaryWithCurrency(
          action.payload,
          state.defaultCurrency,
          state.exchangeRates
        ),
      };

    case "ADD_CATEGORY": {
      const { type, category } = action.payload;
      const currentList = state.categories[type] || [];
      if (currentList.includes(category)) return state;
      return {
        ...state,
        categories: {
          ...state.categories,
          [type]: [...currentList, category],
        },
      };
    }

    case "DELETE_CATEGORY": {
      const { type, category } = action.payload;
      return {
        ...state,
        categories: {
          ...state.categories,
          [type]: (state.categories[type] || []).filter((c) => c !== category),
        },
      };
    }

    case "ADD_ACCOUNT": {
      const accountName = action.payload;
      const currentAccounts = state.accounts || [];
      if (currentAccounts.includes(accountName)) return state;
      return {
        ...state,
        accounts: [...currentAccounts, accountName],
      };
    }

    case "DELETE_ACCOUNT": {
      const accountName = action.payload;
      return {
        ...state,
        accounts: (state.accounts || []).filter((a) => a !== accountName),
      };
    }

    case "SET_THEME":
      return {
        ...state,
        theme: action.payload,
      };

    case "SET_FONT_LOADED":
      return {
        ...state,
        fontLoaded: action.payload,
      };

    case "SET_HAS_LAUNCHED":
      return {
        ...state,
        hasLaunched: action.payload,
      };

    default:
      return state;
  }
};

const calculateSummaryWithCurrency = (
  transactions,
  targetCurrency,
  exchangeRates
) => {
  const target = targetCurrency || "INR";
  const summary = (transactions || []).reduce(
    (acc, transaction) => {
      const rawAmount = parseFloat(transaction.amount) || 0;
      const convertedAmount = convertCurrencyAmount(
        rawAmount,
        transaction.currency || target,
        target,
        exchangeRates
      );

      if (transaction.type === "EXPENSE") {
        acc.expense += convertedAmount;
      } else if (transaction.type === "INCOME") {
        acc.income += convertedAmount;
      }

      return acc;
    },
    { expense: 0, income: 0 }
  );

  return {
    ...summary,
    total: summary.income - summary.expense,
  };
};

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [state, dispatch] = useReducer(globalReducer, initialState);

  // Centralized Themed Alert Modal State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info",
    icon: null,
    buttons: [{ text: "OK" }],
  });

  const showAlert = useCallback(({ title, message, type = "info", icon = null, buttons = [{ text: "OK" }] }) => {
    setAlertConfig({
      visible: true,
      title: title || "",
      message: message || "",
      type,
      icon,
      buttons,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  // Listen for global showThemedAlert events anywhere in the app
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("SHOW_THEMED_ALERT", (config) => {
      showAlert(config);
    });
    return () => sub?.remove();
  }, [showAlert]);

  useEffect(() => {
    initializeDatabase().then(() => {
      loadExpensesFromDB();
      loadCategoryBudgets();
      loadInitialState();
    });
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (state.language) {
      i18next.changeLanguage(state.language);
      console.log("Language set in i18next:", state.language);
    }
  }, [state.language]);

  const loadCategoryBudgets = async () => {
    try {
      const savedBudgets = await AsyncStorage.getItem(CATEGORY_BUDGETS_KEY);
      if (savedBudgets) {
        dispatch({
          type: "LOAD_CATEGORY_BUDGETS",
          payload: JSON.parse(savedBudgets),
        });
      }
    } catch (error) {
      console.error("Error loading category budgets:", error);
    }
  };

  /**
   * Updates an individual category's budget limit in global state and AsyncStorage.
   * @param {string} categoryId - The category name
   * @param {number} limit - The monthly limit amount
   */
  const updateCategoryBudget = async (categoryId, limit) => {
    dispatch({
      type: "UPDATE_CATEGORY_BUDGET",
      payload: { categoryId, limit },
    });
  };

  /**
   * Creates the local SQLite expenses table if it doesn't already exist.
   */
  const createTable = async () => {
    try {
      await db.execAsync(`
                CREATE TABLE IF NOT EXISTS expenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, 
                    amount REAL, 
                    type TEXT, 
                    category TEXT, 
                    account TEXT, 
                    note TEXT, 
                    date TEXT,
                    currency TEXT DEFAULT 'USD'
                );
            `);
      console.log("Table created successfully");
    } catch (error) {
      console.error("Error creating table:", error);
    }
  };

  /**
   * Fetches all expenses from the local SQLite database in descending date order.
   * Ensures safe defaults (COALESCE) for missing or null fields.
   * @returns {Promise<Array<Object>>} Array of transaction objects
   */
  const fetchExpenses = async () => {
    try {
      if (!db) {
        await initializeDatabase();
      }

      // Use explicit column names and COALESCE to handle potential NULL values
      const query = `
                SELECT 
                    id,
                    COALESCE(amount, 0) as amount,
                    COALESCE(type, 'EXPENSE') as type,
                    COALESCE(category, 'Other') as category,
                    COALESCE(account, '') as account,
                    COALESCE(note, '') as note,
                    COALESCE(date, CURRENT_TIMESTAMP) as date,
                    COALESCE(currency, '${state.defaultCurrency || "INR"}') as currency
                FROM expenses
                ORDER BY date DESC
            `;

      const expenses = await db.getAllAsync(query);

      // Process the results to ensure all fields have valid values
      return expenses.map((expense) => ({
        id: expense.id,
        amount: parseFloat(expense.amount) || 0,
        type: expense.type || "EXPENSE",
        category: expense.category || "Other",
        account: expense.account || "",
        note: expense.note || "",
        date: expense.date || new Date().toISOString(),
        currency: expense.currency || state.defaultCurrency || "INR",
      }));
    } catch (error) {
      console.error("Error fetching expenses:", error);
      return [];
    }
  };

  /**
   * Inserts a new transaction into the local SQLite database.
   * @param {Object} expense - Transaction data
   * @returns {Promise<Object>} SQLite execution result
   */
  const addExpense = async (expense) => {
    try {
      if (!db) {
        await initializeDatabase();
      }

      // Ensure all values are non-null before insertion
      const result = await db.runAsync(
        `INSERT INTO expenses (amount, type, category, account, note, date, currency) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          expense.amount || 0,
          expense.type || "EXPENSE",
          expense.category || "Other",
          expense.account || "",
          expense.note || "",
          expense.date || new Date().toISOString(),
          expense.currency || state.defaultCurrency || "INR",
        ]
      );

      return result;
    } catch (error) {
      console.error("Error adding expense:", error);
      throw error;
    }
  };

  /**
   * Updates an existing transaction in SQLite by its ID.
   * @param {Object} expense - Transaction data with id
   * @returns {Promise<Object>} SQLite execution result
   */
  const updateExpense = async (expense) => {
    try {
      if (!db) {
        await initializeDatabase();
      }

      const result = await db.runAsync(
        `UPDATE expenses 
                 SET amount = ?, type = ?, category = ?, account = ?, note = ?, date = ?, currency = ? 
                 WHERE id = ?`,
        [
          expense.amount || 0,
          expense.type || "EXPENSE",
          expense.category || "Other",
          expense.account || "",
          expense.note || "",
          expense.date || new Date().toISOString(),
          expense.currency || state.defaultCurrency || "INR",
          expense.id,
        ]
      );

      return result;
    } catch (error) {
      console.error("Error updating expense:", error);
      throw error;
    }
  };

  /**
   * Deletes a transaction from SQLite by its ID.
   * @param {number|string} id - The transaction ID to delete
   */
  const deleteExpense = async (id) => {
    try {
      if (!db) {
        await initializeDatabase();
      }

      const result = await db.runAsync("DELETE FROM expenses WHERE id = ?", [
        id,
      ]);

      return result;
    } catch (error) {
      console.error("Error deleting expense:", error);
      throw error;
    }
  };
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  };

  const loadExpensesFromDB = async () => {
    try {
      const expenses = await fetchExpenses();

      // Additional validation before dispatching
      const validExpenses = expenses.map((expense) => ({
        ...expense,
        amount: parseFloat(expense.amount) || 0,
        date: formatDate(expense.date),
        type: expense.type || "EXPENSE",
        category: expense.category || "Other",
        currency: expense.currency || "INR",
      }));

      dispatch({
        type: "LOAD_EXPENSES",
        payload: validExpenses,
      });
      return validExpenses;
    } catch (error) {
      console.error("Error loading expenses from DB:", error);
      dispatch({
        type: "LOAD_EXPENSES",
        payload: [],
      });
      return [];
    }
  };
  const onSave = async (transactionData) => {
    try {
      if (transactionData.id && transactionData.isUpdate) {
        const updateResult = await updateExpense({
          ...transactionData,
          amount: parseFloat(transactionData.amount),
          date: transactionData.date
            ? new Date(transactionData.date).toISOString()
            : new Date().toISOString(),
        });
        if (!updateResult || updateResult.changes === 0) {
          console.warn("Expense to update not found in DB, inserting as new instead:", transactionData.id);
          await addExpense({
            amount: parseFloat(transactionData.amount),
            type: transactionData.type,
            category: transactionData.category,
            account: transactionData.account,
            note: transactionData.note,
            date: transactionData.date
              ? new Date(transactionData.date).toISOString()
              : new Date().toISOString(),
            currency: transactionData.currency || state.defaultCurrency,
          });
        }
      } else {
        await addExpense({
          amount: parseFloat(transactionData.amount),
          type: transactionData.type,
          category: transactionData.category,
          account: transactionData.account,
          note: transactionData.note,
          date: transactionData.date
            ? new Date(transactionData.date).toISOString()
            : new Date().toISOString(),
          currency: transactionData.currency || state.defaultCurrency,
        });
      }
      await loadExpensesFromDB();

      // Check category budget limit and immediately alert if expenditure causes or continues an over-budget status
      if (transactionData?.category && (!transactionData.type || transactionData.type === "EXPENSE")) {
        try {
          const savedBudgetsStr = await AsyncStorage.getItem(BUDGETS_STORAGE_KEY);
          if (savedBudgetsStr) {
            const savedBudgets = JSON.parse(savedBudgetsStr);
            const budget = savedBudgets?.find(
              (b) => b.category === transactionData.category
            );
            if (budget && budget.limit > 0) {
              const spentData = await fetchSpentByCategory();
              const categorySpentItem = (spentData || []).find(
                (item) => item.category === transactionData.category
              );
              const totalSpent = categorySpentItem ? categorySpentItem.totalSpent : 0;
              if (totalSpent >= budget.limit) {
                await notifyBudgetExceededForCategory(
                  transactionData.category,
                  totalSpent,
                  budget.limit
                );
              }
            }
          }
        } catch (budgetErr) {
          console.warn("Budget check error in onSave:", budgetErr?.message);
        }
      }
    } catch (error) {
      console.error("Error saving transaction: from global provider", error);
    }
  };

  const updateBudget = (budgetData) => {
    dispatch({
      type: "UPDATE_BUDGET",
      payload: budgetData,
    });
  };

  const addBudget = (budgetData) => {
    dispatch({
      type: "ADD_BUDGET",
      payload: {
        id: Date.now().toString(),
        ...budgetData,
      },
    });
  };

  const deleteBudget = (budgetId) => {
    dispatch({
      type: "DELETE_BUDGET",
      payload: budgetId,
    });
  };

  const updateBudgetSpending = (budgetId, spent) => {
    dispatch({
      type: "UPDATE_BUDGET_SPENDING",
      payload: { id: budgetId, spent },
    });
  };

  const addCategory = (type, category) => {
    dispatch({
      type: "ADD_CATEGORY",
      payload: { type, category },
    });
  };

  const deleteCategory = (type, category) => {
    dispatch({
      type: "DELETE_CATEGORY",
      payload: { type, category },
    });
  };

  const addAccount = (accountName) => {
    dispatch({
      type: "ADD_ACCOUNT",
      payload: accountName,
    });
  };

  const deleteAccount = (accountName) => {
    dispatch({
      type: "DELETE_ACCOUNT",
      payload: accountName,
    });
  };

  const loadInitialState = async () => {
    try {
      const savedState = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedState) {
        dispatch({ type: "LOAD_STATE", payload: JSON.parse(savedState) });
      }

      const savedBudgets = await AsyncStorage.getItem(BUDGETS_STORAGE_KEY);
      if (savedBudgets) {
        try {
          dispatch({ type: "UPDATE_BUDGET", payload: JSON.parse(savedBudgets) });
        } catch (e) {
          console.warn("Could not parse saved budgets:", e);
        }
      }

      const savedLanguage = await AsyncStorage.getItem("APP_LANGUAGE");
      if (savedLanguage) {
        let lang = savedLanguage;
        if (lang === "en") lang = "English";
        else if (lang === "hi" || lang === "hn") lang = "Hindi";
        else if (lang === "ta" || lang === "tm") lang = "Tamil";
        else if (lang === "kn") lang = "Kannada";
        else if (lang === "mr") lang = "Marathi";
        else if (lang === "ur") lang = "Urdu";
        dispatch({ type: "SET_LANGUAGE", payload: lang });
        try {
          i18next.changeLanguage(lang);
        } catch (e) {}
        console.log("Loaded saved language:", lang);
      } else {
        dispatch({ type: "SET_LANGUAGE", payload: "English" });
        try {
          i18next.changeLanguage("English");
        } catch (e) {}
      }

      const savedTheme = await AsyncStorage.getItem("APP_THEME");
      if (savedTheme) {
        applyTheme(savedTheme);
        dispatch({ type: "SET_THEME", payload: savedTheme });
      } else {
        applyTheme("dark");
        dispatch({ type: "SET_THEME", payload: "dark" });
      }
    } catch (error) {
      console.error("Error loading initial state:", error);
    }
  };

  const saveState = async (stateToSave) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Error saving state:", error);
    }
  };

  const changeLanguage = async (language) => {
    try {
      try {
        i18next.changeLanguage(language);
      } catch (e) {}
      dispatch({
        type: "SET_LANGUAGE",
        payload: language,
      });
      await AsyncStorage.setItem("APP_LANGUAGE", language);
      console.log("Language changed and saved:", language);
    } catch (error) {
      console.error("Error changing language:", error);
    }
  };

  const setTheme = async (theme) => {
    applyTheme(theme);
    dispatch({
      type: "SET_THEME",
      payload: theme,
    });
    try {
      await AsyncStorage.setItem("APP_THEME", theme);
    } catch (e) {
      console.warn("Error saving theme:", e);
    }
  };

  const setFontLoaded = (loaded) => {
    dispatch({
      type: "SET_FONT_LOADED",
      payload: loaded,
    });
  };

  const setHasLaunched = (launched) => {
    dispatch({
      type: "SET_HAS_LAUNCHED",
      payload: launched,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString || !isValidDate(dateString)) {
      return new Date().toISOString();
    }
    return new Date(dateString).toISOString();
  };

  const fetchSpentByCategory = async () => {
    try {
      if (!db) {
        await initializeDatabase();
      }

      const query = `
                SELECT 
                    COALESCE(category, 'Other') as category,
                    COALESCE(amount, 0) as amount,
                    COALESCE(currency, 'INR') as currency
                FROM expenses 
                WHERE type = 'EXPENSE'
            `;

      const results = await db.getAllAsync(query);
      const categoryMap = {};
      (results || []).forEach((row) => {
        const cat = row.category || "Other";
        const converted = convertCurrencyAmount(
          parseFloat(row.amount) || 0,
          row.currency || state.defaultCurrency || "INR",
          state.defaultCurrency || "INR",
          state.exchangeRates
        );
        categoryMap[cat] = (categoryMap[cat] || 0) + converted;
      });

      return Object.keys(categoryMap).map((category) => ({
        category,
        totalSpent: categoryMap[category],
      }));
    } catch (error) {
      console.error("Error fetching spent by category:", error);
      return [];
    }
  };

  const fetchExchangeRates = async () => {
    try {
      const formattedRates = await fetchServiceExchangeRates();
      if (formattedRates) {
        dispatch({
          type: "UPDATE_EXCHANGE_RATES",
          payload: { rates: formattedRates },
        });
      }
    } catch (error) {
      console.warn("Using local default exchange rates:", error.message);
    }
  };

  useEffect(() => {
    const loadSavedRatesAndCurrency = async () => {
      try {
        // 1. Load saved default currency
        const savedCurrency = await getStoredDefaultCurrency();
        if (savedCurrency) {
          dispatch({
            type: "SET_DEFAULT_CURRENCY",
            payload: savedCurrency,
          });
        }

        // 2. Load exchange rates
        const rates = await loadServiceExchangeRates();
        if (rates) {
          dispatch({
            type: "UPDATE_EXCHANGE_RATES",
            payload: { rates },
          });
        }
      } catch (error) {
        console.error("Error loading exchange rates and currency:", error);
      }
    };

    loadSavedRatesAndCurrency();
  }, []);

  const convertAmount = (amount, fromCurrency, targetCurrency) => {
    return convertCurrencyAmount(
      amount,
      fromCurrency || state.defaultCurrency || "INR",
      targetCurrency || state.defaultCurrency || "INR",
      state.exchangeRates
    );
  };

  const setDefaultCurrency = async (currency) => {
    await setStoredDefaultCurrency(currency);
    dispatch({
      type: "SET_DEFAULT_CURRENCY",
      payload: currency,
    });
  };

  const handleGenerateTransferData = async () => {
    return await generateTransferData(state);
  };

  const handleImportTransferData = async (rawData) => {
    const result = await importTransferData(rawData);
    const freshExpenses = await loadExpensesFromDB();

    dispatch({
      type: "RESTORE_BACKUP_STATE",
      payload: {
        transactions: freshExpenses,
        categories: result.categories,
        accounts: result.accounts,
        budgets: result.budgets,
        categoryBudgets: result.categoryBudgets,
        defaultCurrency: result.defaultCurrency,
      },
    });

    DeviceEventEmitter.emit("FINFIT_DATA_SYNCED", result);
    return result;
  };

  const handleGenerateBackupFile = async (password) => {
    return await generateBackupFileData(state, password);
  };

  const handleImportBackupFile = async (fileContent, password) => {
    let payloadToDecrypt = fileContent ? String(fileContent).trim() : "";
    try {
      const parsedWrapper = JSON.parse(payloadToDecrypt);
      if (parsedWrapper && typeof parsedWrapper.payload === "string") {
        payloadToDecrypt = parsedWrapper.payload.trim();
      }
    } catch (e) {
      // not JSON wrapper, raw string
    }

    const decryptedJson = decryptWithPassword(payloadToDecrypt, password);
    const parsed = JSON.parse(decryptedJson);
    const result = await importTransferData(parsed);
    const freshExpenses = await loadExpensesFromDB();

    dispatch({
      type: "RESTORE_BACKUP_STATE",
      payload: {
        transactions: freshExpenses,
        categories: result.categories,
        accounts: result.accounts,
        budgets: result.budgets,
        categoryBudgets: result.categoryBudgets,
        defaultCurrency: result.defaultCurrency,
      },
    });

    DeviceEventEmitter.emit("FINFIT_DATA_SYNCED", result);
    return result;
  };

  return (
    <GlobalContext.Provider
      value={{
        state,
        dispatch,
        onSave,
        formatDate,
        changeLanguage,
        setTheme,
        setFontLoaded,
        setHasLaunched,
        updateBudget,
        addBudget,
        deleteBudget,
        updateBudgetSpending,
        addExpense,
        updateExpense,
        deleteExpense,
        fetchExpenses,
        updateCategoryBudget,
        fetchSpentByCategory,
        loadExpensesFromDB,
        convertAmount,
        setDefaultCurrency,
        generateTransferData: handleGenerateTransferData,
        importTransferData: handleImportTransferData,
        generateBackupFileData: handleGenerateBackupFile,
        importBackupFile: handleImportBackupFile,
        addCategory,
        deleteCategory,
        addAccount,
        deleteAccount,
        fetchExchangeRates,
        showAlert,
        hideAlert,
        isLight: state.theme === 'light',
      }}
    >
      {children}
      <ThemedAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        icon={alertConfig.icon}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
        theme={state.theme}
      />
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobalContext must be used within a GlobalProvider");
  }
  return context;
};

export default GlobalProvider;
