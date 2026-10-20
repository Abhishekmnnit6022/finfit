// components/ExportDataModal.jsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { COLORS } from '../constants/theme';
import { exportService } from '../utils/exportService';
import { useGlobalContext } from './globalProvider';
import { useTranslation } from 'react-i18next';

const ExportDataModal = ({ visible, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState('');
  const { state, showAlert } = useGlobalContext();
  const { t } = useTranslation();
  const isLight = state?.theme === 'light';

  const handleExport = async (format) => {
    try {
      const transactions = state?.transactions || [];
      if (!transactions || transactions.length === 0) {
        showAlert({
          title: t('No Transactions') || 'No Transactions',
          message:
            t('You do not have any transactions to export yet. Please log some expenses first!') ||
            'You do not have any transactions to export yet. Please log some expenses first!',
          type: 'warning',
        });
        return;
      }

      setIsExporting(true);
      setExportType(format);

      switch (format) {
        case 'pdf':
          await exportService.exportToPDF(transactions);
          break;
        case 'csv':
          await exportService.exportToCSV(transactions);
          break;
        case 'json':
          await exportService.exportToJSON(transactions);
          break;
      }

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      showAlert({
        title: t('Export Failed') || 'Export Failed',
        message:
          error?.message ||
          t('There was an error exporting your data. Please try again.') ||
          'There was an error exporting your data. Please try again.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
      setExportType('');
    }
  };

  const exportFormats = [
    {
      id: 'pdf',
      label: t('PDF Document') || 'PDF Document',
      desc: t('Clean printable report with transaction history') || 'Clean printable report with transaction history',
      iconName: 'file-pdf-box',
      iconColor: '#FF4D4D',
      bgColor: 'rgba(255, 77, 77, 0.12)',
    },
    {
      id: 'csv',
      label: t('CSV Spreadsheet') || 'CSV Spreadsheet',
      desc: t('Compatible with Microsoft Excel & Google Sheets') || 'Compatible with Microsoft Excel & Google Sheets',
      iconName: 'file-delimited-outline',
      iconColor: '#10B981',
      bgColor: 'rgba(16, 185, 129, 0.12)',
    },
    {
      id: 'json',
      label: t('JSON File') || 'JSON File',
      desc: t('Complete structured data backup format') || 'Complete structured data backup format',
      iconName: 'code-json',
      iconColor: '#38BDF8',
      bgColor: 'rgba(56, 189, 248, 0.12)',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={isExporting ? undefined : onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            isLight
              ? { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', shadowColor: '#000000' }
              : { backgroundColor: '#1A1826', borderColor: 'rgba(255,255,255,0.08)' },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleWrap}>
              <View
                style={[
                  styles.titleIconWrap,
                  { backgroundColor: isLight ? 'rgba(48,33,224,0.1)' : 'rgba(48,33,224,0.2)' },
                ]}
              >
                <Ionicons name="cloud-upload-outline" size={wp('5.5%')} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: wp('3%') }}>
                <Text style={[styles.modalTitle, isLight && { color: '#0F172A' }]}>
                  {t('Export Data') || 'Export Data'}
                </Text>
                <Text style={[styles.modalSubtitle, isLight && { color: '#64748B' }]}>
                  {t('Choose Export Format') || 'Choose Export Format'}
                </Text>
              </View>
            </View>
            {!isExporting && (
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeIconBtn}
              >
                <Ionicons
                  name="close"
                  size={wp('5.5%')}
                  color={isLight ? '#64748B' : COLORS.text.secondary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Body */}
          {isExporting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={[styles.loadingText, isLight && { color: '#0F172A' }]}>
                {t('Preparing your export...') || 'Preparing your export...'}
              </Text>
            </View>
          ) : (
            <View style={styles.optionsList}>
              {exportFormats.map((format) => (
                <TouchableOpacity
                  key={format.id}
                  style={[
                    styles.formatCard,
                    isLight
                      ? { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }
                      : { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.07)' },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleExport(format.id)}
                >
                  <View style={[styles.formatIconWrap, { backgroundColor: format.bgColor }]}>
                    <MaterialCommunityIcons
                      name={format.iconName}
                      size={wp('7%')}
                      color={format.iconColor}
                    />
                  </View>
                  <View style={styles.formatInfo}>
                    <Text style={[styles.formatLabel, isLight && { color: '#0F172A' }]}>
                      {format.label}
                    </Text>
                    <Text style={[styles.formatDesc, isLight && { color: '#64748B' }]}>
                      {format.desc}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={wp('4.5%')}
                    color={isLight ? '#94A3B8' : '#64748B'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Cancel Button */}
          {!isExporting && (
            <TouchableOpacity
              style={[
                styles.cancelButton,
                isLight ? { backgroundColor: '#F1F5F9' } : { backgroundColor: 'rgba(255,255,255,0.06)' },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelButtonText, isLight && { color: '#0F172A' }]}>
                {t('Cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: wp('5%'),
  },
  modalCard: {
    width: '100%',
    borderRadius: wp('5%'),
    padding: wp('5%'),
    borderWidth: 1,
    elevation: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('2%'),
    paddingBottom: hp('1.5%'),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleIconWrap: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('5.5%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: wp('4.6%'),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: wp('3.2%'),
    color: '#94A3B8',
    marginTop: 2,
  },
  closeIconBtn: {
    padding: wp('1%'),
  },
  optionsList: {
    gap: hp('1.2%'),
    marginBottom: hp('2%'),
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('3.8%'),
    borderRadius: wp('3.5%'),
    borderWidth: 1,
  },
  formatIconWrap: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('3%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3.5%'),
  },
  formatInfo: {
    flex: 1,
  },
  formatLabel: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  formatDesc: {
    fontSize: wp('2.9%'),
    color: '#94A3B8',
    lineHeight: wp('4%'),
  },
  loadingContainer: {
    paddingVertical: hp('4%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: hp('1.8%'),
    fontSize: wp('3.8%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: wp('3.8%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ExportDataModal;