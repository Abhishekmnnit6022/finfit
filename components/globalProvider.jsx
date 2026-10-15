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

// Generate QR data from SQLite database
const generateTransferData = async () => {
  try {
    // Open the database
    const db = await SQLite.openDatabaseAsync("expenses.db");

    // Get all expenses using getAllAsync
    const expenses = await db.getAllAsync("SELECT * FROM expenses");

    // Create the data object
    const data = {
      timestamp: Date.now(),
      expenses: expenses,
      version: "1.0",
    };

    // Convert to JSON and then to base64
    const jsonString = JSON.stringify(data);
    const base64Data = btoa(jsonString);

    return base64Data;
  } catch (error) {
    console.error("Error generating transfer data:", error);
    throw error;
  }
};

// Import data from QR code
// First, add the missing column to your table
const addCurrencyColumn = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('expenses.db');
      await db.runAsync('ALTER TABLE expenses ADD COLUMN currency TEXT DEFAULT "INR"');
      return true;
    } catch (error) {
      // If error is about column already existing, that's fine
      if (error.message.includes('duplicate column name')) {
        return true;
      }
      throw error;
    }
  };
  const importTransferData = async (base64Data) => {
    try {
      // First ensure the currency column exists
      await addCurrencyColumn();
      
      // Rest of your existing code
      const jsonString = atob(base64Data);
      const data = JSON.parse(jsonString);
      
      if (!data.expenses || !Array.isArray(data.expenses)) {
        throw new Error('Invalid data format');
      }
      
      const db = await SQLite.openDatabaseAsync('expenses.db');
      await db.runAsync('DELETE FROM expenses');
      
      for (const expense of data.expenses) {
        await db.runAsync(
          `INSERT INTO expenses (date, amount, type, category, account, note, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            expense.date || new Date().toISOString(),
            expense.amount || 0,
            expense.type || 'EXPENSE',
            expense.category || 'Other',
            expense.account || '',
            expense.note || '',
            expense.currency || 'INR'
          ]
        );
      }
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
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

    case "ADD_TRANSACTION":
      return {
        ...state,
        transactions: [...state.transactions, action.payload],
      };

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
      return {
        ...initialState,
        ...loaded,
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

    case "DELETE_TRANSACTION":
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
      };

    case "EDIT_TRANSACTION":
      const transactionIndex = state.transactions.findIndex(
        (t) => t.id === action.payload.id
      );
      if (transactionIndex >= 0) {
        const transactionsCopy = [...state.transactions];
        transactionsCopy[transactionIndex] = action.payload;
        return {
          ...state,
          transactions: transactionsCopy,
        };
      }
      return state;

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

      const savedLanguage = await AsyncStorage.getItem("APP_LANGUAGE");
      if (savedLanguage) {
        let lang = savedLanguage;
        if (lang === "en") lang = "English";
        else if (lang === "hi" || lang === "hn") lang = "Hindi";
        else if (lang === "ta" || lang === "tm") lang = "Tamil";
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
        importTransferData,
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
