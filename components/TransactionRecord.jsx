// components/TransactionRecord.jsx
import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp
} from 'react-native-responsive-screen';
import { format, parseISO, isValid } from 'date-fns';
import { hi, ta, kn } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from './globalProvider';
import { currencies } from '../utils/currencyService';

const TransactionRecord = React.memo(({ transaction, onEdit }) => {
  const { deleteExpense, loadExpensesFromDB, state } = useGlobalContext();
  const { t, i18n } = useTranslation();

  const getDateLocale = () => {
    const lang = (i18n.language || state.language || '').toLowerCase();
    if (lang.includes('hi') || lang.includes('hn')) return hi;
    if (lang.includes('ta') || lang.includes('tm')) return ta;
    if (lang.includes('kn') || lang.includes('kannada')) return kn;
    return undefined;
  };

  // Format date - memoized with locale
  const formattedDate = useMemo(() => {
    try {
      if (!transaction?.date) return t('No date') || 'No date';
      
      const date = typeof transaction.date === 'string' 
        ? parseISO(transaction.date) 
        : transaction.date;

      return isValid(date) 
        ? format(date, 'MMM dd, yyyy hh:mm a', { locale: getDateLocale() }) 
        : t('Invalid date') || 'Invalid date';
    } catch (error) {
      return t('Invalid date') || 'Invalid date';
    }
  }, [transaction?.date, i18n.language, state.language]);

  // Format amount - memoized with specific dependencies
  const formattedAmount = useMemo(() => {
    if (!transaction?.amount || !transaction?.currency) {
      return `${currencies[state.defaultCurrency]?.symbol || '$'}0.00`;
    }

    const amount = Number(transaction.amount);
    if (isNaN(amount)) {
      return `${currencies[state.defaultCurrency]?.symbol || '$'}0.00`;
    }

    // Convert amount if needed
    let convertedAmount = amount;
    if (transaction.currency !== state.defaultCurrency) {
      const rate = state.exchangeRates?.[`${transaction.currency}_${state.defaultCurrency}`] || 1;
      convertedAmount = amount * rate;
    }

    return `${currencies[state.defaultCurrency]?.symbol || '$'}${convertedAmount.toFixed(2)}`;
  }, [
    transaction?.amount,
    transaction?.currency,
    state.defaultCurrency,
    state.exchangeRates?.[`${transaction?.currency}_${state.defaultCurrency}`]
  ]);

  const handleDelete = useCallback(async (e) => {
    e.stopPropagation();
    
    Alert.alert(
      t("Delete Transaction") || "Delete Transaction",
      t("Are you sure you want to delete this transaction?") || "Are you sure you want to delete this transaction?",
      [
        { text: t("Cancel") || "Cancel", style: "cancel" },
        {
          text: t("Delete") || "Delete",
          onPress: async () => {
            try {
              await deleteExpense(transaction.id);
              await loadExpensesFromDB();
            } catch (error) {
              Alert.alert(t("Error") || "Error", t("Failed to delete transaction.") || "Failed to delete transaction.");
            }
          },
          style: "destructive"
        }
      ]
    );
  }, [transaction?.id, deleteExpense, loadExpensesFromDB, t]);

  const handleEdit = useCallback(() => {
    if (onEdit) onEdit(transaction);
  }, [onEdit, transaction]);

  if (!transaction?.id) {
    return null;
  }

  // Translated category, account and note
  const displayCategory = t(transaction.category) || transaction.category || t('Uncategorized') || 'Uncategorized';
  const displayAccount = t(transaction.account) || transaction.account || t('No account') || 'No account';
  const displayNote = transaction.note?.trim() || t('No note') || 'No note';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleEdit}
      activeOpacity={0.7}
    >
      <View style={styles.mainContent}>
        <View style={styles.leftContent}>
          <Text style={styles.category}>
            {displayCategory}
          </Text>
        </View>
        <Text
          style={[
            styles.amount,
            { color: transaction.type === 'EXPENSE' ? '#ff6b6b' : '#51cf66' },
          ]}
        >
          {formattedAmount}
        </Text>
      </View>

      <Text style={styles.note}>
        {displayNote}
      </Text>

      <View style={styles.bottomRow}>
        <View style={styles.leftInfo}>
          <Text style={styles.account}>
            {displayAccount}
          </Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        
        <TouchableOpacity
          onPress={handleDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteButton}
        >
          <Ionicons 
            name="trash-outline" 
            size={wp('3.8%')} 
            color={COLORS.text.secondary}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: wp('4%'),
    backgroundColor: COLORS.pri,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightbackground,
  },
  mainContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp('0.5%'),
  },
  leftContent: {
    flex: 1,
    marginRight: wp('2%'),
  },
  category: {
    fontSize: wp('4%'),
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  amount: {
    fontSize: wp('4%'),
    fontWeight: '500',
  },
  note: {
    fontSize: wp('3.5%'),
    color: COLORS.text.secondary,
    marginBottom: hp('1%'),
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  account: {
    fontSize: wp('3.2%'),
    color: COLORS.text.secondary,
  },
  dot: {
    fontSize: wp('3.2%'),
    color: COLORS.text.secondary,
    marginHorizontal: wp('1.5%'),
  },
  date: {
    fontSize: wp('3.2%'),
    color: COLORS.text.secondary,
  },
  deleteButton: {
    opacity: 0.6,
    padding: wp('1%'),
  },
});

export default TransactionRecord;