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
} from "react-native";
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

  useEffect(() => {
    loadExpensesFromDB();
  }, []);

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
      date: new Date().toISOString(),
      category: prefill.category || "Other",
      account: prefill.account || "Cash",
      note: prefill.notes || prefill.merchant || "",
      currency: state.defaultCurrency || "INR",
    });
    setShowCalculator(true);
  };

  const handleOCR = async (base64Image) => {
    try {
      const parser = new ReceiptParser();
      const details = await parser.parseReceipt(base64Image);

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
                  category: details?.category || "Other",
                  account: details?.account || "Cash",
                  notes: details?.notes || details?.merchant || "",
                });
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        "Receipt Scanned",
        `Amount: ${formatCurrency(
          details.amount,
          state.defaultCurrency
        )}\nCategory: ${details.category}\nAccount: ${details.account}${
          details.notes ? `\nNote: ${details.notes}` : ''
        }\n\nReview details before saving so nothing is wrong:`,
        [
          {
            text: "Edit Details",
            onPress: () => {
              openCalculatorWithDetails(details);
            },
          },
          {
            text: "Save As-Is",
            onPress: async () => {
              const formattedTransaction = {
                amount: parseFloat(details.amount),
                type: "EXPENSE",
                date: new Date().toISOString(),
                category: details.category || "Other",
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
            text: "Cancel",
            style: "cancel",
          },
        ]
      );
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
          {format(parseISO(state.currentMonth), "MMMM, yyyy")}
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

      {/* Floating Action Buttons */}
      {/* Plus button for manual expense entry */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowCalculator(true)}
      >
        <Ionicons name="add" size={wp("7%")} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Camera button for OCR receipt scanning */}
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={showImageSourceOptions}
      >
        <LottieView
          source={require("../assets/animation/camera_add.json")}
          autoPlay
          loop={false}
          style={styles.animationAdd}
        />
      </TouchableOpacity>

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
    right: wp("7%"),
    bottom: hp("16%"),
    width: wp("13%"),
    height: wp("13%"),
    borderRadius: wp("6.5%"),
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 4.65,
    zIndex: 10,
  },
  cameraButton: {
    position: "absolute",
    right: wp("7%"),
    bottom: hp("8%"),
    width: wp("14%"),
    height: wp("14%"),
    borderRadius: wp("7%"),
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 4.65,
    zIndex: 10,
  },
  animationAdd: {
    width: wp("14%"),
    height: wp("14%"),
  },
});

export default MoneyTracker;