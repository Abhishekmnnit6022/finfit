import { useEffect, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_STORAGE_KEY = 'BUDGET_NOTIFICATION_DATA';
const NOTIFICATION_INTERVAL = 3 * 60 * 60 * 1000; // At least 3 hours in milliseconds
const MAX_NOTIFICATIONS_PER_DAY = 1; // Strictly only 1 notification per category per day

// Set the notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
          // Clean up old data (older than 24 hours)
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
        const channelResult = await Notifications.setNotificationChannelAsync('budget-alerts', {
          name: 'Budget Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
        });
        console.log('Notification channel created:', channelResult);
      }
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('Existing notification status:', existingStatus);
      
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get notification permissions');
        return false;
      }
      
      console.log('Notification permissions granted');
      return true;
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
    if (!isInitialized) return;

    try {
      const spent = spentByCategory[budget.category] || 0;
      const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

      // Don't send notifications if budget limit is 0 or not set
      if (budget.limit <= 0) {
        return;
      }

      console.log(`Checking notification for budget: ${budget.title}, spent: ${spent}, limit: ${budget.limit}, percentage: ${percentage.toFixed(1)}%`);

      const now = Date.now();
      let categoryData = notificationData[budget.category] || {
        lastSentTime: 0,
        count: 0,
        lastResetTime: now,
        lastPercentage: 0,
      };

      // Reset daily count if 24 hours have passed
      categoryData = resetDailyCount(categoryData);

      const timeSinceLastNotification = now - categoryData.lastSentTime;
      const hasWaitedEnough = timeSinceLastNotification > NOTIFICATION_INTERVAL;
      const hasNotExceededDailyLimit = categoryData.count < MAX_NOTIFICATIONS_PER_DAY;
      const percentageIncreased = percentage > (categoryData.lastPercentage + 10); // At least 10% increase

      // Send notification if:
      // 1. Budget is at or above 75% AND
      // 2. At least 3 hours have passed since last notification AND
      // 3. Haven't exceeded daily notification limit AND
      // 4. (First notification OR percentage increased significantly)
      if (percentage >= 75 && hasWaitedEnough && hasNotExceededDailyLimit && 
          (categoryData.count === 0 || percentageIncreased)) {
        
        const notificationContent = {
          title: percentage >= 100 ? '🚨 Budget Exceeded!' : percentage >= 90 ? '⚠️ Budget Critical!' : '⚠️ Budget Alert',
          body: `Your ${budget.title} budget is at ${percentage.toFixed(0)}% (${spent.toFixed(2)} / ${budget.limit.toFixed(2)}). Consider reviewing your spending.`,
          sound: 'default',
          priority: 'high',
          badge: 1,
        };

        // Platform-specific settings
        if (Platform.OS === 'android') {
          notificationContent.channelId = 'budget-alerts';
          notificationContent.vibrate = [0, 250, 250, 250];
        }

        if (Platform.OS === 'ios') {
          notificationContent.sound = 'default';
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
          trigger: null, // Send immediately
        });

        console.log(`✓ Notification sent for ${budget.title} at ${percentage.toFixed(0)}%`);

        // Update notification data
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

        // Log next notification time
        const nextNotificationTime = new Date(now + NOTIFICATION_INTERVAL);
        console.log(`Next notification for ${budget.title} available after: ${nextNotificationTime.toLocaleString()}`);
        console.log(`Notifications sent today for ${budget.title}: ${updatedCategoryData.count}/${MAX_NOTIFICATIONS_PER_DAY}`);
      } else {
        // Log why notification wasn't sent
        if (percentage < 75) {
          console.log(`✗ No notification: ${budget.title} is at ${percentage.toFixed(0)}% (below 75% threshold)`);
        } else if (!hasWaitedEnough) {
          const waitTimeRemaining = NOTIFICATION_INTERVAL - timeSinceLastNotification;
          const hoursRemaining = (waitTimeRemaining / (60 * 60 * 1000)).toFixed(1);
          console.log(`✗ No notification: ${budget.title} - Wait ${hoursRemaining} more hours (last sent: ${new Date(categoryData.lastSentTime).toLocaleTimeString()})`);
        } else if (!hasNotExceededDailyLimit) {
          console.log(`✗ No notification: ${budget.title} - Daily limit reached (${categoryData.count}/${MAX_NOTIFICATIONS_PER_DAY})`);
        } else if (!percentageIncreased) {
          console.log(`✗ No notification: ${budget.title} - Percentage hasn't increased significantly (${percentage.toFixed(0)}% vs ${categoryData.lastPercentage.toFixed(0)}%)`);
        }
      }
    } catch (error) {
      console.warn('Send notification notice:', error?.message);
    }
  }, [notificationData, isInitialized]);

  const checkBudgetThresholds = useCallback((budgets, spentByCategory = {}) => {
    if (!Array.isArray(budgets)) {
      console.warn('Budgets is not an array:', budgets);
      return;
    }

    if (!isInitialized) {
      console.log('Notification system not initialized yet');
      return;
    }

    console.log('--- Checking budget thresholds ---');
    budgets.forEach((budget) => {
      if (budget.limit > 0) { // Only check budgets that have been set
        sendBudgetNotification(budget, spentByCategory);
      }
    });
    console.log('--- Budget check complete ---');
  }, [sendBudgetNotification, isInitialized]);

  // Clear notification data for a specific category (useful for testing or resetting)
  const clearNotificationDataForCategory = async (category) => {
    const updatedData = { ...notificationData };
    delete updatedData[category];
    setNotificationData(updatedData);
    await saveNotificationData(updatedData);
  };

  // Clear all notification data (useful for testing)
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
    notificationData, // Expose for debugging
  };
};

// Notification listener component
export const BudgetNotificationListener = ({ onNotificationReceived }) => {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📱 Notification received:', notification.request.content.title);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response.notification.request.content.title);
      // You can add navigation logic here if user taps the notification
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [onNotificationReceived]);

  return null;
};