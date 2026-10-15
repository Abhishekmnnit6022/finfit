import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
// Import useLocalSearchParams to get parameters from the URL
import { useLocalSearchParams } from 'expo-router'; 
import { useGlobalContext } from '../components/globalProvider'; // Adjust path to your globalProvider
import Header from '../components/commonheader'; // Adjust path to your header
import { COLORS } from '../constants/theme'; // Adjust path to your theme
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

const AccountDetailsScreen = () => {
  // Use useLocalSearchParams to get the accountType passed in the link
  const { accountType } = useLocalSearchParams();

  const { state } = useGlobalContext();
  const { transactions, defaultCurrency, currencies } = state;
  const currencySymbol = currencies[defaultCurrency]?.symbol || defaultCurrency;
  const { t } = useTranslation();

  const [filteredTransactions, setFilteredTransactions] = useState([]);

  useEffect(() => {
    if (transactions) {
      const filtered = transactions.filter(t => {
        let transactionAccount = t.account;
        if (transactionAccount === 'Card') transactionAccount = 'Credit Card';
        if (transactionAccount === 'Bank') transactionAccount = 'Bank Account';
        return transactionAccount === accountType;
      });
      setFilteredTransactions(filtered);
    }
  }, [transactions, accountType]);

  const renderTransactionItem = ({ item }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionCategory}>{t(item.category) || item.category}</Text>
        <Text style={styles.transactionNote}>{item.note || t('No note') || 'No note'}</Text>
        <Text style={styles.transactionDate}>{format(new Date(item.date), 'dd MMM, yyyy')}</Text>
      </View>
      <Text style={[
        styles.transactionAmount,
        { color: item.type === 'EXPENSE' ? '#ff6b6b' : '#51cf66' }
      ]}>
        {item.type === 'EXPENSE' ? '-' : '+'}
        {currencySymbol}{parseFloat(item.amount).toFixed(2)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t(accountType)} searchIconShown={false} />
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('No transactions found for this account.')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

// Add styles from previous answer here...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContainer: {
    padding: wp('4%'),
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp('4%'),
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp('3%'),
    marginBottom: wp('3%'),
  },
  transactionDetails: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  transactionNote: {
    fontSize: wp('3.5%'),
    color: COLORS.text.secondary,
    marginVertical: hp('0.5%'),
  },
  transactionDate: {
    fontSize: wp('3%'),
    color: COLORS.text.secondary,
  },
  transactionAmount: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp('20%'),
  },
  emptyText: {
    fontSize: wp('4%'),
    color: COLORS.text.secondary,
  },
});


export default AccountDetailsScreen;