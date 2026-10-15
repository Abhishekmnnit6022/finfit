import { useEffect, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_STORAGE_KEY = 'BUDGET_NOTIFICATION_DATA';
const NOTIFICATION_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours for scheduled background checks
const MAX_NOTIFICATIONS_PER_DAY = 3; // Allow up to 3 periodic reminders per category per day

// In-memory locks to prevent concurrent duplicate notification dispatches
const recentNotificationLocks = new Map();

// Set the notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Sends an immediate single alert notification whenever an expense is recorded
 * that exceeds or continues to exceed the allocated category budget.
 */
export const notifyBudgetExceededForCategory = async (category, spent, limit) => {
  if (!category || !limit || limit <= 0) return;
  const percentage = (spent / limit) * 100;
  if (percentage < 100) return;

  const now = Date.now();
  const lastTime = recentNotificationLocks.get(category) || 0;
  // Debounce rapid duplicate invocations within 4 seconds (e.g. double save tap)
  if (now - lastTime < 4000) {
    return;
  }
  recentNotificationLocks.set(category, now);

  try {
    const notificationContent = {
      title: '🚨 Budget Exceeded!',
      body: `Your ${category} budget is at ${percentage.toFixed(0)}% (${spent.toFixed(2)} / ${limit.toFixed(2)}). Consider reviewing your spending.`,
      sound: 'default',
      priority: 'high',
      badge: 1,
    };

    if (Platform.OS === 'android') {
      notificationContent.channelId = 'budget-alerts';
      notificationContent.vibrate = [0, 250, 250, 250];
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        ...notificationContent,
        data: { category, percentage, spent, limit, trigger: 'TRANSACTION_OVERLIMIT' },
      },
      trigger: null,
    });
    console.log(`✓ Immediate transaction budget alert sent for ${category} at ${percentage.toFixed(0)}%`);

    // Synchronize with scheduled notification storage so periodic checks don't duplicate
    try {
      const savedDataStr = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      const data = savedDataStr ? JSON.parse(savedDataStr) : {};
      data[category] = {
        lastSentTime: now,
        count: (data[category]?.count || 0) + 1,
        lastResetTime: data[category]?.lastResetTime || now,
        lastPercentage: percentage,
      };
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // storage write notice ignored
    }
  } catch (err) {
    console.warn('Failed to send immediate budget alert:', err?.message);
  }
};

