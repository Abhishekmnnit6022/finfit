// components/FilterModal.jsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from './globalProvider';

export const FilterModal = ({ visible, onClose, onApplyFilters, categories }) => {
  const { t } = useTranslation();
  const { state } = useGlobalContext();
  const isLight = state?.theme === 'light';

  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedCategories, setSelectedCategories] = useState([]);

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleApply = () => {
    onApplyFilters({
      type: selectedType,
      categories: selectedCategories,
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedType('ALL');
    setSelectedCategories([]);
    onApplyFilters({ type: 'ALL', categories: [] });
    onClose();
  };

  // Remove duplicates from categories array
  const uniqueCategories = [...new Set(categories || [])];

  const typeLabels = {
    ALL: t('All') || t('all') || 'All',
    EXPENSE: t('Expense') || t('Expenses') || 'Expense',
    INCOME: t('Income') || 'Income',
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isLight && styles.modalContentLight]}>
          <View style={[styles.header, isLight && styles.headerLight]}>
            <Text style={[styles.title, isLight && { color: '#0F172A' }]}>
              {t('Filter Transactions') || 'Filter Transactions'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={isLight ? '#0F172A' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Transaction Type Filter */}
            <Text style={[styles.sectionTitle, isLight && { color: '#0F172A' }]}>
              {t('Transaction Type') || 'Transaction Type'}
            </Text>
            <View style={styles.typeContainer}>
              {['ALL', 'EXPENSE', 'INCOME'].map(type => {
                const isActive = selectedType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      isLight && styles.typeButtonLight,
                      isActive && styles.typeButtonActive
                    ]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      isLight && styles.typeButtonTextLight,
                      isActive && styles.typeButtonTextActive
                    ]}>
                      {typeLabels[type] || type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category Filter */}
            <Text style={[styles.sectionTitle, isLight && { color: '#0F172A' }]}>
              {t('Categories') || 'Categories'}
            </Text>
            <View style={styles.categoryContainer}>
              {uniqueCategories.map((category, index) => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <TouchableOpacity
                    key={`${category}-${index}`}
                    style={[
                      styles.categoryChip,
                      isLight && styles.categoryChipLight,
                      isSelected && styles.categoryChipActive
                    ]}
                    onPress={() => handleCategoryToggle(category)}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      isLight && styles.categoryChipTextLight,
                      isSelected && styles.categoryChipTextActive
                    ]}>
                      {t(category) || category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.footer, isLight && styles.footerLight]}>
            <TouchableOpacity 
              style={[styles.resetButton, isLight && styles.resetButtonLight]} 
              onPress={handleReset}
            >
              <Text style={[styles.resetButtonText, isLight && { color: '#0F172A' }]}>
                {t('Reset') || 'Reset'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>
                {t('Apply Filters') || 'Apply Filters'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default FilterModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#181724',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: hp('78%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalContentLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp('4.5%'),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLight: {
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: wp('4.8%'),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    padding: wp('4.5%'),
  },
  sectionTitle: {
    fontSize: wp('3.8%'),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: hp('1.2%'),
    marginTop: hp('0.5%'),
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: hp('2.5%'),
  },
  typeButton: {
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('4.5%'),
    borderRadius: wp('5%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeButtonLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeButtonText: {
    fontSize: wp('3.5%'),
    color: '#94A3B8',
    fontWeight: '500',
  },
  typeButtonTextLight: {
    color: '#64748B',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: hp('2%'),
  },
  categoryChip: {
    paddingVertical: hp('0.9%'),
    paddingHorizontal: wp('3.5%'),
    borderRadius: wp('4%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryChipLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: wp('3.2%'),
    color: '#94A3B8',
    fontWeight: '500',
  },
  categoryChipTextLight: {
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    padding: wp('4.5%'),
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerLight: {
    borderTopColor: '#E2E8F0',
  },
  resetButton: {
    flex: 1,
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  resetButtonLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  resetButtonText: {
    fontSize: wp('3.8%'),
    color: '#FFFFFF',
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: wp('3.8%'),
    color: '#FFFFFF',
    fontWeight: '700',
  },
});