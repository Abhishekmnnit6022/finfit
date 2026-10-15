// components/MoneyTracker.js

import ReceiptParser from "../utils/ReceiptParser";
import LottieView from "lottie-react-native";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  TextInput,
  ScrollView,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import * as ImagePicker from "expo-image-picker";
import { formatCurrency } from "../utils/currencyService";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import ExpenseCalculator from "./ExpenseCalculator";
import TransactionRecord from "./TransactionRecord";
import { FilterModal } from "./FilterModal";
import CommonHeader from "./commonheader";
import { useGlobalContext } from "./globalProvider";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";
import { hi, ta } from "date-fns/locale";
import { useTranslation } from "react-i18next";

const MoneyTracker = () => {
  const { onSave, state, dispatch, convertAmount, loadExpensesFromDB } =
    useGlobalContext();
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const { t, i18n } = useTranslation();

  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({ type: "ALL", categories: [] });
  const [showFabGuide, setShowFabGuide] = useState(false);

  // Animated scale values for buttons
  const plusScale = React.useRef(new Animated.Value(1)).current;
  const cameraScale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = (anim) => {
    Animated.spring(anim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (anim) => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    loadExpensesFromDB();
    const checkFabGuide = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem("FINFIT_FAB_GUIDE_DISMISSED");
        if (!hasSeen) {
          setShowFabGuide(true);
        }
      } catch (err) {
        console.warn("Error reading fab guide status:", err?.message);
      }
    };
    checkFabGuide();
  }, []);

  const dismissFabGuide = async () => {
    try {
      await AsyncStorage.setItem("FINFIT_FAB_GUIDE_DISMISSED", "true");
      setShowFabGuide(false);
    } catch (err) {
      setShowFabGuide(false);
    }
  };

  const getDateLocale = useCallback(() => {
    const lang = (i18n.language || state.language || "").toLowerCase();
    if (lang.includes("hi") || lang.includes("hn")) return hi;
    if (lang.includes("ta") || lang.includes("tm")) return ta;
    return undefined;
  }, [i18n.language, state.language]);

  const formattedMonthText = useMemo(() => {
    try {
      const date = parseISO(state.currentMonth);
      return format(date, "MMMM, yyyy", { locale: getDateLocale() });
    } catch (e) {
      return format(parseISO(state.currentMonth), "MMMM, yyyy");
    }
  }, [state.currentMonth, getDateLocale]);

  useEffect(() => {
    if (state.language && i18n.language !== state.language) {
      i18n.changeLanguage(state.language);
    } else {
      i18n.changeLanguage(state.language);
    }
  }, [state.language]);

  // Memoize all categories
  const allCategories = useMemo(() => {
    return [...state.categories.EXPENSE, ...state.categories.INCOME];
  }, [state.categories]);

  // Filter transactions for current month, search term, and filters
  const currentMonthTransactions = useMemo(() => {
    return state.transactions.filter((transaction) => {
      const transactionDate = parseISO(transaction.date);
      const monthStart = startOfMonth(parseISO(state.currentMonth));
      const monthEnd = endOfMonth(parseISO(state.currentMonth));

      const isInCurrentMonth = isWithinInterval(transactionDate, {
        start: monthStart,
        end: monthEnd,
      });

      // Search filter
      let matchesSearch = true;
      if (searchTerm && searchTerm.trim() !== "") {
        const searchLower = searchTerm.toLowerCase();
        const noteMatch =
          transaction.note &&
          transaction.note.toLowerCase().includes(searchLower);
        const categoryMatch =
          transaction.category &&
          transaction.category.toLowerCase().includes(searchLower);
        const accountMatch =
          transaction.account &&
          transaction.account.toLowerCase().includes(searchLower);
        matchesSearch = noteMatch || categoryMatch || accountMatch;
      }

      // Type filter
      let matchesType = true;
      if (filters.type !== "ALL") {
        matchesType = transaction.type === filters.type;
      }

      // Category filter
      let matchesCategory = true;
      if (filters.categories.length > 0) {
        matchesCategory = filters.categories.includes(transaction.category);
      }

      // Exclude 'TRANSFER' transactions
      return (
        isInCurrentMonth &&
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        transaction.type !== "TRANSFER"
      );
    });
  }, [
    state.transactions,
    state.currentMonth,
    searchTerm,
    filters.type,
    filters.categories,
  ]);

  // Calculate summary for current month with currency conversion
  const currentMonthSummary = useMemo(() => {
    const summary = currentMonthTransactions.reduce(
      (acc, transaction) => {
        const amount = parseFloat(transaction.amount);
        const convertedAmount = convertAmount(
          amount,
          transaction.currency || "USD",
          state.defaultCurrency
        );

        if (isNaN(convertedAmount)) return acc;

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
  }, [currentMonthTransactions, convertAmount, state.defaultCurrency]);

  const handleApplyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleSearchPress = () => {
    setShowSearchBar(!showSearchBar);
    if (showSearchBar) {
      setSearchTerm("");
    }
  };

  const showImageSourceOptions = () => {
    Alert.alert(
      "Select Image Source",
      "Choose where you want to pick the image from",
      [
        {
          text: "Camera",
          onPress: () => pickImage("camera"),
        },
        {
          text: "Gallery",
          onPress: () => pickImage("gallery"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const pickImage = async (source) => {
    try {
      let permissionResult;
      let result;

      if (source === "camera") {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert(
            "Permission Error",
            "Permission to access camera is required!"
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
          base64: true,
          maxWidth: 1200,
          maxHeight: 1600,
        });
      } else {
        permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert(
            "Permission Error",
            "Permission to access gallery is required!"
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
          base64: true,
          maxWidth: 1200,
          maxHeight: 1600,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        await handleOCR(result.assets[0].base64);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to capture/select image. Please try again.");
    }
  };

  const openCalculatorWithDetails = (prefill) => {
    setEditingTransaction({
      isFromOCR: true,
      amount: parseFloat(prefill.amount) || 0,
      type: "EXPENSE",
      date: prefill.date || new Date().toISOString(),
      category: prefill.category || "",
      account: prefill.account || "Cash",
      note: prefill.notes || prefill.merchant || "",
      currency: state.defaultCurrency || "INR",
      openCategoryPicker: Boolean(prefill.openCategoryPicker),
    });
    setShowCalculator(true);
  };

  const handleOCR = async (base64Image) => {
    try {
      const parser = new ReceiptParser();
      const availableCategories = state.categories?.EXPENSE || [
        "Food & Dining",
        "Transportation",
        "Shopping",
        "Entertainment",
        "Bills & Utilities",
        "Health & Fitness",
        "Travel",
        "Other"
      ];
      const details = await parser.parseReceipt(base64Image, { categories: availableCategories });

      if (!details || !details.amount || details.amount <= 0) {
        Alert.alert(
          "Receipt Amount Unclear",
          `Could not clearly identify the total amount from the photo.\n\nMerchant: ${details?.merchant || 'Unknown'}\n\nWould you like to review and enter the amount manually?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Review & Enter",
              onPress: () => {
                openCalculatorWithDetails({
                  amount: 0,
                  category: details?.category && details?.category !== "Other" ? details.category : "",
                  account: details?.account || "Cash",
                  notes: details?.notes || details?.merchant || "",
                  openCategoryPicker: true,
                });
              },
            },
          ]
        );
        return;
      }

      const hasValidCategory = details.category && details.category !== 'Other';

      if (hasValidCategory) {
        Alert.alert(
          "Receipt Scanned",
          `Amount: ${formatCurrency(
            details.amount,
            state.defaultCurrency
          )}\nCategory: ${details.category} (Auto-Categorized)\nAccount: ${details.account}${
            details.notes ? `\nNote: ${details.notes}` : ''
          }\n\nIs this category correct for budget tracking?`,
          [
            {
              text: "Save",
              onPress: async () => {
                const formattedTransaction = {
                  amount: parseFloat(details.amount),
                  type: "EXPENSE",
                  date: details.date || new Date().toISOString(),
                  category: details.category,
                  account: details.account || "Cash",
                  note: details.notes || "",
                  currency: state.defaultCurrency || "INR",
                };

                try {
                  await onSave(formattedTransaction);
                  await loadExpensesFromDB();
                  Alert.alert("Success", "Transaction added successfully!");
                } catch (error) {
                  console.error("Error saving transaction:", error);
                  Alert.alert(
                    "Error",
                    "Failed to save transaction. Please try again."
                  );
                }
              },
            },
            {
              text: "Edit",
              onPress: () => {
                openCalculatorWithDetails({
                  ...details,
                  openCategoryPicker: true,
                });
              },
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
      } else {
        // Prompt user to select category for budget tracking & notifications
        Alert.alert(
          "Category Needed for Budget Tracking",
          `Amount: ${formatCurrency(
            details.amount,
            state.defaultCurrency
          )}\nMerchant: ${details.merchant || details.notes || 'Receipt'}\n\nWe couldn't automatically determine the category. Please pick a category so your budget tracking and notifications stay accurate:`,
          [
            {
              text: "Edit",
              onPress: () => {
                openCalculatorWithDetails({
                  ...details,
                  category: "",
                  openCategoryPicker: true,
                });
              },
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
      }
    } catch (error) {
      console.error("Receipt Processing Error:", error);
      Alert.alert(
        "Receipt Scan Issue",
        "Could not automatically scan the receipt. Would you like to enter the transaction manually?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enter Manually",
            onPress: () => {
              setEditingTransaction(null);
              setShowCalculator(true);
            },
          },
        ]
      );
    }
  };

  const handleEdit = useCallback((transaction) => {
    setEditingTransaction(transaction);
    setShowCalculator(true);
  }, []);

  const handleSaveTransaction = async (transactionData) => {
    try {
      const transactionWithCurrency = {
        ...transactionData,
        currency: transactionData.currency || state.defaultCurrency,
      };

      await onSave(transactionWithCurrency);
      await loadExpensesFromDB();
      setEditingTransaction(null);
      setShowCalculator(false);
    } catch (error) {
      console.error("Error saving transaction:", error);
      Alert.alert("Error", "Failed to save transaction. Please try again.");
    }
  };

  const handlePreviousMonth = () => {
    dispatch({ type: "PREVIOUS_MONTH" });
  };

  const handleNextMonth = () => {
    dispatch({ type: "NEXT_MONTH" });
  };

  const renderTransaction = useCallback(
    (transaction) => (
      <TransactionRecord
        key={transaction.id}
        transaction={transaction}
        onEdit={handleEdit}
      />
    ),
    [handleEdit]
  );

  return (
    <View style={styles.container}>
      {/* Common Header */}
      <CommonHeader
        searchIconShown={true}
        onSearchPress={handleSearchPress}
        filterIconShown={true}
        onFilterPress={() => setFilterModalVisible(true)}
        showFilterBadge={filters.type !== "ALL" || filters.categories.length > 0}
      />

      {/* Search Input */}
      {showSearchBar && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor={COLORS.text.secondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoFocus
          />
        </View>
      )}

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={handlePreviousMonth}>
          <Ionicons
            name="chevron-back"
            size={wp("6%")}
            color={COLORS.text.primary}
          />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {formattedMonthText}
        </Text>
        <TouchableOpacity onPress={handleNextMonth}>
          <Ionicons
            name="chevron-forward"
            size={wp("6%")}
            color={COLORS.text.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Summary Section */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("Expenses")}</Text>
          <Text style={[styles.summaryAmount, { color: "#ff6b6b" }]}>
            {formatCurrency(
              currentMonthSummary.expense,
              state.defaultCurrency
            )}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("Income")}</Text>
          <Text style={[styles.summaryAmount, { color: "#51cf66" }]}>
            {formatCurrency(currentMonthSummary.income, state.defaultCurrency)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("Total")}</Text>
          <Text
            style={[
              styles.summaryAmount,
              {
                color: currentMonthSummary.total >= 0 ? "#51cf66" : "#ff6b6b",
              },
            ]}
          >
            {formatCurrency(currentMonthSummary.total, state.defaultCurrency)}
          </Text>
        </View>
      </View>

      {/* Transaction List */}
      <ScrollView style={styles.transactionList}>
        {currentMonthTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <LottieView
              source={require("../assets/animation/empty.json")}
              autoPlay
              loop
              style={styles.animation}
            />
            <Text style={styles.emptyText}>
              {searchTerm ||
              filters.type !== "ALL" ||
              filters.categories.length > 0
                ? "No transactions match your filters"
                : "No transactions this month"}
            </Text>
          </View>
        ) : (
          currentMonthTransactions.map(renderTransaction)
        )}
      </ScrollView>

      {/* First-install hover/coachmark guide overlay */}
      {showFabGuide && (
        <View style={styles.fabGuideOverlay}>
          <TouchableOpacity
            style={styles.fabGuideBackdrop}
            activeOpacity={1}
            onPress={dismissFabGuide}
          />
          <View style={styles.fabGuideCard}>
            <View style={styles.fabGuideHeader}>
              <Ionicons name="sparkles" size={wp("4.5%")} color="#F59E0B" />
              <Text style={styles.fabGuideTitle}>
                {t("Quick Actions Guide") || "Quick Actions"}
              </Text>
            </View>

            <View style={styles.fabGuideItem}>
              <View style={styles.fabGuideIconWrap}>
                <Ionicons name="add" size={wp("4.5%")} color="#FFFFFF" />
              </View>
              <View style={styles.fabGuideTextWrap}>
                <Text style={styles.fabGuideItemTitle}>
                  {t("Manual Record") || "Manual Record"}
                </Text>
                <Text style={styles.fabGuideItemDesc}>
                  {t("Tap to add an expense, income, or transfer") ||
                    "Tap to add an expense, income, or transfer"}
                </Text>
              </View>
            </View>

            <View style={styles.fabGuideItem}>
              <View style={styles.fabGuideIconWrap}>
                <Ionicons name="camera" size={wp("4%")} color="#FFFFFF" />
              </View>
              <View style={styles.fabGuideTextWrap}>
                <Text style={styles.fabGuideItemTitle}>
                  {t("AI Smart Scan") || "AI Smart Scan"}
                </Text>
                <Text style={styles.fabGuideItemDesc}>
                  {t("Scan receipt or bill using camera or gallery") ||
                    "Scan receipt or bill using camera or gallery"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.fabGuideDismissBtn}
              onPress={dismissFabGuide}
              activeOpacity={0.8}
            >
              <Text style={styles.fabGuideDismissText}>
                {t("Got it!") || "Got it!"}
              </Text>
            </TouchableOpacity>

            <View style={styles.fabGuidePointerArrow} />
          </View>
        </View>
      )}

      {/* Floating Action Buttons */}
      {/* Plus button for manual expense entry with tactile spring animation */}
      <Animated.View
        style={[
          styles.addButton,
          {
            transform: [{ scale: plusScale }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.buttonInner}
          activeOpacity={0.9}
          onPressIn={() => handlePressIn(plusScale)}
          onPressOut={() => handlePressOut(plusScale)}
          onPress={() => setShowCalculator(true)}
        >
          <Ionicons name="add" size={wp("7.5%")} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Camera button for OCR receipt scanning with tactile spring animation */}
      <Animated.View
        style={[
          styles.cameraButton,
          {
            transform: [{ scale: cameraScale }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.buttonInner}
          activeOpacity={0.9}
          onPressIn={() => handlePressIn(cameraScale)}
          onPressOut={() => handlePressOut(cameraScale)}
          onPress={showImageSourceOptions}
        >
          <Ionicons name="camera" size={wp("6.5%")} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Calculator Modal */}
      <Modal
        visible={showCalculator}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowCalculator(false);
          setEditingTransaction(null);
        }}
      >
        <ExpenseCalculator
          key={editingTransaction ? (editingTransaction.id || `ocr-${editingTransaction.amount}-${editingTransaction.category}`) : 'new'}
          onClose={() => {
            setShowCalculator(false);
            setEditingTransaction(null);
          }}
          onSave={handleSaveTransaction}
          initialData={editingTransaction}
          defaultCurrency={state.defaultCurrency}
        />
      </Modal>

      {/* Filter Modal */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApplyFilters={handleApplyFilters}
        categories={allCategories}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchContainer: {
    padding: wp("4%"),
    backgroundColor: COLORS.lightbackground,
  },
  searchInput: {
    height: hp("6%"),
    borderColor: COLORS.text.secondary,
    borderWidth: 1,
    color: COLORS.text.primary,
    borderRadius: 5,
    paddingHorizontal: wp("2%"),
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: wp("4%"),
    backgroundColor: COLORS.lightbackground,
  },
  monthText: {
    fontSize: wp("4.5%"),
    fontWeight: "500",
    flex: 1,
    textAlign: "center",
    color: COLORS.text.primary,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: wp("4%"),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightbackground,
    backgroundColor: COLORS.background,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: {
    fontSize: wp("3%"),
    color: COLORS.text.secondary,
    marginBottom: hp("0.5%"),
  },
  summaryAmount: { fontSize: wp("4%"), fontWeight: "500" },
  transactionList: { flex: 1, backgroundColor: COLORS.background },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: wp("8%"),
    backgroundColor: COLORS.background,
    minHeight: hp("50%"),
  },
  emptyText: {
    fontSize: wp("4%"),
    color: COLORS.text.secondary,
    marginTop: hp("2%"),
    textAlign: "center",
  },
  animation: {
    width: wp(50),
    height: wp(50),
  },
  addButton: {
    position: "absolute",
    right: wp("6%"),
    bottom: hp("15.5%"),
    width: wp("14%"),
    height: wp("14%"),
    borderRadius: wp("7%"),
    backgroundColor: "#2563EB",
    elevation: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    zIndex: 10,
  },
  cameraButton: {
    position: "absolute",
    right: wp("6%"),
    bottom: hp("8%"),
    width: wp("14%"),
    height: wp("14%"),
    borderRadius: wp("7%"),
    backgroundColor: "#2563EB",
    elevation: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    zIndex: 10,
  },
  buttonInner: {
    width: "100%",
    height: "100%",
    borderRadius: wp("7%"),
    justifyContent: "center",
    alignItems: "center",
  },
  fabGuideOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  fabGuideBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  fabGuideCard: {
    position: "absolute",
    right: wp("22%"),
    bottom: hp("7.5%"),
    width: wp("70%"),
    backgroundColor: "#161B26",
    borderRadius: wp("3.5%"),
    padding: wp("3.5%"),
    borderWidth: 1.5,
    borderColor: "#2563EB",
    elevation: 12,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  fabGuideHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp("1%"),
    gap: wp("1.5%"),
  },
  fabGuideTitle: {
    color: "#FFFFFF",
    fontSize: wp("3.8%"),
    fontWeight: "700",
  },
  fabGuideItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp("1%"),
    gap: wp("2.5%"),
  },
  fabGuideIconWrap: {
    width: wp("8%"),
    height: wp("8%"),
    borderRadius: wp("4%"),
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  fabGuideTextWrap: {
    flex: 1,
  },
  fabGuideItemTitle: {
    color: "#FFFFFF",
    fontSize: wp("3.3%"),
    fontWeight: "600",
  },
  fabGuideItemDesc: {
    color: "#94A3B8",
    fontSize: wp("2.8%"),
    lineHeight: wp("3.8%"),
  },
  fabGuideDismissBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: hp("0.8%"),
    borderRadius: wp("2%"),
    alignItems: "center",
    marginTop: hp("0.5%"),
  },
  fabGuideDismissText: {
    color: "#FFFFFF",
    fontSize: wp("3.2%"),
    fontWeight: "600",
  },
  fabGuidePointerArrow: {
    position: "absolute",
    right: -wp("2.5%"),
    bottom: hp("2.5%"),
    width: 0,
    height: 0,
    borderTopWidth: wp("2%"),
    borderBottomWidth: wp("2%"),
    borderLeftWidth: wp("2.5%"),
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#2563EB",
  },
});

export default MoneyTracker;