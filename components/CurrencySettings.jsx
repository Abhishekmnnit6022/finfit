import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from "react-native-responsive-screen";
import { COLORS } from "../constants/theme";
import { useGlobalContext } from "./globalProvider";
import { useTranslation } from "react-i18next";

export const CURATED_CURRENCIES = {
  INR: { symbol: '₹', name: 'Indian Rupee' },
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham' },
  SAR: { symbol: '﷼', name: 'Saudi Riyal' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' },
  KWD: { symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  QAR: { symbol: 'ر.ق', name: 'Qatari Rial' },
  OMR: { symbol: 'ر.ع.', name: 'Omani Rial' },
  BHD: { symbol: 'BD', name: 'Bahraini Dinar' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CNY: { symbol: '¥', name: 'Chinese Yuan' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc' },
  RUB: { symbol: '₽', name: 'Russian Ruble' },
  BRL: { symbol: 'R$', name: 'Brazilian Real' },
  ZAR: { symbol: 'R', name: 'South African Rand' },
  PKR: { symbol: '₨', name: 'Pakistani Rupee' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka' },
  LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee' },
  NPR: { symbol: 'रू', name: 'Nepalese Rupee' },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar' },
  THB: { symbol: '฿', name: 'Thai Baht' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah' },
  KRW: { symbol: '₩', name: 'South Korean Won' },
  TRY: { symbol: '₺', name: 'Turkish Lira' },
  EGP: { symbol: 'E£', name: 'Egyptian Pound' },
  VND: { symbol: '₫', name: 'Vietnamese Dong' },
  PHP: { symbol: '₱', name: 'Philippine Peso' },
  MXN: { symbol: 'Mex$', name: 'Mexican Peso' },
  SEK: { symbol: 'kr', name: 'Swedish Krona' },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar' },
};

const CurrencySelector = ({ 
  visible, 
  onClose, 
  onSelectCurrency, 
  currentCurrency,
  loading,
  t: propT
}) => {
  const { state } = useGlobalContext();
  const { t: hookT } = useTranslation();
  const t = propT || hookT;
  const isLight = state?.theme === 'light';
  const [searchQuery, setSearchQuery] = useState('');

  const getLocalizedName = (code, defaultName) => {
    if (t) {
      const key = 'currency_' + code;
      const direct = t(key);
      if (direct && direct !== key) return direct;
      const byName = t(defaultName);
      if (byName && byName !== defaultName) return byName;
    }
    return defaultName;
  };

  const filteredCurrencies = useMemo(() => {
    return Object.entries(CURATED_CURRENCIES).filter(([code, currency]) => {
      const searchLower = searchQuery.toLowerCase().trim();
      if (!searchLower) return true;
      const localized = getLocalizedName(code, currency.name).toLowerCase();
      return (
        code.toLowerCase().includes(searchLower) ||
        currency.name.toLowerCase().includes(searchLower) ||
        currency.symbol.toLowerCase().includes(searchLower) ||
        localized.includes(searchLower)
      );
    });
  }, [searchQuery, t]);

  const renderCurrencyItem = ({ item: [code, currency] }) => {
    const isSelected = currentCurrency === code;
    const localizedName = getLocalizedName(code, currency.name);

    return (
      <TouchableOpacity
        style={[
          styles.currencyCard,
          isLight && styles.currencyCardLight,
          isSelected && (isLight ? styles.selectedCardLight : styles.selectedCardDark)
        ]}
        activeOpacity={0.7}
        onPress={() => {
          onSelectCurrency(code);
          onClose();
        }}
      >
        <View style={styles.cardLeft}>
          <View style={[
            styles.symbolBadge,
            isLight && styles.symbolBadgeLight,
            isSelected && styles.symbolBadgeSelected
          ]}>
            <Text style={[
              styles.symbolBadgeText,
              isLight && styles.symbolBadgeTextLight,
              isSelected && { color: '#FFFFFF' }
            ]}>
              {currency.symbol}
            </Text>
          </View>
          <View style={styles.textContainer}>
            <View style={styles.codeRow}>
              <Text style={[
                styles.codeText,
                isLight && { color: '#0F172A' },
                isSelected && { color: isLight ? '#4F46E5' : '#818CF8' }
              ]}>
                {code}
              </Text>
              {isSelected && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>{t('Current') || 'Current'}</Text>
                </View>
              )}
            </View>
            <Text 
              style={[styles.nameText, isLight && { color: '#64748B' }]}
              numberOfLines={1}
            >
              {localizedName}
            </Text>
          </View>
        </View>

        {isSelected ? (
          <Ionicons name="checkmark-circle" size={wp('6%')} color="#4F46E5" />
        ) : (
          <Ionicons name="chevron-forward" size={wp('4.5%')} color={isLight ? '#CBD5E1' : '#475569'} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isLight && styles.backdropLight]}>
        <View style={[styles.modalCard, isLight && styles.modalCardLight]}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBox, isLight && styles.iconBoxLight]}>
                <Ionicons name="wallet-outline" size={wp('5.5%')} color="#4F46E5" />
              </View>
              <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>
                {t('Select Default Currency') || 'Select Default Currency'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeIconBtn, isLight && styles.closeIconBtnLight]}
            >
              <Ionicons name="close" size={wp('5%')} color={isLight ? '#64748B' : '#94A3B8'} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={[styles.searchBox, isLight && styles.searchBoxLight]}>
            <Ionicons name="search" size={wp('4.8%')} color={isLight ? '#64748B' : '#94A3B8'} />
            <TextInput
              style={[styles.searchInput, isLight && { color: '#0F172A' }]}
              placeholder={t('Search currencies...') || 'Search currencies...'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={isLight ? '#94A3B8' : '#64748B'}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={wp('4.5%')} color={isLight ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Currencies List */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          ) : (
            <FlatList
              data={filteredCurrencies}
              renderItem={renderCurrencyItem}
              keyExtractor={([code]) => code}
              style={styles.currencyList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Footer Note */}
          <Text style={[styles.footerNote, isLight && { color: '#64748B' }]}>
            {t('Note: Exchange rates are updated daily') || 'Note: Exchange rates are updated daily'}
          </Text>

          {/* Done Button */}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.doneBtnText}>{t('Done') || 'Done'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default CurrencySelector;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: wp('4.5%'),
  },
  backdropLight: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  modalCard: {
    width: '100%',
    maxHeight: hp('78%'),
    backgroundColor: '#1C1B26',
    borderRadius: wp('4.5%'),
    padding: wp('5%'),
    borderWidth: 1,
    borderColor: '#2E2D3B',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  modalCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1.8%'),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: wp('9%'),
    height: wp('9%'),
    borderRadius: wp('2.5%'),
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  iconBoxLight: {
    backgroundColor: '#EEF2FF',
  },
  modalTitle: {
    fontSize: wp('4.8%'),
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  closeIconBtn: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconBtnLight: {
    backgroundColor: '#F1F5F9',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('1%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchBoxLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: wp('3.8%'),
    color: '#FFFFFF',
    marginHorizontal: wp('2%'),
    padding: 0,
  },
  currencyList: {
    maxHeight: hp('44%'),
  },
  currencyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp('3.2%'),
    borderRadius: wp('3%'),
    marginVertical: hp('0.4%'),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  currencyCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  selectedCardDark: {
    backgroundColor: 'rgba(79, 70, 229, 0.16)',
    borderColor: '#6366F1',
  },
  selectedCardLight: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  symbolBadge: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('2.8%'),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  symbolBadgeLight: {
    backgroundColor: '#F1F5F9',
  },
  symbolBadgeSelected: {
    backgroundColor: '#4F46E5',
  },
  symbolBadgeText: {
    fontSize: wp('4.4%'),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  symbolBadgeTextLight: {
    color: '#0F172A',
  },
  textContainer: {
    flex: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  codeText: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  currentBadge: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.2%'),
    borderRadius: wp('1.5%'),
  },
  currentBadgeText: {
    fontSize: wp('2.6%'),
    fontWeight: '600',
    color: '#818CF8',
  },
  nameText: {
    fontSize: wp('3.2%'),
    color: '#94A3B8',
    marginTop: hp('0.2%'),
  },
  loadingBox: {
    paddingVertical: hp('6%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNote: {
    marginTop: hp('1.2%'),
    marginBottom: hp('1.2%'),
    fontSize: wp('3%'),
    color: '#94A3B8',
    textAlign: 'center',
  },
  doneBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
});