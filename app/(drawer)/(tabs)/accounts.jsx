import React, { useEffect, useState } from 'react';
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
  Alert
} from 'react-native';
import { Link } from 'expo-router'; 
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/theme';
import { 
  widthPercentageToDP as wp, 
  heightPercentageToDP as hp 
} from 'react-native-responsive-screen';
import Header from '../../../components/commonheader';
import { useGlobalContext } from '../../../components/globalProvider';
import { useTranslation } from 'react-i18next';

const DEFAULT_ACCOUNTS = ['Credit Card', 'Cash', 'Savings', 'Bank Account', 'Investment'];

const AccountsScreen = () => {
  const { fetchExpenses, state, convertAmount, addAccount, deleteAccount } = useGlobalContext();
  const { defaultCurrency, currencies } = state;
  const currencySymbol = currencies[defaultCurrency]?.symbol || defaultCurrency;
  const [accountBalances, setAccountBalances] = useState({});
  const [summary, setSummary] = useState({ totalExpense: 0, totalIncome: 0 });
  const [addAccountModalVisible, setAddAccountModalVisible] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const { t } = useTranslation();

  const accountList = state.accounts && state.accounts.length > 0 ? state.accounts : DEFAULT_ACCOUNTS;

  useEffect(() => {
    loadAccountData();
  }, [state.transactions, state.accounts, defaultCurrency]);

  const loadAccountData = async () => {
    try {
      const transactions = await fetchExpenses();
      const balances = {};
      accountList.forEach(acc => {
        balances[acc] = 0;
      });

      let totalExpense = 0;
      let totalIncome = 0;

      (transactions || []).forEach(transaction => {
        const amount = convertAmount(parseFloat(transaction.amount) || 0, transaction.currency || 'USD', defaultCurrency);
        let accountType = transaction.account;
        if (accountType === 'Card') accountType = 'Credit Card';
        if (accountType === 'Bank') accountType = 'Bank Account';

        // If transaction has an account that's known or custom
        if (!balances.hasOwnProperty(accountType)) {
          balances[accountType] = 0;
        }

        if (transaction.type === 'EXPENSE') {
          balances[accountType] -= amount;
          totalExpense += amount;
        } else if (transaction.type === 'INCOME') {
          balances[accountType] += amount;
          totalIncome += amount;
        }
      });

      setAccountBalances(balances);
      setSummary({ totalExpense, totalIncome });
    } catch (error) {
      console.error('Error loading account data:', error);
    }
  };

  const getAccountIcon = (type) => {
    const iconMap = {
      'Credit Card': 'card-outline',
      'Cash': 'cash-outline',
      'Savings': 'wallet-outline',
      'Bank Account': 'home-outline',
      'Investment': 'trending-up',
    };
    return iconMap[type] || 'wallet-outline';
  };

  const handleAddAccountSubmit = () => {
    const trimmed = newAccountName.trim();
    if (!trimmed) {
      Alert.alert(t('Error') || 'Error', t('Enter account name') || 'Please enter an account name');
      return;
    }

    if (accountList.includes(trimmed)) {
      Alert.alert(t('Error') || 'Error', 'Account with this name already exists');
      return;
    }

    addAccount(trimmed);
    setNewAccountName('');
    setAddAccountModalVisible(false);
    Alert.alert(t('Success') || 'Success', t('Account added successfully') || 'Account added successfully');
  };

  const handleDeleteAccountPrompt = (accountType) => {
    if (accountType === 'Cash') {
      Alert.alert(t('Cannot delete default accounts') || 'Cannot delete primary cash account');
      return;
    }

    Alert.alert(
      t('Confirm Delete') || 'Confirm Delete',
      `${t('Are you sure you want to delete this account?') || 'Are you sure you want to delete'} "${t(accountType) || accountType}"?`,
      [
        { text: t('Cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('Delete') || 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAccount(accountType);
          },
        },
      ]
    );
  };

  const accounts = accountList.map((type, index) => ({
    id: index + 1,
    type: type,
    balance: accountBalances[type] || 0,
    icon: getAccountIcon(type),
    isDefault: DEFAULT_ACCOUNTS.includes(type),
  }));

  const totalBalance = Object.values(accountBalances).reduce((sum, balance) => sum + (balance || 0), 0);

  const renderAccountCard = (account) => (
    <View key={account.type} style={styles.accountCardContainer}>
      <Link
        href={{
          pathname: "/accountDetails",
          params: { accountType: account.type }
        }}
        asChild
      >
        <TouchableOpacity style={styles.accountCardTouchable}>
          <View style={styles.accountInfo}>
            <View style={styles.accountIconContainer}>
              <Ionicons name={account.icon} size={wp('6%')} color={COLORS.text.primary} />
            </View>
            <View style={styles.accountDetails}>
              <Text style={styles.accountType}>{t(account.type) || account.type}</Text>
              <Text style={[
                styles.accountBalance,
                { color: account.balance >= 0 ? '#51cf66' : '#ff6b6b' }
              ]}>
                {currencySymbol}{Math.abs(account.balance).toFixed(2)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward-outline" size={wp('5.5%')} color={COLORS.text.secondary} />
        </TouchableOpacity>
      </Link>

      {/* Delete button for custom accounts or non-Cash accounts */}
      {account.type !== 'Cash' && (
        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={() => handleDeleteAccountPrompt(account.type)}
        >
          <Ionicons name="trash-outline" size={wp('4.5%')} color="#ff6b6b" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header searchIconShown={false} />
      <ScrollView style={styles.content}>
        {/* Total Balance Card */}
        <View style={styles.totalBalance}>
          <Text style={styles.totalBalanceLabel}>{t('All Accounts') || 'All Accounts'}</Text>
          <Text style={[
            styles.totalBalanceAmount,
            { color: totalBalance >= 0 ? '#51cf66' : '#ff6b6b' }
          ]}>
            {currencySymbol}{Math.abs(totalBalance).toFixed(2)}
          </Text>
        </View>

        {/* Expense / Income Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('Expense Amount') || 'Expense Amount'}</Text>
            <Text style={[styles.summaryAmount, { color: '#ff6b6b' }]}>
              {currencySymbol}{summary.totalExpense.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('Income Amount') || 'Income Amount'}</Text>
            <Text style={[styles.summaryAmount, { color: '#51cf66' }]}>
              {currencySymbol}{summary.totalIncome.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Accounts Section Header with Add Button */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('Accounts') || 'Accounts'}</Text>
          <TouchableOpacity
            style={styles.addAccountBtn}
            onPress={() => setAddAccountModalVisible(true)}
          >
            <Ionicons name="add" size={wp('4.5%')} color="#FFFFFF" />
            <Text style={styles.addAccountBtnText}>{t('Add Account') || 'Add Account'}</Text>
          </TouchableOpacity>
        </View>

        {/* Accounts List */}
        <View style={styles.accountsList}>
          {accounts.map(renderAccountCard)}
        </View>

        {/* Add Account Modal */}
        <Modal
          visible={addAccountModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setAddAccountModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('Add Account') || 'Add New Account'}</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setAddAccountModalVisible(false)}
                >
                  <Ionicons name="close" size={wp('6%')} color={COLORS.text.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>{t('Account Name') || 'Account Name'}</Text>
                <View style={styles.modalInputWrapper}>
                  <TextInput
                    style={styles.modalInput}
                    value={newAccountName}
                    onChangeText={setNewAccountName}
                    placeholder={t('Enter account name') || 'e.g. PayPal, HDFC Bank, Wallet'}
                    placeholderTextColor={COLORS.text.secondary}
                    selectionColor={COLORS.primary}
                    autoFocus={true}
                  />
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setAddAccountModalVisible(false)}
                >
                  <Text style={styles.modalCancelButtonText}>{t('Cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={handleAddAccountSubmit}
                >
                  <Text style={styles.modalSaveButtonText}>{t('Add') || 'Add Account'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },
  totalBalance: { alignItems: 'center', padding: wp('4%'), backgroundColor: COLORS.background },
  totalBalanceLabel: { fontSize: wp('3.8%'), color: COLORS.text.secondary, marginBottom: hp('0.5%') },
  totalBalanceAmount: { fontSize: wp('7%'), fontWeight: '700' },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: wp('4%'),
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightbackground,
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: wp('3.2%'), color: COLORS.text.secondary, marginBottom: hp('0.5%') },
  summaryAmount: { fontSize: wp('4.2%'), fontWeight: '600' },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingTop: hp('2.5%'),
    paddingBottom: hp('1%'),
  },
  sectionTitle: {
    fontSize: wp('5%'),
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.6%'),
    backgroundColor: COLORS.primary,
    borderRadius: wp('4%'),
  },
  addAccountBtnText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: wp('1%'),
  },
  accountsList: { padding: wp('4%') },
  accountCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp('3%'),
    marginBottom: wp('3%'),
    paddingRight: wp('2%'),
  },
  accountCardTouchable: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp('3.5%'),
  },
  accountInfo: { flexDirection: 'row', alignItems: 'center' },
  accountIconContainer: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  accountDetails: { justifyContent: 'center' },
  accountType: { fontSize: wp('4.2%'), color: COLORS.text.primary, fontWeight: '500', marginBottom: hp('0.4%') },
  accountBalance: { fontSize: wp('3.8%'), fontWeight: '600' },
  deleteAccountBtn: {
    padding: wp('2.5%'),
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderRadius: wp('2%'),
    marginLeft: wp('1%'),
    marginRight: wp('2%'),
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: wp('5%'),
    borderTopRightRadius: wp('5%'),
    padding: wp('5%'),
    paddingBottom: Platform.OS === 'ios' ? hp('8%') : hp('4%'),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2.5%'),
  },
  modalTitle: {
    fontSize: wp('4.8%'),
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    padding: wp('2%'),
  },
  modalInputContainer: {
    marginBottom: hp('2.5%'),
  },
  modalInputLabel: {
    fontSize: wp('3.5%'),
    color: COLORS.text.secondary,
    marginBottom: hp('0.8%'),
  },
  modalInputWrapper: {
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp('3%'),
    paddingHorizontal: wp('4%'),
    height: hp('6.5%'),
    justifyContent: 'center',
  },
  modalInput: {
    fontSize: wp('4.2%'),
    color: COLORS.text.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: wp('4%'),
    marginTop: hp('1%'),
  },
  modalButton: {
    flex: 1,
    borderRadius: wp('3%'),
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: COLORS.lightbackground,
    paddingVertical: hp('1.6%'),
  },
  modalSaveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: hp('1.6%'),
  },
  modalCancelButtonText: {
    color: COLORS.text.primary,
    fontSize: wp('4%'),
    fontWeight: '500',
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
});

export default AccountsScreen;