import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { COLORS } from '../constants/theme';
import { exportService } from '../utils/exportService';
import { useGlobalContext } from './globalProvider';

const ExportDataModal = ({ visible, onClose }) => {
  const [isExporting, setIsExporting] = React.useState(false);
  const { state } = useGlobalContext();

  const handleExport = async (format) => {
    try {
      const transactions = state?.transactions || [];
      if (!transactions || transactions.length === 0) {
        Alert.alert('No Transactions', 'You do not have any transactions to export yet. Please log some expenses first!');
        return;
      }

      setIsExporting(true);
      
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
      Alert.alert('Export Failed', error?.message || 'There was an error exporting your data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportFormats = [
    { id: 'pdf', label: 'PDF Document', icon: '📄' },
    { id: 'csv', label: 'CSV Spreadsheet', icon: '📊' },
    { id: 'json', label: 'JSON File', icon: '🗄️' }
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Export Data</Text>
          
          {isExporting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Preparing your export...</Text>
            </View>
          ) : (
            <>
              {exportFormats.map((format) => (
                <TouchableOpacity
                  key={format.id}
                  style={styles.exportOption}
                  onPress={() => handleExport(format.id)}
                >
                  <Text style={styles.exportIcon}>{format.icon}</Text>
                  <Text style={styles.exportText}>{format.label}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            disabled={isExporting}
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: wp('80%'),
  },
  modalTitle: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 5,
    marginVertical: 5,
    backgroundColor: '#f0f0f0',
  },
  exportIcon: {
    fontSize: wp('6%'),
    marginRight: 10,
  },
  exportText: {
    fontSize: wp('4%'),
  },
  closeButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: COLORS.text.secondary,
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: wp('4%'),
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: wp('4%'),
    color: COLORS.text.secondary,
  },
});

export default ExportDataModal;