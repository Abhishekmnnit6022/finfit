import AsyncStorage from '@react-native-async-storage/async-storage';
import remoteConfig from './remoteConfig';

const EXCHANGE_RATES_KEY = 'EXCHANGE_RATES';
const DEFAULT_CURRENCY_KEY = 'DEFAULT_CURRENCY';

export const currencies = {
    INR: { symbol: '₹', name: 'Indian Rupee' },
    USD: { symbol: '$', name: 'US Dollar' },
    EUR: { symbol: '€', name: 'Euro' },
    GBP: { symbol: '£', name: 'British Pound' },
    AED: { symbol: 'د.إ', name: 'UAE Dirham' },
    SAR: { symbol: '﷼', name: 'Saudi Riyal' },
    CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
    AUD: { symbol: 'A$', name: 'Australian Dollar' },
    SGD: { symbol: 'S$', name: 'Singapore Dollar' },
    KWD: { symbol: 'د.ك', name: 'Kuwaiti Dinar' },
    QAR: { symbol: 'ر.ق', name: 'Qatari Rial' },
    OMR: { symbol: 'ر.ع.', name: 'Omani Rial' },
    BHD: { symbol: 'BD', name: 'Bahraini Dinar' },
    JPY: { symbol: '¥', name: 'Japanese Yen' },
    CNY: { symbol: '¥', name: 'Chinese Yuan' },
    CHF: { symbol: 'CHF', name: 'Swiss Franc' },
    RUB: { symbol: '₽', name: 'Russian Ruble' },
    BRL: { symbol: 'R$', name: 'Brazilian Real' },
    ZAR: { symbol: 'R', name: 'South African Rand' },
    PKR: { symbol: '₨', name: 'Pakistani Rupee' },
    BDT: { symbol: '৳', name: 'Bangladeshi Taka' },
    LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee' },
    NPR: { symbol: 'रू', name: 'Nepalese Rupee' },
    NZD: { symbol: 'NZ$', name: 'New Zealand Dollar' },
    THB: { symbol: '฿', name: 'Thai Baht' },
    MYR: { symbol: 'RM', name: 'Malaysian Ringgit' },
    IDR: { symbol: 'Rp', name: 'Indonesian Rupiah' },
    KRW: { symbol: '₩', name: 'South Korean Won' },
    TRY: { symbol: '₺', name: 'Turkish Lira' },
    EGP: { symbol: 'E£', name: 'Egyptian Pound' },
    VND: { symbol: '₫', name: 'Vietnamese Dong' },
    PHP: { symbol: '₱', name: 'Philippine Peso' },
    MXN: { symbol: 'Mex$', name: 'Mexican Peso' },
    SEK: { symbol: 'kr', name: 'Swedish Krona' },
    HKD: { symbol: 'HK$', name: 'Hong Kong Dollar' },
};

export const DEFAULT_RATES = {
    USD: 1,
    INR: 86.85,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
    CAD: 1.38,
    AUD: 1.55,
    JPY: 152.0,
    SGD: 1.34,
    CNY: 7.23,
    SAR: 3.75,
};

