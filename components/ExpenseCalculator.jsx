import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  AppState,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS } from '../constants/theme';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp
} from 'react-native-responsive-screen';
import { useGlobalContext } from '../components/globalProvider';
import { useNavigation } from '@react-navigation/native';
import * as IntentLauncher from 'expo-intent-launcher';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import QRScannerModal from './QRCodeScanner';
import { parseUpiUri, buildLaunchUri, launchUpiApp } from '../utils/upiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// UPI Apps Data
const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', package: 'com.google.android.apps.nbu.paisa.user', uriSchema: 'tez', icon: 'logo-google', color: '#4285F4', desc: 'Google Pay UPI' },
  { id: 'phonepe', name: 'PhonePe', package: 'com.phonepe.app', uriSchema: 'phonepe', icon: 'wallet-outline', color: '#5f259f', desc: 'PhonePe UPI' },
  { id: 'paytm', name: 'Paytm', package: 'net.one97.paytm', uriSchema: 'paytmmp', icon: 'cash-outline', color: '#00b9f5', desc: 'Paytm Payments Bank / UPI' },
  { id: 'bhim', name: 'BHIM UPI', package: 'in.org.npci.upiapp', uriSchema: 'bhim', icon: 'card-outline', color: '#00796B', desc: 'NPCI BHIM UPI' },
  { id: 'cred', name: 'CRED', package: 'com.dreamplug.androidapp', uriSchema: 'cred', icon: 'shield-checkmark-outline', color: '#333333', desc: 'CRED Club UPI' },
  { id: 'any', name: 'Any UPI App', package: null, uriSchema: 'upi', icon: 'apps-outline', color: '#2563EB', desc: 'Open native app chooser' },
];

// Function to open UPI apps
function openApp(platformSpecificLink) {
  if (Platform.OS === 'android') {
    // For Android, use package names with expo-intent-launcher
    try {
      IntentLauncher.startActivityAsync(IntentLauncher.ACTION_VIEW, {
        packageName: platformSpecificLink.android,
      });
    } catch (error) {
      console.error("Failed to open app on Android:", error);
    }
  } else if (Platform.OS === 'ios') {
    // For iOS, use deep link URLs
    Linking.openURL(platformSpecificLink.ios).catch((err) =>
      console.error("Failed to open app on iOS:", err)
    );
  }
}

const CATEGORIES = {
  EXPENSE: [
    'Food & Dining',
    'Transportation',
    'Shopping',
    'Entertainment',
    'Bills & Utilities',
    'Health & Fitness',
    'Travel',
    'Other'
  ],
  INCOME: [
    'Salary',
    'Business',
    'Investments',
    'Freelance',
    'Gift',
    'Other'
  ],
  TRANSFER: [
    'Account Transfer',
    'Investment Transfer',
    'Debt Payment',
    'Other'
  ]
};

const ACCOUNTS = [
  'Cash',
  'Bank Account',
  'Credit Card',
  'Savings',
  'Investment'
];

const PAYMENT_METHODS = [
  { id: 'upi', name: 'UPI Payment', icon: 'phone-portrait-outline', desc: 'Pay with Google Pay, PhonePe, Paytm, etc.', color: '#2563EB' },
  { id: 'cash', name: 'Cash', icon: 'cash-outline', desc: 'Pay with physical cash', color: '#10B981' },
  { id: 'direct', name: 'Direct Save', icon: 'checkmark-circle-outline', desc: 'Already paid, just record expense', color: '#6366F1' },
];

const MAX_DIGITS = 9;
const DECIMAL_PLACES = 2;

