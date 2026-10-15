import AsyncStorage from '@react-native-async-storage/async-storage';
import remoteConfig from './remoteConfig';

const EXCHANGE_RATES_KEY = 'EXCHANGE_RATES';
const DEFAULT_CURRENCY_KEY = 'DEFAULT_CURRENCY';

export const currencies = {
    AED: { symbol: 'د.إ', name: 'United Arab Emirates Dirham' },
    AFN: { symbol: '؋', name: 'Afghan Afghani' },
    ALL: { symbol: 'L', name: 'Albanian Lek' },
    AMD: { symbol: '֏', name: 'Armenian Dram' },
    ANG: { symbol: 'ƒ', name: 'Netherlands Antillean Guilder' },
    AOA: { symbol: 'Kz', name: 'Angolan Kwanza' },
    ARS: { symbol: '$', name: 'Argentine Peso' },
    AUD: { symbol: 'A$', name: 'Australian Dollar' },
    AWG: { symbol: 'ƒ', name: 'Aruban Florin' },
    AZN: { symbol: '₼', name: 'Azerbaijani Manat' },
    BAM: { symbol: 'KM', name: 'Bosnia-Herzegovina Convertible Mark' },
    BBD: { symbol: '$', name: 'Barbadian Dollar' },
    BDT: { symbol: '৳', name: 'Bangladeshi Taka' },
    BGN: { symbol: 'лв', name: 'Bulgarian Lev' },
    BHD: { symbol: '.د.ب', name: 'Bahraini Dinar' },
    BIF: { symbol: 'FBu', name: 'Burundian Franc' },
    BMD: { symbol: '$', name: 'Bermudan Dollar' },
    BND: { symbol: '$', name: 'Brunei Dollar' },
    BOB: { symbol: 'Bs.', name: 'Bolivian Boliviano' },
    BRL: { symbol: 'R$', name: 'Brazilian Real' },
    BSD: { symbol: '$', name: 'Bahamian Dollar' },
    BTN: { symbol: 'Nu.', name: 'Bhutanese Ngultrum' },
    BWP: { symbol: 'P', name: 'Botswanan Pula' },
    BYN: { symbol: 'Br', name: 'Belarusian Ruble' },
    BZD: { symbol: 'BZ$', name: 'Belize Dollar' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar' },
    CDF: { symbol: 'FC', name: 'Congolese Franc' },
    CHF: { symbol: 'Fr', name: 'Swiss Franc' },
    CLP: { symbol: '$', name: 'Chilean Peso' },
    CNY: { symbol: '¥', name: 'Chinese Yuan' },
    COP: { symbol: '$', name: 'Colombian Peso' },
    CRC: { symbol: '₡', name: 'Costa Rican Colón' },
    CUP: { symbol: '₱', name: 'Cuban Peso' },
    CVE: { symbol: '$', name: 'Cape Verdean Escudo' },
    CZK: { symbol: 'Kč', name: 'Czech Koruna' },
    DJF: { symbol: 'Fdj', name: 'Djiboutian Franc' },
    DKK: { symbol: 'kr', name: 'Danish Krone' },
    DOP: { symbol: 'RD$', name: 'Dominican Peso' },
    DZD: { symbol: 'د.ج', name: 'Algerian Dinar' },
    EGP: { symbol: 'E£', name: 'Egyptian Pound' },
    ERN: { symbol: 'Nfk', name: 'Eritrean Nakfa' },
    ETB: { symbol: 'Br', name: 'Ethiopian Birr' },
    EUR: { symbol: '€', name: 'Euro' },
    FJD: { symbol: 'FJ$', name: 'Fijian Dollar' },
    FKP: { symbol: '£', name: 'Falkland Islands Pound' },
    GBP: { symbol: '£', name: 'British Pound Sterling' },
    GEL: { symbol: '₾', name: 'Georgian Lari' },
    GHS: { symbol: 'GH₵', name: 'Ghanaian Cedi' },
    GIP: { symbol: '£', name: 'Gibraltar Pound' },
    GMD: { symbol: 'D', name: 'Gambian Dalasi' },
    GNF: { symbol: 'FG', name: 'Guinean Franc' },
    GTQ: { symbol: 'Q', name: 'Guatemalan Quetzal' },
    GYD: { symbol: '$', name: 'Guyanaese Dollar' },
    HKD: { symbol: 'HK$', name: 'Hong Kong Dollar' },
    HNL: { symbol: 'L', name: 'Honduran Lempira' },
    HRK: { symbol: 'kn', name: 'Croatian Kuna' },
    HTG: { symbol: 'G', name: 'Haitian Gourde' },
    HUF: { symbol: 'Ft', name: 'Hungarian Forint' },
    IDR: { symbol: 'Rp', name: 'Indonesian Rupiah' },
    ILS: { symbol: '₪', name: 'Israeli New Shekel' },
    INR: { symbol: '₹', name: 'Indian Rupee' },
    IQD: { symbol: 'ع.د', name: 'Iraqi Dinar' },
    IRR: { symbol: '﷼', name: 'Iranian Rial' },
    ISK: { symbol: 'kr', name: 'Icelandic Króna' },
    JMD: { symbol: 'J$', name: 'Jamaican Dollar' },
    JOD: { symbol: 'د.ا', name: 'Jordanian Dinar' },
    JPY: { symbol: '¥', name: 'Japanese Yen' },
    KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
    KGS: { symbol: 'лв', name: 'Kyrgystani Som' },
    KHR: { symbol: '៛', name: 'Cambodian Riel' },
    KMF: { symbol: 'CF', name: 'Comorian Franc' },
    KPW: { symbol: '₩', name: 'North Korean Won' },
    KRW: { symbol: '₩', name: 'South Korean Won' },
    KWD: { symbol: 'د.ك', name: 'Kuwaiti Dinar' },
    KYD: { symbol: '$', name: 'Cayman Islands Dollar' },
    KZT: { symbol: '₸', name: 'Kazakhstani Tenge' },
    LAK: { symbol: '₭', name: 'Laotian Kip' },
    LBP: { symbol: 'ل.ل', name: 'Lebanese Pound' },
    LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee' },
    LRD: { symbol: '$', name: 'Liberian Dollar' },
    LSL: { symbol: 'L', name: 'Lesotho Loti' },
    LYD: { symbol: 'ل.د', name: 'Libyan Dinar' },
    MAD: { symbol: 'د.م.', name: 'Moroccan Dirham' },
    MDL: { symbol: 'L', name: 'Moldovan Leu' },
    MGA: { symbol: 'Ar', name: 'Malagasy Ariary' },
    MKD: { symbol: 'ден', name: 'Macedonian Denar' },
    MMK: { symbol: 'K', name: 'Myanmar Kyat' },
    MNT: { symbol: '₮', name: 'Mongolian Tugrik' },
    MOP: { symbol: 'MOP$', name: 'Macanese Pataca' },
    MRU: { symbol: 'UM', name: 'Mauritanian Ouguiya' },
    MUR: { symbol: '₨', name: 'Mauritian Rupee' },
    MVR: { symbol: 'Rf', name: 'Maldivian Rufiyaa' },
    MWK: { symbol: 'MK', name: 'Malawian Kwacha' },
    MXN: { symbol: '$', name: 'Mexican Peso' },
    MYR: { symbol: 'RM', name: 'Malaysian Ringgit' },
    MZN: { symbol: 'MT', name: 'Mozambican Metical' },
    NAD: { symbol: '$', name: 'Namibian Dollar' },
    NGN: { symbol: '₦', name: 'Nigerian Naira' },
    NIO: { symbol: 'C$', name: 'Nicaraguan Córdoba' },
    NOK: { symbol: 'kr', name: 'Norwegian Krone' },
    NPR: { symbol: '₨', name: 'Nepalese Rupee' },
    NZD: { symbol: '$', name: 'New Zealand Dollar' },
    OMR: { symbol: '﷼', name: 'Omani Rial' },
    PAB: { symbol: 'B/.', name: 'Panamanian Balboa' },
    PEN: { symbol: 'S/.', name: 'Peruvian Nuevo Sol' },
    PGK: { symbol: 'K', name: 'Papua New Guinean Kina' },
    PHP: { symbol: '₱', name: 'Philippine Peso' },
    PKR: { symbol: '₨', name: 'Pakistani Rupee' },
    PLN: { symbol: 'zł', name: 'Polish Złoty' },
    PYG: { symbol: '₲', name: 'Paraguayan Guarani' },
    QAR: { symbol: 'ر.ق', name: 'Qatari Rial' },
    RON: { symbol: 'lei', name: 'Romanian Leu' },
    RSD: { symbol: 'дин.', name: 'Serbian Dinar' },
    RUB: { symbol: '₽', name: 'Russian Ruble' },
    RWF: { symbol: 'FRw', name: 'Rwandan Franc' },
    SAR: { symbol: '﷼', name: 'Saudi Riyal' },
    SBD: { symbol: '$', name: 'Solomon Islands Dollar' },
    SCR: { symbol: '₨', name: 'Seychellois Rupee' },
    SDG: { symbol: 'ج.س.', name: 'Sudanese Pound' },
    SEK: { symbol: 'kr', name: 'Swedish Krona' },
    SGD: { symbol: 'S$', name: 'Singapore Dollar' },
    SHP: { symbol: '£', name: 'Saint Helena Pound' },
    SLL: { symbol: 'Le', name: 'Sierra Leonean Leone' },
    SOS: { symbol: 'S', name: 'Somali Shilling' },
    SRD: { symbol: '$', name: 'Surinamese Dollar' },
    STN: { symbol: 'Db', name: 'São Tomé and Príncipe Dobra' },
    SVC: { symbol: '$', name: 'Salvadoran Colón' },
    SYP: { symbol: '£', name: 'Syrian Pound' },
    SZL: { symbol: 'L', name: 'Swazi Lilangeni' },
    THB: { symbol: '฿', name: 'Thai Baht' },
    TJS: { symbol: 'SM', name: 'Tajikistani Somoni' },
    TMT: { symbol: 'T', name: 'Turkmenistani Manat' },
    TND: { symbol: 'د.ت', name: 'Tunisian Dinar' },
    TOP: { symbol: 'T$', name: 'Tongan Paʻanga' },
    TRY: { symbol: '₺', name: 'Turkish Lira' },
    TTD: { symbol: 'TT$', name: 'Trinidad and Tobago Dollar' },
    TWD: { symbol: 'NT$', name: 'New Taiwan Dollar' },
    TZS: { symbol: 'TSh', name: 'Tanzanian Shilling' },
    UAH: { symbol: '₴', name: 'Ukrainian Hryvnia' },
    UGX: { symbol: 'USh', name: 'Ugandan Shilling' },
    USD: { symbol: '$', name: 'United States Dollar' },
    UYU: { symbol: '$U', name: 'Uruguayan Peso' },
    UZS: { symbol: 'лв', name: 'Uzbekistan Som' },
    VES: { symbol: 'Bs', name: 'Venezuelan Bolívar' },
    VND: { symbol: '₫', name: 'Vietnamese Dong' },
    VUV: { symbol: 'VT', name: 'Vanuatu Vatu' },
    WST: { symbol: 'WS$', name: 'Samoan Tala' },
    XAF: { symbol: 'FCFA', name: 'Central African CFA Franc' },
    XCD: { symbol: '$', name: 'East Caribbean Dollar' },
    XOF: { symbol: 'CFA', name: 'West African CFA Franc' },
    XPF: { symbol: '₣', name: 'CFP Franc' },
    YER: { symbol: '﷼', name: 'Yemeni Rial' },
    ZAR: { symbol: 'R', name: 'South African Rand' },
    ZMW: { symbol: 'ZK', name: 'Zambian Kwacha' },
    ZWL: { symbol: '$', name: 'Zimbabwean Dollar' }
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