// Custom hook for budget notifications
export const useBudgetNotifications = () => {
  const [notificationData, setNotificationData] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Load notification data from AsyncStorage
  useEffect(() => {
    const loadNotificationData = async () => {
      try {
        const savedData = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          const now = Date.now();
          const cleanedData = {};
          
          Object.keys(parsedData).forEach(category => {
            const categoryData = parsedData[category];
            if (categoryData.lastResetTime && (now - categoryData.lastResetTime) < 24 * 60 * 60 * 1000) {
              cleanedData[category] = categoryData;
            }
          });
          
          setNotificationData(cleanedData);
          await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(cleanedData));
        }
        setIsInitialized(true);
      } catch (error) {
        console.warn('Notification data notice:', error?.message);
        setIsInitialized(true);
      }
    };

    loadNotificationData();
  }, []);

  // Save notification data to AsyncStorage
  const saveNotificationData = async (data) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Save notification notice:', error?.message);
    }
  };

  const requestNotificationPermissions = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('budget-alerts', {
          name: 'Budget Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
        });
      }
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      return finalStatus === 'granted';
    } catch (error) {
      console.warn('Request notification permissions notice:', error?.message);
      return false;
    }
  }, []);

  useEffect(() => {
    requestNotificationPermissions();
  }, [requestNotificationPermissions]);

  const resetDailyCount = (categoryData) => {
    const now = Date.now();
    if (!categoryData.lastResetTime || (now - categoryData.lastResetTime) > 24 * 60 * 60 * 1000) {
      return {
        lastSentTime: 0,
        count: 0,
        lastResetTime: now,
        lastPercentage: 0,
      };
    }
    return categoryData;
  };

  const sendBudgetNotification = useCallback(async (budget, spentByCategory = {}) => {
    if (!isInitialized || !budget || budget.limit <= 0) return;

    try {
      const spent = spentByCategory[budget.category] || 0;
      const percentage = (spent / budget.limit) * 100;
      const now = Date.now();

      // Guard: Check in-memory lock to prevent duplicate notifications within 15 seconds
      const lastLockTime = recentNotificationLocks.get(budget.category) || 0;
      if (now - lastLockTime < 15000) {
        console.log(`Suppressed duplicate notification for ${budget.category}`);
        return;
      }

      let categoryData = notificationData[budget.category] || {
        lastSentTime: 0,
        count: 0,
        lastResetTime: now,
        lastPercentage: 0,
      };

      categoryData = resetDailyCount(categoryData);

      const timeSinceLastNotification = now - categoryData.lastSentTime;
      const hasWaitedEnough = timeSinceLastNotification > NOTIFICATION_INTERVAL;
      const hasNotExceededDailyLimit = categoryData.count < MAX_NOTIFICATIONS_PER_DAY;
      const percentageIncreased = percentage > (categoryData.lastPercentage + 5);

      // Send periodic notification if threshold reached, waited enough, or significant increase
      if (percentage >= 75 && (hasWaitedEnough || categoryData.count === 0 || (percentage >= 100 && percentageIncreased)) && hasNotExceededDailyLimit) {
        recentNotificationLocks.set(budget.category, now);

        const notificationContent = {
          title: percentage >= 100 ? '🚨 Budget Exceeded!' : percentage >= 90 ? '⚠️ Budget Critical!' : '⚠️ Budget Alert',
          body: `Your ${budget.title} budget is at ${percentage.toFixed(0)}% (${spent.toFixed(2)} / ${budget.limit.toFixed(2)}). Consider reviewing your spending.`,
          sound: 'default',
          priority: 'high',
          badge: 1,
        };

        if (Platform.OS === 'android') {
          notificationContent.channelId = 'budget-alerts';
          notificationContent.vibrate = [0, 250, 250, 250];
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            ...notificationContent,
            data: {
              category: budget.category,
              percentage: percentage,
              title: budget.title,
              spent: spent,
              limit: budget.limit,
            },
          },
          trigger: null,
        });

        const updatedCategoryData = {
          lastSentTime: now,
          count: categoryData.count + 1,
          lastResetTime: categoryData.lastResetTime,
          lastPercentage: percentage,
        };

        const updatedNotificationData = {
          ...notificationData,
          [budget.category]: updatedCategoryData,
        };

        setNotificationData(updatedNotificationData);
        await saveNotificationData(updatedNotificationData);
      }
    } catch (error) {
      console.warn('Send notification notice:', error?.message);
    }
  }, [notificationData, isInitialized]);

  const checkBudgetThresholds = useCallback((budgets, spentByCategory = {}) => {
    if (!Array.isArray(budgets) || !isInitialized) return;

    budgets.forEach((budget) => {
      if (budget.limit > 0) {
        sendBudgetNotification(budget, spentByCategory);
      }
    });
  }, [sendBudgetNotification, isInitialized]);

  const clearNotificationDataForCategory = async (category) => {
    const updatedData = { ...notificationData };
    delete updatedData[category];
    setNotificationData(updatedData);
    await saveNotificationData(updatedData);
  };

  const clearAllNotificationData = async () => {
    setNotificationData({});
    await AsyncStorage.removeItem(NOTIFICATION_STORAGE_KEY);
  };

  return {
    checkBudgetThresholds,
    sendBudgetNotification,
    requestNotificationPermissions,
    clearNotificationDataForCategory,
    clearAllNotificationData,
    notificationData,
  };
};

export const BudgetNotificationListener = ({ onNotificationReceived }) => {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [onNotificationReceived]);

  return null;
};
export default useBudgetNotifications;