const ExpenseCalculator = ({ onClose, initialData, onSave: propOnSave }) => {
  const { t } = useTranslation();
  const isFromOCR = Boolean(initialData?.isFromOCR);
  const isEditMode = Boolean(initialData?.id && !isFromOCR && initialData?.isUpdate !== false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialData?.date ? new Date(initialData.date) : new Date());
  const [type, setType] = useState(initialData?.type || 'EXPENSE');
  const [expression, setExpression] = useState('');
  const [note, setNote] = useState(initialData?.note || '');
  const [account, setAccount] = useState(initialData?.account || 'Cash');
  const [category, setCategory] = useState(initialData?.category || 'Other');
  const [isDirectSaveAfterEdit, setIsDirectSaveAfterEdit] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(Boolean(initialData?.openCategoryPicker));
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showUPIAppsModal, setShowUPIAppsModal] = useState(false);
  const [availableUPIApps, setAvailableUPIApps] = useState([]);
  const [paymentPending, setPaymentPending] = useState(false);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  // Option 1 (scan merchant QR -> prefill -> forward -> confirm) state
  const [showMerchantScanner, setShowMerchantScanner] = useState(false);
  const [scannedMerchant, setScannedMerchant] = useState(null);
  const awaitingPaymentReturn = useRef(false);
  const confirmRef = useRef(null);
  const [amount, setAmount] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const { onSave, state, convertAmount } = useGlobalContext();
  const isLight = state?.theme === 'light';
  const paymentMethods = useMemo(() => [
    { id: 'upi', name: t('UPI Payment') || 'UPI Payment', icon: 'phone-portrait-outline', desc: t('Pay with Google Pay, PhonePe, Paytm, etc.') || 'Pay with Google Pay, PhonePe, Paytm, etc.', color: '#2563EB' },
    { id: 'cash', name: t('Cash') || 'Cash', icon: 'cash-outline', desc: t('Pay with physical cash') || 'Pay with physical cash', color: '#10B981' },
    { id: 'direct', name: t('Direct Save') || 'Direct Save', icon: 'checkmark-circle-outline', desc: t('Already paid, just record expense') || 'Already paid, just record expense', color: '#6366F1' },
  ], [t]);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [accountSearchQuery, setAccountSearchQuery] = useState('');

  // Enhanced modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showNotRecordedModal, setShowNotRecordedModal] = useState(false);
  const [errorModalConfig, setErrorModalConfig] = useState({
    title: '',
    message: '',
    icon: 'alert-circle-outline',
    iconColor: '#F59E0B',
    buttonText: 'Got It',
    onAction: null,
  });
  const modalScaleAnim = useRef(new Animated.Value(0)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;
  const [currency, setCurrency] = useState(initialData?.currency || state?.defaultCurrency || 'INR');
  const [originalAmount, setOriginalAmount] = useState('');
  const [originalCurrency, setOriginalCurrency] = useState('');

  // Get currencies and defaultCurrency from global state
  const { currencies, defaultCurrency } = state;

  // Function to get currency symbol
  const getCurrencySymbol = (currencyCode) => {
    return currencies?.[currencyCode]?.symbol || currencyCode;
  };
  
  // Transfer-specific states
  const [fromAccount, setFromAccount] = useState(initialData?.fromAccount || '');
  const [toAccount, setToAccount] = useState(initialData?.toAccount || '');
  const [showFromAccountModal, setShowFromAccountModal] = useState(false);
  const [showToAccountModal, setShowToAccountModal] = useState(false);

  const validateAmount = useCallback((value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;
    const wholeNumberPart = Math.floor(Math.abs(numValue)).toString();
    return wholeNumberPart.length <= MAX_DIGITS;
  }, []);

  useEffect(() => {
    // Only check for UPI apps if we're not in edit mode and not from OCR
    if (!isEditMode && !isFromOCR) {
      checkInstalledApps();
    }
  }, [isEditMode, isFromOCR]);

  useEffect(() => {
    // Proceed if we have initial data (from edit mode or OCR prefill)
    if (initialData) {
      console.log('Loading Transaction InitialData:', initialData);
      console.log('Default Currency:', state?.defaultCurrency);
      console.log('Conversion Rates:', state?.conversionRates);
      
      // Validate initialData
      const hasValidAmount = initialData.amount !== undefined && initialData.amount !== null && !isNaN(parseFloat(initialData.amount));
      if (!hasValidAmount && !initialData.category && !initialData.note) {
        console.error('initialData is missing required fields:', initialData);
        showEnhancedError({
          title: t('invalidDataTitle') || 'Invalid Data',
          message: t('invalidDataMessage') || 'The provided transaction data is incomplete.',
          buttonText: t('ok') || 'OK',
          onAction: onClose,
        });
        return;
      }
  
      // Sync category, account, and note from initialData (e.g. from OCR or edit)
      if (initialData.category) setCategory(initialData.category);
      if (initialData.openCategoryPicker) setShowCategoryModal(true);
      if (initialData.account) setAccount(initialData.account);
      if (initialData.note !== undefined) setNote(initialData.note);
      if (initialData.type) setType(initialData.type);
      if (initialData.date) setSelectedDate(new Date(initialData.date));

      // Store the original amount and currency
      const initAmountNum = parseFloat(initialData.amount) || 0;
      setOriginalAmount(initAmountNum.toString());
      setOriginalCurrency(initialData.currency || state?.defaultCurrency || 'INR');
      
      // If currencies are different and we need to convert
      if (initialData.currency !== state?.defaultCurrency) {
        if (initialData.convertedAmount !== undefined) {
          // Use the pre-calculated converted amount
          setAmount(parseFloat(initialData.convertedAmount).toFixed(DECIMAL_PLACES));
        } else {
          // Calculate conversion if rates are available
          const converted = convertAmount(
            parseFloat(initialData.amount) || 0,
            initialData.currency,
            state?.defaultCurrency || 'INR'
          );
          setAmount(parseFloat(converted).toFixed(DECIMAL_PLACES));
        }
      } else {
        // Same currency, no conversion needed
        setAmount(parseFloat(initialData.amount).toFixed(DECIMAL_PLACES));
      }
    }
  }, [isEditMode, initialData, state?.defaultCurrency, convertAmount, onClose, t]);

  const getActiveLocaleTag = () => {
    const lang = (state?.language || i18n?.language || '').toLowerCase();
    if (lang.includes('hi') || lang.includes('hn') || lang.includes('hindi')) return 'hi-IN';
    if (lang.includes('mr') || lang.includes('marathi')) return 'mr-IN';
    if (lang.includes('ta') || lang.includes('tm') || lang.includes('tamil')) return 'ta-IN';
    if (lang.includes('kn') || lang.includes('kannada')) return 'kn-IN';
    if (lang.includes('ur') || lang.includes('urdu')) return 'ur-IN';
    return 'en-US';
  };

  const formatDate = (date) => {
    try {
      return date.toLocaleDateString(getActiveLocaleTag(), { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatTime = (date) => {
    try {
      return date.toLocaleTimeString(getActiveLocaleTag(), { 
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    } catch (e) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    }
  };

  const getAccountLabel = (acc) => {
    if (!acc) return t('selectAccount') || 'Select Account';
    const direct = t(acc);
    if (direct && direct !== acc) return direct;
    const lower = t(acc.toLowerCase());
    if (lower && lower !== acc.toLowerCase()) return lower;
    const slug = t(acc.toLowerCase().replace(/ /g, '_'));
    if (slug && slug !== acc.toLowerCase().replace(/ /g, '_')) return slug;
    return acc;
  };

  const getCategoryLabel = (cat) => {
    if (!cat) return t('selectCategory') || 'Select Category';
    const direct = t(cat);
    if (direct && direct !== cat) return direct;
    const lower = t(cat.toLowerCase());
    if (lower && lower !== cat.toLowerCase()) return lower;
    const slug = t(cat.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_'));
    if (slug && slug !== cat.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_')) return slug;
    return cat;
  };

  const checkInstalledApps = () => {
    setIsLoadingApps(true);
    setAvailableUPIApps(UPI_APPS); // Directly show all UPI apps
    setIsLoadingApps(false);
  };

  // Date change handler
  const onDateChange = (event, selectedDateValue) => {
    const currentDate = selectedDateValue || selectedDate;
    setShowDatePicker(Platform.OS === 'ios');
    if (currentDate) {
      const newDate = new Date(currentDate);
      // Preserve the time from the existing selectedDate
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
      setSelectedDate(newDate);
    }
  };

  // Time change handler
  const onTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || selectedDate;
    setShowTimePicker(Platform.OS === 'ios');
    if (currentTime) {
      const newDate = new Date(selectedDate);
      newDate.setHours(currentTime.getHours());
      newDate.setMinutes(currentTime.getMinutes());
      setSelectedDate(newDate);
    }
  };

  // Helper to show enhanced error modal
  const showEnhancedError = (titleOrConfig, maybeMessage, maybeIcon = 'alert-circle-outline') => {
    if (typeof titleOrConfig === 'object' && titleOrConfig !== null) {
      setErrorModalConfig({
        title: titleOrConfig.title || t('notice') || 'Notice',
        message: titleOrConfig.message || '',
        icon: titleOrConfig.icon || 'alert-circle-outline',
        iconColor: titleOrConfig.iconColor || '#F59E0B',
        buttonText: titleOrConfig.buttonText || t('gotIt') || 'Got It',
        onAction: titleOrConfig.onAction || null,
      });
    } else {
      setErrorModalConfig({
        title: titleOrConfig,
        message: maybeMessage || '',
        icon: maybeIcon,
        iconColor: '#F59E0B',
        buttonText: t('gotIt') || 'Got It',
        onAction: null,
      });
    }
    setShowErrorModal(true);
    animateModalIn();
  };

  const animateModalIn = () => {
    modalScaleAnim.setValue(0.7);
    modalOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateModalOut = (callback) => {
    Animated.parallel([
      Animated.timing(modalScaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
    });
  };

  const handlePayment = (paymentMethod) => {
    setShowPaymentModal(false);
    if (paymentMethod === 'cash') {
      if (!account) setAccount('Cash');
      setTimeout(() => {
        saveTransaction();
      }, 100);
    } else if (paymentMethod === 'upi') {
      if (!account) setAccount('Bank Account');
      checkInstalledApps();
      // Directly open QR scanner — after successful scan, available UPI apps on user's phone open
      setScannedMerchant(null);
      setShowMerchantScanner(true);
    } else {
      setTimeout(() => {
        saveTransaction();
      }, 100);
    }
  };

  // Called by QRScannerModal when a QR is decoded. Parses the merchant UPI QR,
  // prefills amount/note, and directly opens the available UPI apps on user's phone.
  const handleMerchantScanned = async (data) => {
    const parsed = parseUpiUri(data);

    if (!parsed.isValid) {
      setShowMerchantScanner(false);
      showEnhancedError({
        title: t('Invalid QR Code') || 'Invalid QR Code',
        message:
          t('This does not look like a valid UPI payment QR code. Please scan a merchant UPI QR.') ||
          'This does not look like a valid UPI payment QR code. Please scan a merchant UPI QR.',
        icon: 'qr-code-outline',
        buttonText: t('Try Scanning Again') || 'Try Scanning Again',
        onAction: () => {
          setTimeout(() => setShowMerchantScanner(true), 300);
        },
      });
      return;
    }

    setScannedMerchant(parsed);

    // If the QR carries a fixed amount (dynamic QR), it is authoritative — use it
    let currentAmount = amount;
    if (parsed.am) {
      const num = parseFloat(String(parsed.am).replace(/,/g, ''));
      if (!isNaN(num) && num > 0) {
        currentAmount = num.toFixed(DECIMAL_PLACES);
        setAmount(currentAmount);
      }
    }
    // Prefill the note with the merchant name when the user hasn't typed one.
    let currentNote = note;
    if (parsed.pn && !note) {
      currentNote = parsed.pn;
      setNote(currentNote);
    }

    setShowMerchantScanner(false);

    // Fallback amount check if static QR
    const fallbackAmount = parsed.am ? null : currentAmount;
    const num = parseFloat(String(fallbackAmount || parsed.am || currentAmount).replace(/,/g, ''));
    if (!parsed.am && (isNaN(num) || num <= 0)) {
      showEnhancedError({
        title: t('Amount Required') || 'Amount Required',
        message:
          t('This QR has no fixed amount. Please enter an amount before paying.') ||
          'This QR has no fixed amount. Please enter an amount before paying.',
        icon: 'cash-outline',
        buttonText: t('gotIt') || 'Got It',
      });
      return;
    }

    // Build the launch URI
    const launchUri = buildLaunchUri(parsed, fallbackAmount, currentNote);

    // Directly open available UPI apps on user's phone via native system chooser
    setTimeout(async () => {
      try {
        setPaymentPending(true);
        awaitingPaymentReturn.current = true;
        // Passing packageName: null tells Android to open native system chooser with all available UPI apps on phone
        const launched = await launchUpiApp(launchUri, { packageName: null });
        setPaymentPending(false);

        if (!launched) {
          awaitingPaymentReturn.current = false;
          showEnhancedError({
            title: t('UPI App Not Found') || 'UPI App Not Found',
            message:
              t('Could not open a UPI app. Please make sure one is installed on your device.') ||
              'Could not open a UPI app. Please make sure one is installed on your device.',
            icon: 'phone-portrait-outline',
            buttonText: t('gotIt') || 'Got It',
          });
        }
      } catch (error) {
        console.warn('Error opening UPI app:', error?.message || error);
        setPaymentPending(false);
        awaitingPaymentReturn.current = false;
        showEnhancedError({
          title: t('Launch Failed') || 'Launch Failed',
          message: t('Could not open the UPI app chooser.') || 'Could not open the UPI app chooser.',
          icon: 'phone-portrait-outline',
          buttonText: t('gotIt') || 'Got It',
        });
      }
    }, 400);
  };

  const handleUPIApp = async (app) => {
    try {
      setShowUPIAppsModal(false);

      if (!scannedMerchant || !scannedMerchant.isValid) {
        showEnhancedError(
          t('errorTitle') || 'Error',
          t('noMerchantScanned') ||
            'No merchant details found. Please scan a UPI QR code first.',
          'scan-outline'
        );
        return;
      }

      // QR amount wins; otherwise use the amount typed into the calculator.
      const fallbackAmount = scannedMerchant.am ? null : amount;
      if (!scannedMerchant.am) {
        const num = parseFloat(String(amount).replace(/,/g, ''));
        if (isNaN(num) || num <= 0) {
          showEnhancedError(
            t('invalidAmountTitle') || 'Enter an amount',
            t('enterAmountBeforePay') ||
              'This QR has no fixed amount. Please enter an amount before paying.',
            'cash-outline'
          );
          return;
        }
      }

      const launchUri = buildLaunchUri(scannedMerchant, fallbackAmount, note);

      setPaymentPending(true);
      awaitingPaymentReturn.current = true;
      const launched = await launchUpiApp(launchUri, { packageName: app?.package || null });
      setPaymentPending(false);

      if (!launched) {
        awaitingPaymentReturn.current = false;
        showEnhancedError(
          t('errorTitle') || 'Error',
          t('couldNotOpenUpi') ||
            'Could not open a UPI app. Please make sure one is installed.',
          'phone-portrait-outline'
        );
      }
      // Intentionally NOT saving here. We wait for the user to return from the
      // UPI app (detected via AppState) and confirm whether it went through.
    } catch (error) {
      console.warn('Error opening UPI app:', error?.message || error);
      setPaymentPending(false);
      awaitingPaymentReturn.current = false;
      showEnhancedError(
        t('errorTitle') || 'Error',
        t('couldNotOpenUpi') || 'Could not open the selected UPI app.',
        'phone-portrait-outline'
      );
    }
  };

  const handleNumber = useCallback((num) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      setAmount(prevAmount => {
        const newAmount = prevAmount === '0' ? num : prevAmount + num;
        
        // Handle decimal places
        if (newAmount.includes('.')) {
          const [whole, decimal] = newAmount.split('.');
          if (decimal && decimal.length > DECIMAL_PLACES) {
            return prevAmount;
          }
        }
        
        // Validate digit count
        const wholeNumber = newAmount.split('.')[0];
        if (wholeNumber.length > MAX_DIGITS) {
          showEnhancedError({
            title: t('invalidAmountTitle') || 'Limit Exceeded',
            message: t('maxDigitsAllowed') || 'Maximum digits allowed exceeded.',
          });
          return prevAmount;
        }
        
        return newAmount;
      });
      setIsProcessing(false);
    }, 100); // Debounce time for multi-touch handling
  }, [isProcessing, t, showEnhancedError]);

  const handleOperator = useCallback((operator) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      if (amount !== '0') {
        setExpression(amount + operator);
        setAmount('0');
      }
      setIsProcessing(false);
    }, 100);
  }, [amount, isProcessing]);

  const calculate = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      if (expression) {
        try {
          // Handle division by zero
          if (expression.endsWith('/') && parseFloat(amount) === 0) {
            showEnhancedError({
              title: t('invalidOperationTitle') || 'Invalid Operation',
              message: t('divisionByZeroMessage') || 'Cannot divide by zero.',
            });
            handleClear();
            setIsProcessing(false);
            return;
          }

          // Replace multiplication symbol for evaluation
          const evalExpression = expression.replace(/×/g, '*');
          const result = eval(evalExpression + amount);
          
          // Handle invalid results
          if (!isFinite(result)) {
            showEnhancedError({
              title: t('invalidAmountTitle') || 'Invalid Calculation',
              message: t('invalidAmountMessage') || 'Calculation resulted in an invalid number.',
            });
            handleClear();
            setIsProcessing(false);
            return;
          }

          // Format result to fixed decimal places
          const formattedResult = parseFloat(result.toFixed(DECIMAL_PLACES)).toString();
          
          // Validate result length
          if (!validateAmount(formattedResult)) {
            showEnhancedError({
              title: t('invalidAmountTitle') || 'Limit Exceeded',
              message: t('maxDigitsAllowed') || 'Result exceeds maximum allowable digits.',
            });
            handleClear();
          } else {
            setAmount(formattedResult);
            setExpression('');
          }
        } catch (error) {
          showEnhancedError({
            title: t('errorTitle') || 'Error',
            message: t('invalidCalculationMessage') || 'Invalid calculation.',
          });
          handleClear();
        }
      }
      setIsProcessing(false);
    }, 100);
  }, [expression, amount, isProcessing, validateAmount, handleClear, t, showEnhancedError]);

  // Enhanced clear function
  const handleClear = useCallback(() => {
    setAmount('0');
    setExpression('');
  }, []);

  // Enhanced backspace handling
  const handleBackspace = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      setAmount(prevAmount => {
        if (prevAmount.length > 1) {
          return prevAmount.slice(0, -1);
        }
        return '0';
      });
      setIsProcessing(false);
    }, 100);
  }, [isProcessing]);

  // Save Transaction function
  const saveTransaction = useCallback(async () => {
    setShowUPIAppsModal(false);
    setPaymentPending(false);
  
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount === 0) {
      showEnhancedError({
        title: t('invalidAmountTitle') || 'Invalid Amount',
        message: t('amountCannotBeZero') || 'Amount must be greater than zero.',
        icon: 'calculator-outline',
        iconColor: '#EF4444',
        buttonText: 'Got It',
      });
      return;
    }
  
    if (!validateAmount(amount)) {
      showEnhancedError({
        title: t('invalidAmountTitle') || 'Invalid Amount',
        message: t('amountIsInvalid') || 'Please enter a valid amount.',
        icon: 'calculator-outline',
        iconColor: '#EF4444',
        buttonText: 'Got It',
      });
      return;
    }
  
    let finalAmount = numAmount;
    let finalCurrency = currency || state?.defaultCurrency || 'INR';
    let convertedAmount;
  
    // If we're in edit mode and dealing with different currencies
    if (isEditMode && originalCurrency && originalCurrency !== (state?.defaultCurrency || 'INR')) {
      const convertedBack = convertAmount(numAmount, state?.defaultCurrency || 'INR', originalCurrency);
      finalAmount = parseFloat(convertedBack.toFixed(DECIMAL_PLACES));
      finalCurrency = originalCurrency;
      convertedAmount = numAmount;
    }

    const transactionData = {
      ...(isEditMode && initialData?.id ? { id: initialData.id } : {}),
      amount: parseFloat(finalAmount.toFixed(DECIMAL_PLACES)), // Ensure amount is rounded
      currency: finalCurrency,
      convertedAmount: convertedAmount ? parseFloat(convertedAmount.toFixed(DECIMAL_PLACES)) : undefined, // Rounded converted amount
      type,
      category: type === 'TRANSFER' ? t('transfer') : category, // Translate 'Transfer' if needed
      account: type === 'TRANSFER' ? fromAccount : account,
      toAccount: type === 'TRANSFER' ? toAccount : undefined,
      note,
      date: selectedDate.toISOString(),
      lastModified: new Date().toISOString(),
      isUpdate: isEditMode,
    };
  
    const saveFunc = propOnSave || onSave;
    if (saveFunc) {
      await saveFunc(transactionData);
    }
    onClose();
  }, [
    amount, type, category, account, fromAccount, toAccount, note, selectedDate,
    initialData, isEditMode, isFromOCR, propOnSave, onSave, onClose, validateAmount, originalCurrency,
    state?.defaultCurrency, convertAmount, originalAmount, currency, t, showEnhancedError
  ]);

  // Shown after the user returns from the UPI app. We cannot reliably read a
  // success/failure status from UPI apps, so we ask the user directly and only
  // record the expense if they confirm the payment went through.
  const promptPaymentConfirmation = () => {
    setShowConfirmModal(true);
    animateModalIn();
  };
  // Keep the latest handler in a ref so the AppState listener (subscribed once)
  // always calls the current closure without re-subscribing every render.
  confirmRef.current = promptPaymentConfirmation;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && awaitingPaymentReturn.current) {
        awaitingPaymentReturn.current = false;
        // Let the UI settle after returning from the external UPI app.
        setTimeout(() => {
          if (confirmRef.current) confirmRef.current();
        }, 400);
      }
    });
    return () => subscription.remove();
  }, []);

  const handleSave = () => {
    if (type === 'TRANSFER') {
      if (!fromAccount) {
        showEnhancedError({
          title: t('Source Account Required') || 'Source Account Required',
          message: t('selectSourceAccount') || 'Please select a source account.',
          icon: 'wallet-outline',
          buttonText: t('selectAccount') || 'Select Account',
          onAction: () => setShowFromAccountModal(true),
        });
        return;
      }
      if (!toAccount) {
        showEnhancedError({
          title: t('Destination Account Required') || 'Destination Account Required',
          message: t('selectDestinationAccount') || 'Please select a destination account.',
          icon: 'wallet-outline',
          buttonText: t('selectAccount') || 'Select Account',
          onAction: () => setShowToAccountModal(true),
        });
        return;
      }
      if (fromAccount === toAccount) {
        showEnhancedError({
          title: t('Invalid Accounts') || 'Invalid Accounts',
          message: t('sameSourceDestinationAccount') || 'Source and destination accounts cannot be the same.',
          icon: 'swap-horizontal-outline',
          buttonText: t('gotIt') || 'Got It',
        });
        return;
      }
    } else if (!account) {
      setAccount('Cash');
    }
    
    if (!category && type !== 'TRANSFER') {
      setCategory('Other');
    }

    if (isEditMode || isFromOCR || isDirectSaveAfterEdit || type === 'INCOME' || type === 'TRANSFER') {
      saveTransaction();
    } else {
      setShowPaymentModal(true);
    }
  };

  // Render transfer-specific input fields
  const renderTransferFields = () => (
    <>
      <TouchableOpacity 
        style={[styles.inputField, isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}
        onPress={() => setShowFromAccountModal(true)}
      >
        <Text style={{ color: isLight ? (fromAccount ? '#0F172A' : '#64748B') : (fromAccount ? COLORS.text.primary : COLORS.text.secondary) }}>
          {fromAccount ? getAccountLabel(fromAccount) : t('fromAccount')}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.inputField, isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}
        onPress={() => setShowToAccountModal(true)}
      >
        <Text style={{ color: isLight ? (toAccount ? '#0F172A' : '#64748B') : (toAccount ? COLORS.text.primary : COLORS.text.secondary) }}>
          {toAccount ? getAccountLabel(toAccount) : t('toAccount')}
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderDisplay = () => {
    const displayAmount = () => {
      // If the amount is a valid number, format it
      const numAmount = parseFloat(amount);
      if (!isNaN(numAmount)) {
        return numAmount.toFixed(DECIMAL_PLACES);
      }
      return amount;
    };

    return (
      <View style={[styles.displaySection, isLight && { backgroundColor: '#F1F5F9', borderBottomColor: '#E2E8F0', borderBottomWidth: 1 }]}>
        {expression ? <Text style={[styles.expression, isLight && { color: '#64748B' }]}>{expression}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.amount, isLight && { color: '#0F172A' }, { marginRight: wp('2%') }]}>
            {displayAmount()}
          </Text>
          <TouchableOpacity onPress={handleClear} style={{ marginLeft: wp('3%'), padding: wp('1%') }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle-outline" size={wp('6.5%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDateTime = () => (
    <View style={[dateTimeStyles.dateTimeContainer, isLight && { backgroundColor: '#F8FAFC' }]}>
      <TouchableOpacity 
        style={[dateTimeStyles.dateTimeButton, isLight && { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}
        onPress={() => setShowDatePicker(true)}
      >
        <Ionicons 
          name="calendar-outline" 
          size={wp('5%')} 
          color={isLight ? '#0F172A' : COLORS.text.primary}
          style={dateTimeStyles.iconStyle}
        />
        <Text style={[dateTimeStyles.dateTimeText, isLight && { color: '#0F172A' }]}>
          {formatDate(selectedDate)}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[dateTimeStyles.dateTimeButton, isLight && { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}
        onPress={() => setShowTimePicker(true)}
      >
        <Ionicons 
          name="time-outline" 
          size={wp('5%')} 
          color={isLight ? '#0F172A' : COLORS.text.primary}
          style={dateTimeStyles.iconStyle}
        />
        <Text style={[dateTimeStyles.dateTimeText, isLight && { color: '#0F172A' }]}>
          {formatTime(selectedDate)}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderKeypad = () => (
    <View style={styles.keypad}>
      {[
        ['C', '⌫', '%', '÷'],
        ['7', '8', '9', '×'],
        ['4', '5', '6', '-'],
        ['1', '2', '3', '+'],
        ['0', '00', '.', '=']
      ].map((row, i) => (
        <View key={i} style={styles.keypadRow}>
          {row.map((key) => {
            const isOperator = ['+', '-', '×', '÷', '/', '%'].includes(key);
            const isEquals = key === '=';
            const isClear = key === 'C';
            const isBackspace = key === '⌫';

            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.key,
                  isLight && { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
                  isOperator && (isLight ? { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' } : styles.operatorKey),
                  isClear && (isLight ? { backgroundColor: '#FEE2E2', borderColor: '#FECACA' } : { backgroundColor: 'rgba(239, 68, 68, 0.2)' }),
                  isEquals && { backgroundColor: COLORS.primary }
                ]}
                onPress={() => {
                  if (isProcessing) return;
                  
                  if (key === 'C') {
                    handleClear();
                  } else if (key === '⌫') {
                    handleBackspace();
                  } else if (key === '=') {
                    calculate();
                  } else if (key === '%') {
                    const num = parseFloat(amount);
                    if (!isNaN(num)) {
                      setAmount((num / 100).toString());
                    }
                  } else if (key === '00') {
                    if (amount !== '0' && !amount.includes('.')) {
                      handleNumber('0');
                      handleNumber('0');
                    }
                  } else if (['+', '-', '×', '÷', '/'].includes(key)) {
                    const operator = key === '×' ? '*' : (key === '÷' ? '/' : key);
                    handleOperator(operator);
                  } else if (key === '.') {
                    if (!amount.includes('.')) {
                      handleNumber(key);
                    }
                  } else {
                    handleNumber(key);
                  }
                }}
              >
                <Text style={[
                  styles.keyText,
                  isLight && { color: '#0F172A' },
                  isOperator && { color: isLight ? '#4F46E5' : '#818CF8' },
                  isClear && { color: '#EF4444', fontWeight: 'bold' },
                  isBackspace && { color: isLight ? '#64748B' : '#94A3B8' },
                  isEquals && { color: '#FFFFFF', fontWeight: 'bold' }
                ]}>
                  {key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const renderUPIAppsModal = () => (
    <Modal
      visible={showUPIAppsModal}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        setShowUPIAppsModal(false);
      }}
    >
      <SafeAreaView style={[enhancedStyles.upiModalContainer, isLight && { backgroundColor: '#F8F9FA' }]}>
        {/* Enhanced Header */}
        <View style={[enhancedStyles.upiModalHeader, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
          <TouchableOpacity 
            style={[enhancedStyles.upiBackButton, isLight && { backgroundColor: '#F1F5F9' }]}
            onPress={() => setShowUPIAppsModal(false)}
          >
            <Ionicons name="arrow-back" size={wp('5.5%')} color={isLight ? '#0F172A' : COLORS.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: wp('3%') }}>
            <Text style={[enhancedStyles.upiModalTitle, isLight && { color: '#0F172A' }]}>{t('selectUPIApp') || 'Select UPI App'}</Text>
            <Text style={[enhancedStyles.upiModalSubtitle, isLight && { color: '#64748B' }]}>
              {scannedMerchant?.pn || scannedMerchant?.pa
                ? `${t('Paying') || 'Paying'} ${scannedMerchant.pn || scannedMerchant.pa}`
                : (t('Choose an app to complete payment') || 'Choose an app to complete payment')}
            </Text>
          </View>
          {scannedMerchant?.am ? (
            <View style={[enhancedStyles.amountBadge, isLight && { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
              <Text style={enhancedStyles.amountBadgeText}>₹{parseFloat(scannedMerchant.am).toFixed(2)}</Text>
            </View>
          ) : amount !== '0' ? (
            <View style={[enhancedStyles.amountBadge, isLight && { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
              <Text style={enhancedStyles.amountBadgeText}>₹{parseFloat(amount).toFixed(2)}</Text>
            </View>
          ) : null}
        </View>

        {/* Merchant Info Card */}
        {scannedMerchant?.pa && (
          <View style={[enhancedStyles.merchantCard, isLight && { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
            <View style={[enhancedStyles.merchantIconContainer, isLight && { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="storefront-outline" size={wp('5%')} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: wp('3%') }}>
              <Text style={[enhancedStyles.merchantName, isLight && { color: '#0F172A' }]}>{scannedMerchant.pn || t('Merchant') || 'Merchant'}</Text>
              <Text style={[enhancedStyles.merchantVpa, isLight && { color: '#64748B' }]}>{scannedMerchant.pa}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={wp('5%')} color="#10B981" />
          </View>
        )}

        {/* Divider with label */}
        <View style={enhancedStyles.dividerContainer}>
          <View style={[enhancedStyles.dividerLine, isLight && { backgroundColor: '#E2E8F0' }]} />
          <Text style={[enhancedStyles.dividerText, isLight && { color: '#94A3B8' }]}>{t('AVAILABLE UPI APPS') || 'AVAILABLE UPI APPS'}</Text>
          <View style={[enhancedStyles.dividerLine, isLight && { backgroundColor: '#E2E8F0' }]} />
        </View>

        {isLoadingApps ? (
          <View style={additionalStyles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[additionalStyles.loadingText, isLight && { color: '#0F172A' }]}>{t('checkingInstalledApps') || 'Checking apps...'}</Text>
          </View>
        ) : (
          <FlatList
            data={availableUPIApps}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: wp('4%'), paddingBottom: wp('4%') }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity 
                style={[
                  enhancedStyles.upiAppCard,
                  isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                  index === 0 && { marginTop: wp('1%') },
                ]}
                onPress={() => handleUPIApp(item)}
                activeOpacity={0.7}
              >
                <View style={[enhancedStyles.upiAppIcon, { backgroundColor: item.color || COLORS.primary }]}>
                  <Ionicons name={item.icon || 'wallet'} size={wp('6%')} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, marginLeft: wp('3.5%') }}>
                  <Text style={[enhancedStyles.upiAppName, isLight && { color: '#0F172A' }]}>{item.name}</Text>
                  <Text style={[enhancedStyles.upiAppDesc, isLight && { color: '#64748B' }]}>{item.desc ? (t(item.desc) || item.desc) : (t('Instant UPI Payment') || 'Instant UPI Payment')}</Text>
                </View>
                <View style={[enhancedStyles.upiAppArrow, isLight && { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="chevron-forward" size={wp('4.5%')} color={isLight ? '#94A3B8' : COLORS.text.secondary} />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={enhancedStyles.emptyUpiContainer}>
                <Ionicons name="phone-portrait-outline" size={wp('12%')} color={isLight ? '#94A3B8' : COLORS.text.secondary} />
                <Text style={[enhancedStyles.emptyUpiText, isLight && { color: '#0F172A' }]}>{t('noUPIAppsInstalled') || 'No UPI apps found on your device.'}</Text>
                <Text style={[enhancedStyles.emptyUpiSubtext, isLight && { color: '#64748B' }]}>{t('Install a UPI app like Google Pay or PhonePe to make payments.') || 'Install a UPI app like Google Pay or PhonePe to make payments.'}</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  // Enhanced Payment Confirmation Modal
  const renderPaymentConfirmModal = () => {
    const who = scannedMerchant?.pn || scannedMerchant?.pa || '';
    const displayAmount = scannedMerchant?.am || amount;
    return (
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          animateModalOut(() => setShowConfirmModal(false));
        }}
      >
        <View style={enhancedStyles.modalOverlay}>
          <Animated.View style={[
            enhancedStyles.confirmModalContainer,
            isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            {
              transform: [{ scale: modalScaleAnim }],
              opacity: modalOpacityAnim,
            },
          ]}>
            {/* Top accent gradient bar */}
            <View style={enhancedStyles.modalAccentBar} />

            {/* Icon */}
            <View style={[enhancedStyles.confirmIconContainer, isLight && { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="help-circle" size={wp('14%')} color={COLORS.primary} />
            </View>

            <Text style={[enhancedStyles.confirmTitle, isLight && { color: '#0F172A' }]}>
              {t('paymentCompleteTitle') || 'Payment Complete?'}
            </Text>
            <Text style={[enhancedStyles.confirmMessage, isLight && { color: '#64748B' }]}>
              {t('paymentCompleteMessage') || 'Did the payment go through successfully in your UPI app?'}
            </Text>

            {/* Payment details card */}
            {(who || displayAmount !== '0') && (
              <View style={[enhancedStyles.paymentDetailsCard, isLight && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                {who ? (
                  <View style={enhancedStyles.paymentDetailRow}>
                    <Ionicons name="person-outline" size={wp('4%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
                    <Text style={[enhancedStyles.paymentDetailText, isLight && { color: '#0F172A' }]}>{who}</Text>
                  </View>
                ) : null}
                {displayAmount && displayAmount !== '0' ? (
                  <View style={enhancedStyles.paymentDetailRow}>
                    <Ionicons name="cash-outline" size={wp('4%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
                    <Text style={[enhancedStyles.paymentDetailText, isLight && { color: '#0F172A' }]}>₹{parseFloat(displayAmount).toFixed(2)}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Action buttons */}
            <View style={enhancedStyles.confirmButtonsContainer}>
              <TouchableOpacity
                style={enhancedStyles.confirmSuccessButton}
                onPress={() => {
                  animateModalOut(() => {
                    setShowConfirmModal(false);
                    saveTransaction();
                  });
                }}
              >
                <Ionicons name="checkmark-circle" size={wp('5%')} color="#fff" />
                <Text style={enhancedStyles.confirmSuccessButtonText}>
                  {t('yesPaidBtn') || 'Yes, Paid Successfully'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={enhancedStyles.confirmFailButton}
                onPress={() => {
                  animateModalOut(() => {
                    setShowConfirmModal(false);
                    setShowNotRecordedModal(true);
                    animateModalIn();
                  });
                }}
              >
                <Ionicons name="close-circle" size={wp('5%')} color="#FF4444" />
                <Text style={enhancedStyles.confirmFailButtonText}>
                  {t('paymentFailedBtn') || 'No, It Failed'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={enhancedStyles.confirmEditButton}
                onPress={() => {
                  animateModalOut(() => {
                    setIsDirectSaveAfterEdit(true);
                    setShowConfirmModal(false);
                  });
                }}
              >
                <Text style={[enhancedStyles.confirmEditButtonText, isLight && { color: '#64748B' }]}>
                  {t('editDetailsBtn') || 'Edit Details'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // Enhanced "Not Recorded" Modal (after payment failed)
  const renderNotRecordedModal = () => (
    <Modal
      visible={showNotRecordedModal}
      transparent={true}
      animationType="none"
      onRequestClose={() => {
        animateModalOut(() => setShowNotRecordedModal(false));
      }}
    >
      <View style={enhancedStyles.modalOverlay}>
        <Animated.View style={[
          enhancedStyles.confirmModalContainer,
          isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
          {
            transform: [{ scale: modalScaleAnim }],
            opacity: modalOpacityAnim,
          },
        ]}>
          <View style={[enhancedStyles.modalAccentBar, { backgroundColor: '#FF4444' }]} />

          <View style={[enhancedStyles.confirmIconContainer, { backgroundColor: isLight ? '#FEE2E2' : 'rgba(255,68,68,0.15)' }]}>
            <Ionicons name="alert-circle" size={wp('14%')} color="#FF4444" />
          </View>

          <Text style={[enhancedStyles.confirmTitle, isLight && { color: '#0F172A' }]}>
            {t('notRecordedTitle') || 'Payment Not Recorded'}
          </Text>
          <Text style={[enhancedStyles.confirmMessage, isLight && { color: '#64748B' }]}>
            {t('notRecordedMessage') || 'The expense was not saved. You can try again or pick a different payment method.'}
          </Text>

          <View style={enhancedStyles.confirmButtonsContainer}>
            <TouchableOpacity
              style={[enhancedStyles.confirmSuccessButton, { backgroundColor: COLORS.primary }]}
              onPress={() => {
                animateModalOut(() => {
                  setShowNotRecordedModal(false);
                  // Reopen QR scanner to retry
                  setScannedMerchant(null);
                  setShowMerchantScanner(true);
                });
              }}
            >
              <Ionicons name="refresh" size={wp('5%')} color="#fff" />
              <Text style={enhancedStyles.confirmSuccessButtonText}>{t('Try Again') || 'Try Again'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={enhancedStyles.confirmEditButton}
              onPress={() => {
                animateModalOut(() => setShowNotRecordedModal(false));
              }}
            >
              <Text style={[enhancedStyles.confirmEditButtonText, isLight && { color: '#64748B' }]}>{t('Dismiss') || 'Dismiss'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  // Enhanced Error / Info Modal
  const renderErrorModal = () => {
    const hasAction = Boolean(errorModalConfig.onAction);

    return (
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          animateModalOut(() => setShowErrorModal(false));
        }}
      >
        <View style={enhancedStyles.modalOverlay}>
          <Animated.View style={[
            enhancedStyles.confirmModalContainer,
            isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            {
              transform: [{ scale: modalScaleAnim }],
              opacity: modalOpacityAnim,
            },
          ]}>
            <View style={enhancedStyles.modalAccentBar} />

            <View style={[enhancedStyles.confirmIconContainer, isLight && { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name={errorModalConfig.icon || 'alert-circle-outline'} size={wp('13%')} color={errorModalConfig.iconColor || COLORS.primary} />
            </View>

            <Text style={[enhancedStyles.confirmTitle, isLight && { color: '#0F172A' }]}>{t(errorModalConfig.title) || errorModalConfig.title}</Text>
            <Text style={[enhancedStyles.confirmMessage, isLight && { color: '#64748B' }]}>{t(errorModalConfig.message) || errorModalConfig.message}</Text>

            <View style={enhancedStyles.confirmButtonsContainer}>
              <TouchableOpacity
                style={enhancedStyles.confirmSuccessButton}
                onPress={() => {
                  animateModalOut(() => {
                    setShowErrorModal(false);
                    if (errorModalConfig.onAction) {
                      setTimeout(() => {
                        errorModalConfig.onAction();
                      }, 200);
                    }
                  });
                }}
              >
                <Ionicons name={hasAction ? 'arrow-forward' : 'checkmark'} size={wp('5%')} color="#fff" />
                <Text style={enhancedStyles.confirmSuccessButtonText}>
                  {t(errorModalConfig.buttonText) || errorModalConfig.buttonText || t('gotIt') || 'Got It'}
                </Text>
              </TouchableOpacity>

              {hasAction && (
                <TouchableOpacity
                  style={enhancedStyles.confirmEditButton}
                  onPress={() => {
                    animateModalOut(() => setShowErrorModal(false));
                  }}
                >
                  <Text style={[enhancedStyles.confirmEditButtonText, isLight && { color: '#64748B' }]}>{t('cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={[styles.container, isLight && { backgroundColor: '#F8F9FA' }]}>
        {/* Header */}
        <View style={[styles.header, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.headerButton, styles.cancelButton]}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.headerButton, styles.saveButton]}>{t('save')}</Text>
          </TouchableOpacity>
        </View>

        {/* Type Selector */}
        <View style={styles.typeSelector}>
          {['INCOME', 'EXPENSE', 'TRANSFER'].map((typeOption) => (
            <TouchableOpacity 
              key={typeOption}
              style={[
                styles.typeButton, 
                isLight && { backgroundColor: '#E2E8F0' },
                type === typeOption && styles.activeType
              ]}
              onPress={() => setType(typeOption)}
            >
              <Text style={[
                styles.typeText, 
                isLight && { color: '#0F172A' },
                type === typeOption && styles.activeTypeText
              ]}>
                {t(typeOption.toLowerCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
                  
        {/* Input Section */}
        <View style={styles.inputSection}>
          {type === 'TRANSFER' ? (
            renderTransferFields()
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.inputField, isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}
                onPress={() => setShowAccountModal(true)}
              >
                <Text style={{ color: isLight ? (account ? '#0F172A' : '#64748B') : (account ? COLORS.text.primary : COLORS.text.secondary) }}>
                  {getAccountLabel(account)}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.inputField, isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text style={{ color: isLight ? (category ? '#0F172A' : '#64748B') : (category ? COLORS.text.primary : COLORS.text.secondary) }}>
                  {getCategoryLabel(category)}
                </Text>
              </TouchableOpacity>
            </>
          )}
          
          <View style={[styles.inputField, isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
            <TextInput
              placeholder={t('addNotes')}
              placeholderTextColor={isLight ? '#94A3B8' : COLORS.text.secondary}
              style={[styles.noteInput, isLight && { color: '#0F172A' }]}
              value={note}
              onChangeText={setNote}
            />
          </View>
        </View>

        {/* Date and Time Pickers */}
        {renderDateTime()}

        {/* Display Section */}
        {renderDisplay()}

        {/* Keypad */}
        {renderKeypad()}

        {/* Date Time Picker Modals */}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            is24Hour={true}
            display="default"
            onChange={onDateChange}
          />
        )}

        {showTimePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={selectedDate}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={onTimeChange}
          />
        )}
        
        {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showDatePicker || showTimePicker}
          >
            <View style={{
              flex: 1,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}>
              <View style={{
                backgroundColor: isLight ? '#FFFFFF' : '#1C1B26',
                padding: wp('4%'),
                borderTopLeftRadius: wp('4%'),
                borderTopRightRadius: wp('4%'),
                borderTopWidth: isLight ? 1 : 0,
                borderTopColor: '#E2E8F0',
              }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: wp('4%'),
                }}>
                  <TouchableOpacity onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}>
                    <Text style={{ color: COLORS.primary, fontSize: wp('4%') }}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}>
                    <Text style={{ color: COLORS.primary, fontSize: wp('4%') }}>{t('done')}</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode={showDatePicker ? "date" : "time"}
                  display="spinner"
                  onChange={showDatePicker ? onDateChange : onTimeChange}
                  style={{ height: hp('25%') }}
                  textColor={isLight ? "#000000" : "#FFFFFF"}
                  themeVariant={isLight ? "light" : "dark"}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Category Selection Modal */}
        <Modal
          visible={showCategoryModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setShowCategoryModal(false);
            setCategorySearchQuery('');
          }}
        >
          <SafeAreaView style={[styles.modalContainer, isLight && { backgroundColor: '#FFFFFF' }]}>
            <View style={[styles.modalHeader, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
              <View style={styles.modalHeaderLeft}>
                <TouchableOpacity
                  onPress={() => {
                    setShowCategoryModal(false);
                    setCategorySearchQuery('');
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.modalBackBtn}
                >
                  <Ionicons name="arrow-back" size={wp('6%')} color={isLight ? '#0F172A' : COLORS.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>{t('selectCategory')}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setShowCategoryModal(false);
                setCategorySearchQuery('');
              }}>
                <Text style={styles.modalDoneText}>{t('done')}</Text>
              </TouchableOpacity>
            </View>

            {/* Category Search Input */}
            <View style={[styles.searchBarContainer, isLight && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
              <Ionicons name="search" size={wp('4.5%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
              <TextInput
                placeholder={t('Search categories...') || 'Search categories...'}
                placeholderTextColor={isLight ? '#94A3B8' : COLORS.text.secondary}
                value={categorySearchQuery}
                onChangeText={setCategorySearchQuery}
                style={[styles.searchBarInput, isLight && { color: '#0F172A' }]}
              />
              {categorySearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCategorySearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={wp('4.5%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={((state?.categories && state.categories[type]) || CATEGORIES[type] || []).filter(item => {
                if (!categorySearchQuery.trim()) return true;
                const q = categorySearchQuery.toLowerCase().trim();
                const trans = (t(item) || '').toLowerCase();
                return item.toLowerCase().includes(q) || trans.includes(q);
              })}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.listItem, isLight && { borderBottomColor: '#E2E8F0' }]}
                  onPress={() => {
                    setCategory(item);
                    setShowCategoryModal(false);
                    setCategorySearchQuery('');
                  }}
                >
                  <Text style={[styles.listItemText, isLight && { color: '#0F172A' }]}>
                    {getCategoryLabel(item)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>

        {/* Account Selection Modal */}
        <Modal
          visible={showAccountModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setShowAccountModal(false);
            setAccountSearchQuery('');
          }}
        >
          <SafeAreaView style={[styles.modalContainer, isLight && { backgroundColor: '#FFFFFF' }]}>
            <View style={[styles.modalHeader, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
              <View style={styles.modalHeaderLeft}>
                <TouchableOpacity
                  onPress={() => {
                    setShowAccountModal(false);
                    setAccountSearchQuery('');
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.modalBackBtn}
                >
                  <Ionicons name="arrow-back" size={wp('6%')} color={isLight ? '#0F172A' : COLORS.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>{t('selectAccount')}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setShowAccountModal(false);
                setAccountSearchQuery('');
              }}>
                <Text style={styles.modalDoneText}>{t('done')}</Text>
              </TouchableOpacity>
            </View>

            {/* Account Search Input */}
            <View style={[styles.searchBarContainer, isLight && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
              <Ionicons name="search" size={wp('4.5%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
              <TextInput
                placeholder={t('Search accounts...') || 'Search accounts...'}
                placeholderTextColor={isLight ? '#94A3B8' : COLORS.text.secondary}
                value={accountSearchQuery}
                onChangeText={setAccountSearchQuery}
                style={[styles.searchBarInput, isLight && { color: '#0F172A' }]}
              />
              {accountSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setAccountSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={wp('4.5%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
                data={((state?.accounts && state.accounts.length > 0) ? state.accounts : ACCOUNTS).filter(item => {
                  if (!accountSearchQuery.trim()) return true;
                  const q = accountSearchQuery.toLowerCase().trim();
                  const trans = (getAccountLabel(item) || '').toLowerCase();
                  return item.toLowerCase().includes(q) || trans.includes(q);
                })}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.listItem, isLight && { borderBottomColor: '#E2E8F0' }]}
                    onPress={() => {
                      setAccount(item);
                      setShowAccountModal(false);
                      setAccountSearchQuery('');
                    }}
                  >
                    <Text style={[styles.listItemText, isLight && { color: '#0F172A' }]}>
                      {getAccountLabel(item)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </SafeAreaView>
          </Modal>
        
        {/* From Account Selection Modal */}
        <Modal
          visible={showFromAccountModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowFromAccountModal(false)}
        >
          <SafeAreaView style={[styles.modalContainer, isLight && { backgroundColor: '#FFFFFF' }]}>
            <View style={[styles.modalHeader, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
              <View style={styles.modalHeaderLeft}>
                <TouchableOpacity
                  onPress={() => setShowFromAccountModal(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.modalBackBtn}
                >
                  <Ionicons name="arrow-back" size={wp('6%')} color={isLight ? '#0F172A' : COLORS.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>{t('selectSourceAccount')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFromAccountModal(false)}>
                <Text style={styles.modalDoneText}>{t('done')}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={(state?.accounts && state.accounts.length > 0) ? state.accounts : ACCOUNTS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.listItem, isLight && { borderBottomColor: '#E2E8F0' }]}
                  onPress={() => {
                    setFromAccount(item);
                    setShowFromAccountModal(false);
                  }}
                >
                  <Text style={[styles.listItemText, isLight && { color: '#0F172A' }]}>
                    {getAccountLabel(item)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>

        {/* To Account Selection Modal */}
        <Modal
          visible={showToAccountModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowToAccountModal(false)}
        >
          <SafeAreaView style={[styles.modalContainer, isLight && { backgroundColor: '#FFFFFF' }]}>
            <View style={[styles.modalHeader, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
              <View style={styles.modalHeaderLeft}>
                <TouchableOpacity
                  onPress={() => setShowToAccountModal(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.modalBackBtn}
                >
                  <Ionicons name="arrow-back" size={wp('6%')} color={isLight ? '#0F172A' : COLORS.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>{t('selectDestinationAccount')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowToAccountModal(false)}>
                <Text style={styles.modalDoneText}>{t('done')}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={((state?.accounts && state.accounts.length > 0) ? state.accounts : ACCOUNTS).filter(acc => acc !== fromAccount)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.listItem, isLight && { borderBottomColor: '#E2E8F0' }]}
                  onPress={() => {
                    setToAccount(item);
                    setShowToAccountModal(false);
                  }}
                >
                  <Text style={[styles.listItemText, isLight && { color: '#0F172A' }]}>
                    {getAccountLabel(item)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>

        {/* Payment Method Selection Modal */}
        <Modal
          visible={showPaymentModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowPaymentModal(false)}
        >
          <SafeAreaView style={[styles.modalContainer, isLight && { backgroundColor: '#F8F9FA' }]}>
            <View style={[styles.modalHeader, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>{t('Payment Method') || t('selectPaymentMethod') || 'Payment Method'}</Text>
                <Text style={{ fontSize: wp('3.2%'), color: isLight ? '#64748B' : COLORS.text.secondary, marginTop: 2 }}>
                  {t('How would you like to process this expense?') || 'How would you like to process this expense?'}
                </Text>
              </View>
              <TouchableOpacity 
                style={{ padding: wp('2%') }}
                onPress={() => setShowPaymentModal(false)}
              >
                <Ionicons name="close" size={wp('6%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={paymentMethods}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: wp('4%') }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.upiCard, isLight && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}
                  onPress={() => handlePayment(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.upiIconContainer, { backgroundColor: item.color || '#2563EB' }]}>
                    <Ionicons name={item.icon || 'card-outline'} size={wp('6%')} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: wp('3.5%') }}>
                    <Text style={[styles.upiCardTitle, isLight && { color: '#0F172A' }]}>{item.name}</Text>
                    <Text style={[styles.upiCardSubtitle, isLight && { color: '#64748B' }]}>{item.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={wp('5%')} color={isLight ? '#94A3B8' : COLORS.text.secondary} />
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>

        {/* UPI Apps Selection Modal */}
        {renderUPIAppsModal()}

        {/* In-app merchant QR scanner (Option 1 entry point) */}
        <QRScannerModal
          visible={showMerchantScanner}
          onClose={() => setShowMerchantScanner(false)}
          onScanSuccess={handleMerchantScanned}
        />

        {/* Enhanced modals */}
        {renderPaymentConfirmModal()}
        {renderNotRecordedModal()}
        {renderErrorModal()}

        {/* Loading Overlay for Payment Processing */}
        {paymentPending && (
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center'
          }]}>
            <View style={{
              backgroundColor: isLight ? '#FFFFFF' : COLORS.lightbackground,
              padding: wp('8%'),
              borderRadius: wp('4%'),
              alignItems: 'center',
              borderWidth: 1,
              borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
              minWidth: wp('60%'),
            }}>
              <View style={{
                width: wp('16%'),
                height: wp('16%'),
                borderRadius: wp('8%'),
                backgroundColor: isLight ? '#EEF2FF' : 'rgba(48,33,224,0.15)',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: wp('4%'),
              }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
              <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }, { marginTop: wp('1%'), fontSize: wp('4.2%') }]}>
                {t('processingPayment') || 'Processing Payment'}
              </Text>
              <Text style={{ color: isLight ? '#64748B' : COLORS.text.secondary, fontSize: wp('3.2%'), marginTop: wp('1%') }}>
                {t('Opening your UPI app...') || 'Opening your UPI app...'}
              </Text>
            </View>
          </View>
        )}

      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

export default ExpenseCalculator;

// Styles
const additionalStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: wp('2%'),
    color: COLORS.text.primary,
    fontSize: wp('4%'),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('4%'),
  },
  emptyText: {
    color: COLORS.text.secondary,
    fontSize: wp('4%'),
  },
});

const dateTimeStyles = StyleSheet.create({
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('3%'),
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.lightbackground,
    marginBottom: wp('2%'),
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('3%'),
    borderRadius: wp('2%'),
    backgroundColor: COLORS.lightbackground,
    minWidth: wp('40%'), // Set minimum width for consistency
    justifyContent: 'center',
  },
  dateTimeText: {
    color: COLORS.text.primary,
    fontSize: wp('4%'),
    marginLeft: wp('2%'),
    fontWeight: '500',
  },
  iconStyle: {
    marginRight: wp('2%'),
  }
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightbackground,
  },
  paymentMethodText: {
    fontSize: wp('4%'),
    color: COLORS.text.primary,
    marginLeft: wp('3%'),
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp('4%'),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightbackground
  },
  headerButton: {
    fontSize: wp('4%'),
    fontWeight: '500'
  },
  cancelButton: {
    color: '#ff6b6b'
  },
  saveButton: {
    color: '#51cf66'
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: wp('4%'),
    gap: wp('4%')
  },
  typeButton: {
    padding: wp('2%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('4%')
  },
  activeType: {
    backgroundColor: COLORS.primary,
  },
  typeText: {
    color: COLORS.text.primary,
    fontSize: wp('4%')
  },
  activeTypeText: {
    color: COLORS.whiteBg
  },
  inputSection: {
    padding: wp('4%'),
    gap: wp('4%')
  },
  inputField: {
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: COLORS.lightbackground,
    borderRadius: wp('2%'),
    fontSize: wp('4%'),
    justifyContent: 'center'
  },
  displaySection: {
    padding: wp('4%'),
    alignItems: 'flex-end',
    backgroundColor: COLORS.lightbackground,
    minHeight: hp('15%')
  },
  expression: {
    fontSize: wp('5%'),
    color: COLORS.text.secondary
  },
  amount: {
    fontSize: wp('8%'),
    color: COLORS.text.primary,
    fontWeight: '500'
  },
  originalAmount: {
    fontSize: wp('4%'),
    color: COLORS.text.secondary,
    marginLeft: wp('2%'),
  },
  keypad: {
    flex: 1,
    padding: wp('2%')
  },
  keypadRow: {
    flexDirection: 'row',
    flex: 1
  },
  key: {
    flex: 1,
    margin: wp('1%'),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp('2%')
  },
  operatorKey: {
    backgroundColor: COLORS.primary + '20'
  },
  keyText: {
    fontSize: wp('6%'),
    color: COLORS.text.primary
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp('4%'),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightbackground,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: wp('4%'),
    marginVertical: hp('1%'),
    paddingHorizontal: wp('3.5%'),
    height: hp('5.5%'),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchBarInput: {
    flex: 1,
    marginLeft: wp('2%'),
    fontSize: wp('3.8%'),
    color: COLORS.text.primary,
    paddingVertical: 0,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalBackBtn: {
    paddingRight: wp('3%'),
    paddingVertical: hp('0.5%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  modalDoneText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: wp('4%'),
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
  },
  listItem: {
    padding: wp('4%'),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightbackground,
  },
  listItemText: {
    fontSize: wp('4%'),
    color: COLORS.text.primary,
  },
  upiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightbackground,
    padding: wp('3.5%'),
    borderRadius: wp('3%'),
    marginBottom: wp('3%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  upiIconContainer: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('2.8%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiCardTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  upiCardSubtitle: {
    fontSize: wp('3%'),
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  noteInput: {
    color: COLORS.text.primary,
    fontSize: wp('4%'),
    padding: 0,
  },
  ...additionalStyles,
});

// Enhanced styles for premium modals and UPI app picker
const enhancedStyles = StyleSheet.create({
  // UPI Apps Modal Enhanced Styles
  upiModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  upiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('3.5%'),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: COLORS.lightbackground,
  },
  upiBackButton: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiModalTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: COLORS.text.primary,
    letterSpacing: 0.3,
  },
  upiModalSubtitle: {
    fontSize: wp('3.2%'),
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  amountBadge: {
    backgroundColor: 'rgba(48,33,224,0.2)',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: wp('1.5%'),
    borderRadius: wp('5%'),
    borderWidth: 1,
    borderColor: 'rgba(48,33,224,0.3)',
  },
  amountBadgeText: {
    fontSize: wp('3.8%'),
    fontWeight: '700',
    color: COLORS.primary,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: wp('4%'),
    marginTop: wp('3%'),
    padding: wp('3.5%'),
    backgroundColor: 'rgba(48,33,224,0.08)',
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: 'rgba(48,33,224,0.15)',
  },
  merchantIconContainer: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: 'rgba(48,33,224,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantName: {
    fontSize: wp('3.8%'),
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  merchantVpa: {
    fontSize: wp('3%'),
    color: COLORS.text.secondary,
    marginTop: 1,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    marginTop: wp('4%'),
    marginBottom: wp('2%'),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontSize: wp('2.8%'),
    fontWeight: '600',
    color: COLORS.text.secondary,
    letterSpacing: 1.5,
    marginHorizontal: wp('3%'),
  },
  upiAppCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightbackground,
    padding: wp('3.5%'),
    borderRadius: wp('3.5%'),
    marginBottom: wp('2.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  upiAppIcon: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('3%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiAppName: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  upiAppDesc: {
    fontSize: wp('3%'),
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  upiAppArrow: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyUpiContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('8%'),
    marginTop: wp('10%'),
  },
  emptyUpiText: {
    color: COLORS.text.primary,
    fontSize: wp('4%'),
    fontWeight: '600',
    marginTop: wp('4%'),
    textAlign: 'center',
  },
  emptyUpiSubtext: {
    color: COLORS.text.secondary,
    fontSize: wp('3.2%'),
    marginTop: wp('2%'),
    textAlign: 'center',
    lineHeight: wp('5%'),
  },

  // Enhanced Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('6%'),
  },
  confirmModalContainer: {
    width: '100%',
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp('5%'),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalAccentBar: {
    width: '100%',
    height: wp('1.2%'),
    backgroundColor: COLORS.primary,
  },
  confirmIconContainer: {
    width: wp('20%'),
    height: wp('20%'),
    borderRadius: wp('10%'),
    backgroundColor: 'rgba(48,33,224,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: wp('6%'),
  },
  confirmTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginTop: wp('4%'),
    paddingHorizontal: wp('4%'),
  },
  confirmMessage: {
    fontSize: wp('3.5%'),
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: wp('2%'),
    paddingHorizontal: wp('6%'),
    lineHeight: wp('5.5%'),
  },
  paymentDetailsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: wp('5%'),
    marginTop: wp('4%'),
    borderRadius: wp('3%'),
    padding: wp('3.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  paymentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: wp('1.5%'),
  },
  paymentDetailText: {
    fontSize: wp('3.5%'),
    color: COLORS.text.primary,
    marginLeft: wp('2.5%'),
    fontWeight: '500',
  },
  confirmButtonsContainer: {
    padding: wp('5%'),
    paddingTop: wp('4%'),
  },
  confirmSuccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: wp('3.8%'),
    borderRadius: wp('3%'),
    marginBottom: wp('2.5%'),
  },
  confirmSuccessButtonText: {
    fontSize: wp('3.8%'),
    fontWeight: '700',
    color: '#fff',
    marginLeft: wp('2%'),
  },
  confirmFailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,68,68,0.12)',
    paddingVertical: wp('3.8%'),
    borderRadius: wp('3%'),
    marginBottom: wp('2.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  confirmFailButtonText: {
    fontSize: wp('3.8%'),
    fontWeight: '600',
    color: '#FF4444',
    marginLeft: wp('2%'),
  },
  confirmEditButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: wp('2.5%'),
  },
  confirmEditButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
});
