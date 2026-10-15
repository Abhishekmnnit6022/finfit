//globalProvider.jsx

import React, { createContext, useReducer, useContext, useEffect } from "react";
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

const STORAGE_KEY = "APP_STATE";
const BUDGETS_STORAGE_KEY = "APP_BUDGETS";
const CATEGORY_BUDGETS_KEY = "CATEGORY_BUDGETS";
const EXCHANGE_RATES_KEY = "EXCHANGE_RATES";

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
  theme: "light",
  fontLoaded: false,
  hasLaunched: false,
  defaultCurrency: "INR",
  currencies: {
    AED: { symbol: "د.إ", name: "United Arab Emirates Dirham" },
    AFN: { symbol: "؋", name: "Afghan Afghani" },
    ALL: { symbol: "L", name: "Albanian Lek" },
    AMD: { symbol: "֏", name: "Armenian Dram" },
    ANG: { symbol: "ƒ", name: "Netherlands Antillean Guilder" },
    AOA: { symbol: "Kz", name: "Angolan Kwanza" },
    ARS: { symbol: "$", name: "Argentine Peso" },
    AUD: { symbol: "A$", name: "Australian Dollar" },
    AWG: { symbol: "ƒ", name: "Aruban Florin" },
    AZN: { symbol: "₼", name: "Azerbaijani Manat" },
    BAM: { symbol: "KM", name: "Bosnia-Herzegovina Convertible Mark" },
    BBD: { symbol: "$", name: "Barbadian Dollar" },
    BDT: { symbol: "৳", name: "Bangladeshi Taka" },
    BGN: { symbol: "лв", name: "Bulgarian Lev" },
    BHD: { symbol: ".د.ب", name: "Bahraini Dinar" },
    BIF: { symbol: "FBu", name: "Burundian Franc" },
    BMD: { symbol: "$", name: "Bermudan Dollar" },
    BND: { symbol: "$", name: "Brunei Dollar" },
    BOB: { symbol: "Bs.", name: "Bolivian Boliviano" },
    BRL: { symbol: "R$", name: "Brazilian Real" },
    BSD: { symbol: "$", name: "Bahamian Dollar" },
    BTN: { symbol: "Nu.", name: "Bhutanese Ngultrum" },
    BWP: { symbol: "P", name: "Botswanan Pula" },
    BYN: { symbol: "Br", name: "Belarusian Ruble" },
    BZD: { symbol: "BZ$", name: "Belize Dollar" },
    CAD: { symbol: "C$", name: "Canadian Dollar" },
    CDF: { symbol: "FC", name: "Congolese Franc" },
    CHF: { symbol: "Fr", name: "Swiss Franc" },
    CLP: { symbol: "$", name: "Chilean Peso" },
    CNY: { symbol: "¥", name: "Chinese Yuan" },
    COP: { symbol: "$", name: "Colombian Peso" },
    CRC: { symbol: "₡", name: "Costa Rican Colón" },
    CUP: { symbol: "₱", name: "Cuban Peso" },
    CVE: { symbol: "$", name: "Cape Verdean Escudo" },
    CZK: { symbol: "Kč", name: "Czech Koruna" },
    DJF: { symbol: "Fdj", name: "Djiboutian Franc" },
    DKK: { symbol: "kr", name: "Danish Krone" },
    DOP: { symbol: "RD$", name: "Dominican Peso" },
    DZD: { symbol: "د.ج", name: "Algerian Dinar" },
    EGP: { symbol: "E£", name: "Egyptian Pound" },
    ERN: { symbol: "Nfk", name: "Eritrean Nakfa" },
    ETB: { symbol: "Br", name: "Ethiopian Birr" },
    EUR: { symbol: "€", name: "Euro" },
    FJD: { symbol: "FJ$", name: "Fijian Dollar" },
    FKP: { symbol: "£", name: "Falkland Islands Pound" },
    GBP: { symbol: "£", name: "British Pound Sterling" },
    GEL: { symbol: "₾", name: "Georgian Lari" },
    GHS: { symbol: "GH₵", name: "Ghanaian Cedi" },
    GIP: { symbol: "£", name: "Gibraltar Pound" },
    GMD: { symbol: "D", name: "Gambian Dalasi" },
    GNF: { symbol: "FG", name: "Guinean Franc" },
    GTQ: { symbol: "Q", name: "Guatemalan Quetzal" },
    GYD: { symbol: "$", name: "Guyanaese Dollar" },
    HKD: { symbol: "HK$", name: "Hong Kong Dollar" },
    HNL: { symbol: "L", name: "Honduran Lempira" },
    HRK: { symbol: "kn", name: "Croatian Kuna" },
    HTG: { symbol: "G", name: "Haitian Gourde" },
    HUF: { symbol: "Ft", name: "Hungarian Forint" },
    IDR: { symbol: "Rp", name: "Indonesian Rupiah" },
    ILS: { symbol: "₪", name: "Israeli New Shekel" },
    INR: { symbol: "₹", name: "Indian Rupee" },
    IQD: { symbol: "ع.د", name: "Iraqi Dinar" },
    IRR: { symbol: "﷼", name: "Iranian Rial" },
    ISK: { symbol: "kr", name: "Icelandic Króna" },
    JMD: { symbol: "J$", name: "Jamaican Dollar" },
    JOD: { symbol: "د.ا", name: "Jordanian Dinar" },
    JPY: { symbol: "¥", name: "Japanese Yen" },
    KES: { symbol: "KSh", name: "Kenyan Shilling" },
    KGS: { symbol: "лв", name: "Kyrgystani Som" },
    KHR: { symbol: "៛", name: "Cambodian Riel" },
    KMF: { symbol: "CF", name: "Comorian Franc" },
    KPW: { symbol: "₩", name: "North Korean Won" },
    KRW: { symbol: "₩", name: "South Korean Won" },
    KWD: { symbol: "د.ك", name: "Kuwaiti Dinar" },
    KYD: { symbol: "$", name: "Cayman Islands Dollar" },
    KZT: { symbol: "₸", name: "Kazakhstani Tenge" },
    LAK: { symbol: "₭", name: "Laotian Kip" },
    LBP: { symbol: "ل.ل", name: "Lebanese Pound" },
    LKR: { symbol: "Rs", name: "Sri Lankan Rupee" },
    LRD: { symbol: "$", name: "Liberian Dollar" },
    LSL: { symbol: "L", name: "Lesotho Loti" },
    LYD: { symbol: "ل.د", name: "Libyan Dinar" },
    MAD: { symbol: "د.م.", name: "Moroccan Dirham" },
    MDL: { symbol: "L", name: "Moldovan Leu" },
    MGA: { symbol: "Ar", name: "Malagasy Ariary" },
    MKD: { symbol: "ден", name: "Macedonian Denar" },
    MMK: { symbol: "K", name: "Myanmar Kyat" },
    MNT: { symbol: "₮", name: "Mongolian Tugrik" },
    MOP: { symbol: "MOP$", name: "Macanese Pataca" },
    MRU: { symbol: "UM", name: "Mauritanian Ouguiya" },
    MUR: { symbol: "₨", name: "Mauritian Rupee" },
    MVR: { symbol: "Rf", name: "Maldivian Rufiyaa" },
    MWK: { symbol: "MK", name: "Malawian Kwacha" },
    MXN: { symbol: "$", name: "Mexican Peso" },
    MYR: { symbol: "RM", name: "Malaysian Ringgit" },
    MZN: { symbol: "MT", name: "Mozambican Metical" },
    NAD: { symbol: "$", name: "Namibian Dollar" },
    NGN: { symbol: "₦", name: "Nigerian Naira" },
    NIO: { symbol: "C$", name: "Nicaraguan Córdoba" },
    NOK: { symbol: "kr", name: "Norwegian Krone" },
    NPR: { symbol: "₨", name: "Nepalese Rupee" },
    NZD: { symbol: "$", name: "New Zealand Dollar" },
    OMR: { symbol: "﷼", name: "Omani Rial" },
    PAB: { symbol: "B/.", name: "Panamanian Balboa" },
    PEN: { symbol: "S/.", name: "Peruvian Nuevo Sol" },
    PGK: { symbol: "K", name: "Papua New Guinean Kina" },
    PHP: { symbol: "₱", name: "Philippine Peso" },
    PKR: { symbol: "₨", name: "Pakistani Rupee" },
    PLN: { symbol: "zł", name: "Polish Złoty" },
    PYG: { symbol: "₲", name: "Paraguayan Guarani" },
    QAR: { symbol: "ر.ق", name: "Qatari Rial" },
    RON: { symbol: "lei", name: "Romanian Leu" },
    RSD: { symbol: "дин.", name: "Serbian Dinar" },
    RUB: { symbol: "₽", name: "Russian Ruble" },
    RWF: { symbol: "FRw", name: "Rwandan Franc" },
    SAR: { symbol: "﷼", name: "Saudi Riyal" },
    SBD: { symbol: "$", name: "Solomon Islands Dollar" },
    SCR: { symbol: "₨", name: "Seychellois Rupee" },
    SDG: { symbol: "ج.س.", name: "Sudanese Pound" },
    SEK: { symbol: "kr", name: "Swedish Krona" },
    SGD: { symbol: "S$", name: "Singapore Dollar" },
    SHP: { symbol: "£", name: "Saint Helena Pound" },
    SLL: { symbol: "Le", name: "Sierra Leonean Leone" },
    SOS: { symbol: "S", name: "Somali Shilling" },
    SRD: { symbol: "$", name: "Surinamese Dollar" },
    STN: { symbol: "Db", name: "São Tomé and Príncipe Dobra" },
    SVC: { symbol: "$", name: "Salvadoran Colón" },
    SYP: { symbol: "£", name: "Syrian Pound" },
    SZL: { symbol: "L", name: "Swazi Lilangeni" },
    THB: { symbol: "฿", name: "Thai Baht" },
    TJS: { symbol: "SM", name: "Tajikistani Somoni" },
    TMT: { symbol: "T", name: "Turkmenistani Manat" },
    TND: { symbol: "د.ت", name: "Tunisian Dinar" },
    TOP: { symbol: "T$", name: "Tongan Paʻanga" },
    TRY: { symbol: "₺", name: "Turkish Lira" },
    TTD: { symbol: "TT$", name: "Trinidad and Tobago Dollar" },
    TWD: { symbol: "NT$", name: "New Taiwan Dollar" },
    TZS: { symbol: "TSh", name: "Tanzanian Shilling" },
    UAH: { symbol: "₴", name: "Ukrainian Hryvnia" },
    UGX: { symbol: "USh", name: "Ugandan Shilling" },
    USD: { symbol: "$", name: "United States Dollar" },
    UYU: { symbol: "$U", name: "Uruguayan Peso" },
    UZS: { symbol: "лв", name: "Uzbekistan Som" },
    VES: { symbol: "Bs", name: "Venezuelan Bolívar" },
    VND: { symbol: "₫", name: "Vietnamese Dong" },
    VUV: { symbol: "VT", name: "Vanuatu Vatu" },
    WST: { symbol: "WS$", name: "Samoan Tala" },
    XAF: { symbol: "FCFA", name: "Central African CFA Franc" },
    XCD: { symbol: "$", name: "East Caribbean Dollar" },
    XOF: { symbol: "CFA", name: "West African CFA Franc" },
    XPF: { symbol: "₣", name: "CFP Franc" },
    YER: { symbol: "﷼", name: "Yemeni Rial" },
    ZAR: { symbol: "R", name: "South African Rand" },
    ZMW: { symbol: "ZK", name: "Zambian Kwacha" },
    ZWL: { symbol: "$", name: "Zimbabwean Dollar" },
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

// Generate QR data from SQLite database (encrypted gibberish for third-party scanners)
const generateTransferData = async () => {
  try {
    const db = await SQLite.openDatabaseAsync("expenses.db");

    // Get all expenses from database
    const expenses = await db.getAllAsync("SELECT * FROM expenses ORDER BY date DESC");

    // Clean and normalize expenses for QR transfer
    const cleanedExpenses = (expenses || []).map((e) => ({
      amount: parseFloat(e.amount) || 0,
      type: e.type || "EXPENSE",
      category: e.category || "Other",
      account: e.account || "",
      note: e.note || "",
      date: e.date || new Date().toISOString(),
      currency: e.currency || "INR",
    }));

    const payload = {
      timestamp: Date.now(),
      expenses: cleanedExpenses,
      version: "1.0",
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

    // Support array of expenses directly or wrapped in { expenses: [...] }
    const expensesList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.expenses)
      ? parsed.expenses
      : Array.isArray(parsed.data)
      ? parsed.data
      : [];

    const db = await SQLite.openDatabaseAsync("expenses.db");
    await db.runAsync("DELETE FROM expenses");

    for (const expense of expensesList) {
      await db.runAsync(
        `INSERT INTO expenses (date, amount, type, category, account, note, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          expense.date || expense.d || new Date().toISOString(),
          parseFloat(expense.amount ?? expense.a ?? 0),
          expense.type || expense.t || "EXPENSE",
          expense.category || expense.c || "Other",
          expense.account || expense.ac || "",
          expense.note || expense.n || "",
          expense.currency || expense.cr || "INR",
        ]
      );
    }

    return true;
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

  const updateCategoryBudget = async (categoryId, limit) => {
    dispatch({
      type: "UPDATE_CATEGORY_BUDGET",
      payload: { categoryId, limit },
    });
  };

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
    } catch (error) {
      console.error("Error loading expenses from DB:", error);
      dispatch({
        type: "LOAD_EXPENSES",
        payload: [],
      });
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
        console.log("Loaded saved language:", lang);
      } else {
        dispatch({ type: "SET_LANGUAGE", payload: "English" });
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

  const setTheme = (theme) => {
    dispatch({
      type: "SET_THEME",
      payload: theme,
    });
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

  const handleImportTransferData = async (rawData) => {
    const result = await importTransferData(rawData);
    await loadExpensesFromDB();
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
        generateTransferData,
        importTransferData: handleImportTransferData,
        addCategory,
        deleteCategory,
        addAccount,
        deleteAccount,
        fetchExchangeRates,
      }}
    >
      {children}
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