export const formatCurrency = (amount, currencyCode) => {
    const currency = currencies[currencyCode];
    if (!currency) return `${amount}`;

    try {
        return new Intl.NumberFormat(currency.locale || 'en-IN', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch (error) {
        return `${currency.symbol || ''}${amount}`;
    }
};

export const fetchExchangeRates = async () => {
    try {
        await remoteConfig.initialize();
        const apiKey = remoteConfig.get('EXCHANGE_RATE_API_KEY');
        let ratesData = null;

        if (apiKey) {
            try {
                const response = await fetch(
                    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
                );
                const data = await response.json();
                if (data && data.result !== 'error' && data.conversion_rates) {
                    ratesData = data.conversion_rates;
                }
            } catch (err) {
                console.warn('Primary exchange rate fetch failed, trying free fallback:', err.message);
            }
        }

        // Reliable free fallback requiring NO API key (unlimited free tier)
        if (!ratesData) {
            try {
                const fallbackResponse = await fetch('https://open.er-api.com/v6/latest/USD');
                const fallbackData = await fallbackResponse.json();
                if (fallbackData && fallbackData.rates) {
                    ratesData = fallbackData.rates;
                }
            } catch (fallbackErr) {
                console.warn('Fallback exchange rate fetch failed:', fallbackErr.message);
            }
        }

        if (!ratesData) {
            ratesData = { ...DEFAULT_RATES };
        }

        // Store both base rates and cross-currency pairs
        const formattedRates = { ...ratesData };
        const currencyKeys = Object.keys(ratesData);
        currencyKeys.forEach(toCurrency => {
            currencyKeys.forEach(fromCurrency => {
                const key = `${fromCurrency}_${toCurrency}`;
                formattedRates[key] = ratesData[toCurrency] / ratesData[fromCurrency];
            });
        });

        await AsyncStorage.setItem(EXCHANGE_RATES_KEY, JSON.stringify({
            rates: formattedRates,
            timestamp: new Date().toISOString()
        }));

        return formattedRates;
    } catch (error) {
        console.warn('Currency service: error fetching exchange rates, using defaults:', error.message);
        return { ...DEFAULT_RATES };
    }
};

export const loadExchangeRates = async () => {
    try {
        const savedRates = await AsyncStorage.getItem(EXCHANGE_RATES_KEY);
        if (savedRates) {
            const { rates, timestamp } = JSON.parse(savedRates);
            const lastUpdate = new Date(timestamp);
            const now = new Date();
            
            // Update rates if they're more than 24 hours old
            if (now - lastUpdate > 24 * 60 * 60 * 1000) {
                const fresh = await fetchExchangeRates();
                return fresh || rates;
            }
            return rates;
        }
        return await fetchExchangeRates();
    } catch (error) {
        console.error('Error loading exchange rates:', error);
        return { ...DEFAULT_RATES };
    }
};

export const convertAmount = (amount, fromCurrency, toCurrency, exchangeRates) => {
    if (!amount || isNaN(amount)) return 0;
    const num = parseFloat(amount);
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return num;

    const rates = exchangeRates || DEFAULT_RATES;
    if (!rates) return num;

    // 1. Direct pair key: e.g. "USD_INR"
    const pairKey = `${fromCurrency}_${toCurrency}`;
    if (typeof rates[pairKey] === 'number') {
        return num * rates[pairKey];
    }

    // 2. Inverse pair key: e.g. "INR_USD"
    const invKey = `${toCurrency}_${fromCurrency}`;
    if (typeof rates[invKey] === 'number' && rates[invKey] > 0) {
        return num * (1 / rates[invKey]);
    }

    // 3. Base currency rates lookup
    const baseRates = rates.conversion_rates || rates;
    if (baseRates[fromCurrency] && baseRates[toCurrency]) {
        return num * (baseRates[toCurrency] / baseRates[fromCurrency]);
    }

    // 4. Default fallback rates
    if (DEFAULT_RATES[fromCurrency] && DEFAULT_RATES[toCurrency]) {
        return num * (DEFAULT_RATES[toCurrency] / DEFAULT_RATES[fromCurrency]);
    }

    return num;
};

export const getDefaultCurrency = async () => {
    try {
        const currency = await AsyncStorage.getItem(DEFAULT_CURRENCY_KEY);
        return currency || 'INR';
    } catch (error) {
        console.error('Error getting default currency:', error);
        return 'INR';
    }
};

export const setDefaultCurrency = async (currency) => {
    try {
        await AsyncStorage.setItem(DEFAULT_CURRENCY_KEY, currency);
        return true;
    } catch (error) {
        console.error('Error setting default currency:', error);
        return false;
    }
};