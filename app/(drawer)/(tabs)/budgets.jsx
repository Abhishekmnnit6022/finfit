import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  DeviceEventEmitter,
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../../../constants/theme";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import Header from "../../../components/commonheader";
import { useGlobalContext } from "../../../components/globalProvider";
import { useTranslation } from "react-i18next";
import {
  useBudgetNotifications,
  BudgetNotificationListener,
} from "../../../components/Budgetnotification";
import BudgetGuideOverlay from "../../../components/BudgetGuideOverlay";

const BUDGETS_STORAGE_KEY = "APP_BUDGETS";

const BudgetsScreen = () => {
  const { state, fetchSpentByCategory, convertAmount, addCategory, deleteCategory, updateBudget, showAlert } = useGlobalContext();
  const { t, i18n } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [addCategoryModalVisible, setAddCategoryModalVisible] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [newLimit, setNewLimit] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState("EXPENSE");
  const [newCategoryInitialLimit, setNewCategoryInitialLimit] = useState("");
  const [budgets, setBudgets] = useState([]);
  const [spentByCategory, setSpentByCategory] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showBudgetTour, setShowBudgetTour] = useState(false);

  const {
    checkBudgetThresholds,
    sendBudgetNotification,
    requestNotificationPermissions,
  } = useBudgetNotifications();

  // Get the default currency and symbol
  const defaultCurrency = state.defaultCurrency || 'USD';
  const currencySymbol = state.currencies[defaultCurrency]?.symbol || defaultCurrency;

  useEffect(() => {
    const checkGuide = async () => {
      try {
        const done = await AsyncStorage.getItem("FINFIT_BUDGET_TOUR_COMPLETED");
        if (!done) {
          setShowBudgetTour(true);
        }
      } catch (e) {}
    };
    checkGuide();
  }, []);

  const dismissBudgetTour = async () => {
    try {
      await AsyncStorage.setItem("FINFIT_BUDGET_TOUR_COMPLETED", "true");
      setShowBudgetTour(false);
    } catch {
      setShowBudgetTour(false);
    }
  };

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

  // Load saved budgets from AsyncStorage
  const loadSavedBudgets = async () => {
    try {
      const savedBudgets = await AsyncStorage.getItem(BUDGETS_STORAGE_KEY);
      return savedBudgets ? JSON.parse(savedBudgets) : null;
    } catch (error) {
      console.error("Error loading saved budgets:", error);
      return null;
    }
  };

  // Save budgets to AsyncStorage
  const saveBudgetsToStorage = async (budgetsToSave) => {
    try {
      await AsyncStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(budgetsToSave));
    } catch (error) {
      console.error("Error saving budgets:", error);
    }
  };

  // Initialize budgets for all categories
  const initializeBudgets = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedBudgets = await loadSavedBudgets();
      
      const expenseCategories = state.categories?.EXPENSE || [];
      const transferCategories = state.categories?.TRANSFER || [];
      const allCategories = [...expenseCategories, ...transferCategories];

      const initializedBudgets = allCategories.map((category) => {
        const savedBudget = savedBudgets?.find(b => b.category === category);
        
        if (savedBudget) {
          return {
            ...savedBudget,
            icon: getCategoryIcon(category),
            type: expenseCategories.includes(category) ? "EXPENSE" : "TRANSFER",
          };
        }
        
        return {
          id: Date.now().toString() + category,
          category: category,
          title: category,
          limit: 0,
          icon: getCategoryIcon(category),
          type: expenseCategories.includes(category) ? "EXPENSE" : "TRANSFER",
        };
      });

      setBudgets(initializedBudgets);
      
      if (!savedBudgets || savedBudgets.length === 0) {
        await saveBudgetsToStorage(initializedBudgets);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error initializing budgets:", error);
      setIsLoading(false);
    }
  }, [state.categories]);

  useEffect(() => {
    if (state.categories) {
      initializeBudgets();
    }
  }, [state.categories, initializeBudgets]);

  // Sync immediately when peer-to-peer data sync finishes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("FINFIT_DATA_SYNCED", () => {
      initializeBudgets();
    });
    return () => sub?.remove();
  }, [initializeBudgets]);

  // Keep fresh whenever switching back to budgets tab
  useFocusEffect(
    useCallback(() => {
      initializeBudgets();
    }, [initializeBudgets])
  );

  useEffect(() => {
    if (state.language && i18n.language !== state.language) {
      i18n.changeLanguage(state.language);
    }
  }, [state.language]);

  const checkTimeoutRef = React.useRef(null);
  useEffect(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    checkTimeoutRef.current = setTimeout(async () => {
      const permissionsGranted = await requestNotificationPermissions();
      if (permissionsGranted && !isLoading && budgets?.length > 0 && Object.keys(spentByCategory || {}).length > 0) {
        checkBudgetThresholds(budgets, spentByCategory);
      }
    }, 600);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [budgets, spentByCategory, isLoading, checkBudgetThresholds, requestNotificationPermissions]);

  useEffect(() => {
    const fetchSpentData = async () => {
      try {
        const spentData = await fetchSpentByCategory();
        const spentMap = (spentData || []).reduce((acc, { category, totalSpent }) => {
          acc[category] = (acc[category] || 0) + (parseFloat(totalSpent) || 0);
          return acc;
        }, {});
        setSpentByCategory(spentMap);
      } catch (error) {
        console.error("Error fetching spent by category:", error);
      }
    };

    fetchSpentData();
  }, [fetchSpentByCategory, state.defaultCurrency, state.transactions]);

  // Total budget and spent calculations
  const totalBudget = budgets.reduce((total, budget) => total + (budget.limit || 0), 0);
  const totalSpent = Object.values(spentByCategory).reduce((total, spent) => total + (spent || 0), 0);
  const totalRemaining = totalBudget - totalSpent;
  const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const handleNotificationReceived = (notification) => {
    const { percentage, category, title } = notification.request?.content?.data || {};
    console.log(`Received notification: ${title} in category ${category} at ${percentage}%`);
  };

  const openEditModal = (budget) => {
    setSelectedBudget(budget);
    setNewLimit(budget.limit ? budget.limit.toString() : "");
    setModalVisible(true);
  };

  const saveBudgetChange = async () => {
    if (selectedBudget) {
      const updatedBudget = {
        ...selectedBudget,
        limit: parseFloat(newLimit) || 0,
      };

      const updatedBudgets = budgets.map((budget) =>
        budget.id === selectedBudget.id ? updatedBudget : budget
      );
      
      setBudgets(updatedBudgets);
      await saveBudgetsToStorage(updatedBudgets);
      if (updateBudget) {
        updateBudget(updatedBudgets);
      }
      sendBudgetNotification(updatedBudget, spentByCategory);

      setModalVisible(false);
      setSelectedBudget(null);
      setNewLimit("");
    }
  };

  const handleAddCategorySubmit = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      showAlert({
        title: t('Error') || 'Error',
        message: t('Enter category name') || 'Please enter a category name',
        type: 'error',
      });
      return;
    }

    // Add to global state
    addCategory(newCategoryType, trimmed);

    // Also initialize a budget for it immediately
    const initialLimitVal = parseFloat(newCategoryInitialLimit) || 0;
    const newBudgetEntry = {
      id: Date.now().toString() + trimmed,
      category: trimmed,
      title: trimmed,
      limit: initialLimitVal,
      icon: getCategoryIcon(trimmed),
      type: newCategoryType,
    };

    const updatedBudgets = [...budgets, newBudgetEntry];
    setBudgets(updatedBudgets);
    await saveBudgetsToStorage(updatedBudgets);

    setNewCategoryName("");
    setNewCategoryInitialLimit("");
    setAddCategoryModalVisible(false);
    showAlert({
      title: t('Success') || 'Success',
      message: t('Category added successfully') || 'Category added successfully',
      type: 'success',
    });
  };

  const handleDeleteCategoryPrompt = (budget) => {
    if (budget.category === 'Other') {
      showAlert({
        title: t('Cannot delete default categories') || 'Cannot delete default category',
        message: 'The default category is required and cannot be removed.',
        type: 'warning',
      });
      return;
    }

    showAlert({
      title: t('Confirm Delete') || 'Confirm Delete',
      message: `${t('Are you sure you want to delete this category?') || 'Are you sure you want to delete'} "${t(budget.category) || budget.category}"?`,
      type: 'confirm',
      buttons: [
        { text: t('Cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('Delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            deleteCategory(budget.type, budget.category);
            const remaining = budgets.filter(b => b.category !== budget.category);
            setBudgets(remaining);
            await saveBudgetsToStorage(remaining);
          },
        },
      ],
    });
  };

  const handleLimitChange = (text) => {
    const numericValue = text.replace(/[^0-9.]/g, "");
    setNewLimit(numericValue);
  };

  const getBudgetStatus = (spent, limit) => {
    if (limit === 0) return { color: "#51cf66", message: t("Not Set") || "Not Set" };
    const percentage = (spent / limit) * 100;
    if (percentage >= 90) return { color: "#ff6b6b", message: t("Critical") || "Critical" };
    if (percentage >= 75) return { color: "#ffd43b", message: t("Warning") || "Warning" };
    return { color: "#51cf66", message: t("On Track") || "On Track" };
  };

  const renderProgressBar = (spent, limit) => {
    const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    const status = getBudgetStatus(spent, limit);

    return (
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            { width: `${percentage}%`, backgroundColor: status.color },
          ]}
        />
      </View>
    );
  };

  const renderBudgetCard = (budget) => {
    const isLight = state?.theme === 'light';
    const spent = spentByCategory[budget.category] || 0;
    const status = getBudgetStatus(spent, budget.limit);
    const percentageUsed = budget.limit > 0 ? ((spent / budget.limit) * 100).toFixed(0) : 0;
    const translatedName = t(budget.category) || budget.title || budget.category;

    return (
      <View
        key={budget.id}
        style={[
          styles.budgetCard,
          isLight && {
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 2,
          },
        ]}
      >
        <View style={styles.budgetInfo}>
          <View
            style={[
              styles.budgetIconContainer,
              { borderColor: status.color },
              isLight && { backgroundColor: '#F1F5F9' },
            ]}
          >
            <FontAwesome5
              name={budget.icon}
              size={wp("5.5%")}
              color={isLight ? (status.color || '#4F46E5') : COLORS.text.primary}
            />
          </View>

          <View style={styles.budgetDetails}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.budgetType, isLight && { color: '#0F172A' }]} numberOfLines={1}>{translatedName}</Text>
              
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  activeOpacity={0.7}
                  onPress={() => openEditModal(budget)}
                >
                  <Ionicons
                    name="pencil"
                    size={wp("4%")}
                    color="#FFFFFF"
                  />
                  <Text style={styles.editButtonText}>{t("Edit") || "Edit"}</Text>
                </TouchableOpacity>

                {budget.category !== "Other" && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteCategoryPrompt(budget)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={wp("4.2%")}
                      color="#ff6b6b"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.budgetProgressInfo}>
              <Text style={[styles.budgetProgress, isLight && { color: '#64748B' }]}>
                {currencySymbol}
                {spent.toFixed(2)} / {currencySymbol}
                {budget.limit > 0 ? budget.limit.toFixed(2) : '0'}
              </Text>
              <Text style={[styles.budgetStatus, { color: status.color }]}>
                {status.message}
              </Text>
            </View>
            {renderProgressBar(spent, budget.limit)}
            <Text style={[styles.percentageText, isLight && { color: '#64748B' }]}>
              {percentageUsed}% {t("used") || "used"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header seachIconShown={false} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t("Loading budgets...") || "Loading budgets..."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isLight = state?.theme === 'light';

  return (
    <SafeAreaView style={[styles.container, isLight && { backgroundColor: '#F8F9FA' }]}>
      <BudgetNotificationListener
        onNotificationReceived={handleNotificationReceived}
      />
      <Header seachIconShown={false} />
      <ScrollView style={styles.content}>
        {/* Top Overview */}
        <View style={[
          styles.overviewContainer,
          isLight && {
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 2,
          },
        ]}>
          <View style={styles.overviewHeader}>
            <View style={styles.overviewTitleContainer}>
              <Text style={[styles.overviewLabel, isLight && { color: '#64748B' }]}>
                {t("Monthly Budget Overview") || "Monthly Budget Overview"}
              </Text>
              <TouchableOpacity
                style={styles.quickAddCategoryBtn}
                onPress={() => setAddCategoryModalVisible(true)}
              >
                <Ionicons name="add-circle" size={wp("4.5%")} color="#FFFFFF" />
                <Text style={styles.quickAddCategoryText}>{t("Add Category") || "+ Add Category"}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.totalBalanceAmount, isLight && { color: '#0F172A' }]}>
              {currencySymbol}
              {totalBudget.toFixed(2)}
            </Text>
          </View>

          <View style={styles.overviewProgress}>
            {renderProgressBar(totalSpent, totalBudget)}
            <Text style={[styles.overviewProgressText, isLight && { color: '#64748B' }]}>
              {spentPercentage.toFixed(0)}% {t("ofTotalBudgetUsed") ? t("ofTotalBudgetUsed").replace(/%/g, "").trim() : "of total budget used"}
            </Text>
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, isLight && { color: '#64748B' }]}>{t("spent") || "SPENT"}</Text>
              <Text style={[styles.summaryAmount, { color: "#ff6b6b" }]}>
                {currencySymbol}
                {totalSpent.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.divider, isLight && { backgroundColor: '#E2E8F0' }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, isLight && { color: '#64748B' }]}>{t("remaining") || "REMAINING"}</Text>
              <Text style={[styles.summaryAmount, { color: "#51cf66" }]}>
                {currencySymbol}
                {totalRemaining.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Expenses Section Header with Add Button */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, isLight && { color: '#0F172A' }]}>{t("Expenses") || "Expenses"}</Text>
          <TouchableOpacity
            style={styles.sectionAddBtn}
            onPress={() => {
              setNewCategoryType("EXPENSE");
              setAddCategoryModalVisible(true);
            }}
          >
            <Ionicons name="add" size={wp("4.5%")} color="#FFFFFF" />
            <Text style={styles.sectionAddBtnText}>{t("Add") || "Add"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.budgetsList}>
          {state.categories?.EXPENSE?.length > 0 ? (
            state.categories.EXPENSE.map((category) => {
              const budget = budgets.find((b) => b.category === category);
              return budget ? renderBudgetCard(budget) : null;
            })
          ) : (
            <Text style={styles.emptyText}>{t("No expense categories available") || "No expense categories"}</Text>
          )}
        </View>

        {/* Transfers Section Header with Add Button */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, isLight && { color: '#0F172A' }]}>{t("Transfers") || "Transfers"}</Text>
          <TouchableOpacity
            style={styles.sectionAddBtn}
            onPress={() => {
              setNewCategoryType("TRANSFER");
              setAddCategoryModalVisible(true);
            }}
          >
            <Ionicons name="add" size={wp("4.5%")} color="#FFFFFF" />
            <Text style={styles.sectionAddBtnText}>{t("Add") || "Add"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.budgetsList}>
          {state.categories?.TRANSFER?.length > 0 ? (
            state.categories.TRANSFER.map((category) => {
              const budget = budgets.find((b) => b.category === category);
              return budget ? renderBudgetCard(budget) : null;
            })
          ) : (
            <Text style={styles.emptyText}>{t("No transfer categories available") || "No transfer categories"}</Text>
          )}
        </View>
        
        {/* Modal: Edit Budget Limit */}
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={[styles.modalContent, isLight && { backgroundColor: '#FFFFFF' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>{t("Edit Budget Limit") || "Edit Budget Limit"}</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons
                    name="close"
                    size={wp("6%")}
                    color={isLight ? '#0F172A' : COLORS.text.primary}
                  />
                </TouchableOpacity>
              </View>

              {selectedBudget && (
                <>
                  <View style={styles.modalBudgetInfo}>
                    <View
                      style={[
                        styles.modalIconContainer,
                        isLight && { backgroundColor: '#F1F5F9' },
                        {
                          borderColor: getBudgetStatus(
                            spentByCategory[selectedBudget.category] || 0,
                            selectedBudget.limit
                          ).color,
                        },
                      ]}
                    >
                      <FontAwesome5
                        name={selectedBudget.icon}
                        size={wp("6%")}
                        color={isLight ? '#0F172A' : COLORS.text.primary}
                      />
                    </View>
                    <Text style={[styles.modalBudgetTitle, isLight && { color: '#0F172A' }]}>
                      {t(selectedBudget.category) || selectedBudget.title}
                    </Text>
                  </View>

                  <View style={styles.modalInputContainer}>
                    <Text style={[styles.modalInputLabel, isLight && { color: '#64748B' }]}>{t("Budget Limit") || "Budget Limit"}</Text>
                    <View style={[styles.modalInputWrapper, isLight && { backgroundColor: '#F1F5F9' }]}>
                      <Text style={[styles.currencySymbol, isLight && { color: '#0F172A' }]}>{currencySymbol}</Text>
                      <TextInput
                        style={[styles.modalInput, isLight && { color: '#0F172A' }]}
                        keyboardType="numeric"
                        value={newLimit}
                        onChangeText={handleLimitChange}
                        placeholder="0.00"
                        placeholderTextColor={isLight ? '#94A3B8' : COLORS.text.secondary}
                        selectionColor={COLORS.primary}
                        autoFocus={true}
                      />
                    </View>
                  </View>

                  <View style={styles.modalCurrentInfo}>
                    <Text style={[styles.modalInfoText, isLight && { color: '#64748B' }]}>{t("Current Spent") || "Current Spent"}</Text>
                    <Text style={[styles.modalInfoValue, isLight && { color: '#0F172A' }]}>
                      {currencySymbol}
                      {(spentByCategory[selectedBudget.category] || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCancelButton, isLight && { backgroundColor: '#E2E8F0' }]}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={[styles.modalCancelButtonText, isLight && { color: '#0F172A' }]}>{t("Cancel") || "Cancel"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalSaveButton]}
                      onPress={saveBudgetChange}
                    >
                      <Text style={styles.modalSaveButtonText}>
                        {t("Save Changes") || "Save Changes"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal: Add New Category */}
        <Modal
          visible={addCategoryModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setAddCategoryModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={[styles.modalContent, isLight && { backgroundColor: '#FFFFFF' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>{t("Add New Category") || "Add New Category"}</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setAddCategoryModalVisible(false)}
                >
                  <Ionicons
                    name="close"
                    size={wp("6%")}
                    color={isLight ? '#0F172A' : COLORS.text.primary}
                  />
                </TouchableOpacity>
              </View>

              {/* Category Type Selector */}
              <View style={styles.typeSelectorRow}>
                {["EXPENSE", "TRANSFER"].map((catType) => (
                  <TouchableOpacity
                    key={catType}
                    style={[
                      styles.typeSelectorBtn,
                      isLight && { backgroundColor: '#E2E8F0' },
                      newCategoryType === catType && styles.typeSelectorBtnActive,
                    ]}
                    onPress={() => setNewCategoryType(catType)}
                  >
                    <Text
                      style={[
                        styles.typeSelectorText,
                        isLight && { color: '#0F172A' },
                        newCategoryType === catType && styles.typeSelectorTextActive,
                      ]}
                    >
                      {catType === "EXPENSE" ? (t("Expenses") || "Expense") : (t("Transfers") || "Transfer")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category Name Input */}
              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalInputLabel, isLight && { color: '#64748B' }]}>{t("Category Name") || "Category Name"}</Text>
                <View style={[styles.modalInputWrapper, isLight && { backgroundColor: '#F1F5F9' }]}>
                  <TextInput
                    style={[styles.modalInput, isLight && { color: '#0F172A' }]}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    placeholder={t("Enter category name") || "e.g. Groceries, Gym, OTT"}
                    placeholderTextColor={isLight ? '#94A3B8' : COLORS.text.secondary}
                    selectionColor={COLORS.primary}
                  />
                </View>
              </View>

              {/* Initial Budget Limit (Optional) */}
              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalInputLabel, isLight && { color: '#64748B' }]}>{t("Budget Limit") || "Budget Limit (Optional)"}</Text>
                <View style={[styles.modalInputWrapper, isLight && { backgroundColor: '#F1F5F9' }]}>
                  <Text style={[styles.currencySymbol, isLight && { color: '#0F172A' }]}>{currencySymbol}</Text>
                  <TextInput
                    style={[styles.modalInput, isLight && { color: '#0F172A' }]}
                    keyboardType="numeric"
                    value={newCategoryInitialLimit}
                    onChangeText={(txt) => setNewCategoryInitialLimit(txt.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    placeholderTextColor={isLight ? '#94A3B8' : COLORS.text.secondary}
                    selectionColor={COLORS.primary}
                  />
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton, isLight && { backgroundColor: '#E2E8F0' }]}
                  onPress={() => setAddCategoryModalVisible(false)}
                >
                  <Text style={[styles.modalCancelButtonText, isLight && { color: '#0F172A' }]}>{t("Cancel") || "Cancel"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={handleAddCategorySubmit}
                >
                  <Text style={styles.modalSaveButtonText}>
                    {t("Add Category") || "Add Category"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
      <BudgetGuideOverlay visible={showBudgetTour} onClose={dismissBudgetTour} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: wp("4%"),
    color: COLORS.text.secondary,
  },
  totalBalanceAmount: {
    fontSize: wp("7%"),
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: hp("2%"),
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: hp("2%"),
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: wp("3.5%"),
    color: COLORS.text.secondary,
    marginBottom: hp("0.5%"),
  },
  summaryAmount: {
    fontSize: wp("4.5%"),
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: hp("4%"),
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: wp("4%"),
    paddingTop: hp("2%"),
    paddingBottom: hp("1%"),
  },
  sectionTitle: {
    fontSize: wp("4.8%"),
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  sectionAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp("3%"),
    paddingVertical: hp("0.5%"),
    backgroundColor: COLORS.primary,
    borderRadius: wp("4%"),
  },
  sectionAddBtnText: {
    fontSize: wp("3.5%"),
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: wp("1%"),
  },
  budgetsList: {
    paddingHorizontal: wp("4%"),
  },
  budgetCard: {
    padding: wp("3.5%"),
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp("3%"),
    marginBottom: wp("3%"),
  },
  budgetInfo: {
    flexDirection: "row",
  },
  budgetIconContainer: {
    width: wp("12%"),
    height: wp("12%"),
    borderRadius: wp("6%"),
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp("3%"),
    borderWidth: 2,
  },
  budgetDetails: {
    flex: 1,
  },
  budgetType: {
    fontSize: wp("4.2%"),
    fontWeight: "600",
    color: COLORS.text.primary,
    flex: 1,
    marginRight: wp("2%"),
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp("2%"),
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp("2%"),
    paddingVertical: hp("0.5%"),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: wp("2%"),
  },
  editButtonText: {
    marginLeft: wp("1%"),
    color: COLORS.text.primary,
    fontSize: wp("3.2%"),
    fontWeight: "500",
  },
  deleteButton: {
    padding: wp("1.5%"),
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    borderRadius: wp("2%"),
  },
  budgetProgressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: hp("1%"),
    marginBottom: hp("0.5%"),
  },
  budgetProgress: {
    fontSize: wp("3.5%"),
    color: COLORS.text.secondary,
  },
  budgetStatus: {
    fontSize: wp("3.5%"),
    fontWeight: "500",
  },
  progressBarContainer: {
    height: hp("0.8%"),
    backgroundColor: COLORS.background,
    borderRadius: wp("1%"),
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: wp("1%"),
  },
  percentageText: {
    fontSize: wp("3.2%"),
    color: COLORS.text.secondary,
    marginTop: hp("0.5%"),
  },
  emptyText: {
    fontSize: wp("3.5%"),
    color: COLORS.text.secondary,
    textAlign: "center",
    paddingVertical: hp("2%"),
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: wp("5%"),
    borderTopRightRadius: wp("5%"),
    padding: wp("5%"),
    paddingBottom: Platform.OS === "ios" ? hp("8%") : hp("4%"),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp("2.5%"),
  },
  modalTitle: {
    fontSize: wp("4.8%"),
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    padding: wp("2%"),
  },
  modalBudgetInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp("2.5%"),
  },
  modalIconContainer: {
    width: wp("12%"),
    height: wp("12%"),
    borderRadius: wp("6%"),
    backgroundColor: COLORS.lightbackground,
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp("3%"),
    borderWidth: 2,
  },
  modalBudgetTitle: {
    fontSize: wp("4.5%"),
    fontWeight: "500",
    color: COLORS.text.primary,
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: wp("3%"),
    marginBottom: hp("2.5%"),
  },
  typeSelectorBtn: {
    flex: 1,
    paddingVertical: hp("1.2%"),
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp("3%"),
    alignItems: "center",
  },
  typeSelectorBtnActive: {
    backgroundColor: COLORS.primary,
  },
  typeSelectorText: {
    fontSize: wp("3.8%"),
    color: COLORS.text.primary,
    fontWeight: "500",
  },
  typeSelectorTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  modalInputContainer: {
    marginBottom: hp("2.5%"),
  },
  modalInputLabel: {
    fontSize: wp("3.5%"),
    color: COLORS.text.secondary,
    marginBottom: hp("0.8%"),
  },
  modalInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp("3%"),
    paddingHorizontal: wp("4%"),
    height: hp("6.5%"),
  },
  currencySymbol: {
    fontSize: wp("4.5%"),
    color: COLORS.text.primary,
    marginRight: wp("2%"),
  },
  modalInput: {
    flex: 1,
    fontSize: wp("4.2%"),
    color: COLORS.text.primary,
    padding: 0,
  },
  modalCurrentInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.lightbackground,
    padding: wp("3.5%"),
    borderRadius: wp("3%"),
    marginBottom: hp("2.5%"),
  },
  modalInfoText: {
    fontSize: wp("3.5%"),
    color: COLORS.text.secondary,
  },
  modalInfoValue: {
    fontSize: wp("4%"),
    fontWeight: "500",
    color: COLORS.text.primary,
  },
  modalButtons: {
    flexDirection: "row",
    gap: wp("4%"),
    justifyContent: "center",
    marginTop: hp("1.5%"),
  },
  modalButton: {
    flex: 1,
    borderRadius: wp("3%"),
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: COLORS.lightbackground,
    paddingVertical: hp("1.6%"),
  },
  modalSaveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: hp("1.6%"),
  },
  modalCancelButtonText: {
    color: COLORS.text.primary,
    fontSize: wp("4%"),
    fontWeight: "500",
  },
  modalSaveButtonText: {
    color: "#FFFFFF",
    fontSize: wp("4%"),
    fontWeight: "600",
  },
  overviewContainer: {
    backgroundColor: COLORS.lightbackground,
    margin: wp("4%"),
    borderRadius: wp("4%"),
    padding: wp("4%"),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  overviewHeader: {
    marginBottom: hp("1.5%"),
  },
  overviewTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp("1%"),
  },
  overviewLabel: {
    fontSize: wp("3.5%"),
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  quickAddCategoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp("1%"),
  },
  quickAddCategoryText: {
    fontSize: wp("3.2%"),
    color: "#FFFFFF",
    fontWeight: "600",
  },
  overviewProgress: {
    marginBottom: hp("1.5%"),
  },
  overviewProgressText: {
    fontSize: wp("3.2%"),
    color: COLORS.text.secondary,
    marginTop: hp("0.8%"),
    textAlign: "center",
  },
});

export default BudgetsScreen;