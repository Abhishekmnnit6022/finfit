/**
 * SyncDataModal.jsx
 * Modal with two sync options:
 *  1. Scan QR Code — opens the existing QRScannerModal
 *  2. Load Backup File — picks a .finfit file from device, prompts for password, decrypts and imports
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants/theme';
import { useGlobalContext } from './globalProvider';

const SyncDataModal = ({ visible, onClose, onScanQR }) => {
  const { t } = useTranslation();
  const { state, importBackupFile, showAlert } = useGlobalContext();
  const isLight = state?.theme === 'light';
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedFileUri, setSelectedFileUri] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleReset = () => {
    setShowPasswordPrompt(false);
    setPassword('');
    setSelectedFileUri(null);
    setSelectedFileName('');
    setCachedFileContent('');
    setIsLoading(false);
    setShowPassword(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const [cachedFileContent, setCachedFileContent] = useState('');

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const fileName = file.name || 'backup_file';

      // Read file content to verify FinFit signature
      let content = '';
      try {
        content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (readErr) {
        console.error('File read error:', readErr);
        showAlert({
          title: t('Error Reading File'),
          message: t('Could not read the selected file. Please ensure it is accessible on your device.'),
          type: 'error',
        });
        return;
      }

      const trimmed = (content || '').trim();
      let isValidFinFit = false;

      if (trimmed.startsWith('FINFIT_BACKUP_V2:') || trimmed.startsWith('FINFIT_BACKUP_V1:')) {
        isValidFinFit = true;
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          if (
            parsed &&
            (parsed.finfit_backup ||
              (typeof parsed.payload === 'string' &&
                (parsed.payload.startsWith('FINFIT_BACKUP_V2:') || parsed.payload.startsWith('FINFIT_BACKUP_V1:'))))
          ) {
            isValidFinFit = true;
          }
        } catch (e) {
          // not json
        }
      }

      if (!isValidFinFit) {
        showAlert({
          title: t('Invalid Backup File'),
          message: t(
            'The selected file does not appear to be a FinFit backup. Please select the backup file you exported from FinFit (e.g. from Google Drive, WhatsApp, or Downloads).'
          ),
          type: 'error',
        });
        return;
      }

      setSelectedFileUri(file.uri);
      setSelectedFileName(fileName);
      setCachedFileContent(trimmed);
      setShowPasswordPrompt(true);
    } catch (error) {
      console.error('File picker error:', error);
      showAlert({
        title: t('Error'),
        message: t('Failed to pick file. Please try again.'),
        type: 'error',
      });
    }
  };

  const handleDecryptAndImport = async () => {
    if (!password.trim()) {
      showAlert({
        title: t('Password Required'),
        message: t('Please enter the password you used to create this backup.'),
        type: 'warning',
      });
      return;
    }

    setIsLoading(true);
    try {
      const fileContent =
        cachedFileContent ||
        (await FileSystem.readAsStringAsync(selectedFileUri, {
          encoding: FileSystem.EncodingType.UTF8,
        }));

      await importBackupFile(fileContent, password.trim());

      showAlert({
        title: t('Sync Successful'),
        message: t('All transactions, budgets, accounts, and categories have been restored from backup file!'),
        type: 'success',
      });

      handleClose();
    } catch (error) {
      console.error('Import backup error:', error);
      const msg = error?.message || 'Failed to import backup';
      if (msg.includes('password') || msg.includes('decrypt')) {
        showAlert({
          title: t('Wrong Password'),
          message: t('The password you entered is incorrect. Please try again with the correct password.'),
          type: 'error',
        });
      } else {
        showAlert({
          title: t('Import Failed'),
          message: msg,
          type: 'error',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanQR = () => {
    handleReset();
    onClose();
    // Small delay so the modal closes first before opening scanner
    setTimeout(() => {
      onScanQR();
    }, 300);
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, isLight && { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
          {/* Header */}
          <View style={styles.header}>
            <MaterialIcons name="sync" size={wp('7%')} color={COLORS.primary} />
            <Text style={[styles.title, isLight && { color: '#0F172A' }]}>{t('Sync Data')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={wp('6%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, isLight && { color: '#64748B' }]}>
            {t('Choose how you want to restore your data')}
          </Text>

          {!showPasswordPrompt ? (
            /* Main Options */
            <View style={styles.optionsContainer}>
              {/* Scan QR Option */}
              <TouchableOpacity 
                style={[styles.optionCard, isLight && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]} 
                onPress={handleScanQR} 
                activeOpacity={0.7}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(48, 33, 224, 0.15)' }]}>
                  <MaterialIcons name="qr-code-scanner" size={wp('8%')} color={COLORS.primary} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, isLight && { color: '#0F172A' }]}>{t('Scan QR Code')}</Text>
                  <Text style={[styles.optionDesc, isLight && { color: '#64748B' }]}>{t('Scan a QR from another device to sync data instantly')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={wp('5%')} color={isLight ? '#94A3B8' : COLORS.text.secondary} />
              </TouchableOpacity>

              {/* Load Backup File Option */}
              <TouchableOpacity 
                style={[styles.optionCard, isLight && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]} 
                onPress={handlePickFile} 
                activeOpacity={0.7}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(81, 207, 102, 0.15)' }]}>
                  <Ionicons name="folder-open" size={wp('8%')} color="#51cf66" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, isLight && { color: '#0F172A' }]}>{t('Load Backup File')}</Text>
                  <Text style={[styles.optionDesc, isLight && { color: '#64748B' }]}>{t('Import a password-protected .finfit backup from device')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={wp('5%')} color={isLight ? '#94A3B8' : COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Password Prompt */
            <View style={styles.passwordContainer}>
              <View style={[styles.fileInfo, isLight && { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="document-attach" size={wp('5%')} color={COLORS.primary} />
                <Text style={[styles.fileName, isLight && { color: '#0F172A' }]} numberOfLines={1}>{selectedFileName}</Text>
              </View>

              <Text style={[styles.passwordLabel, isLight && { color: '#0F172A' }]}>{t('Enter Backup Password')}</Text>
              <View style={[styles.passwordInputRow, isLight && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
                <TextInput
                  style={[styles.passwordInput, isLight && { color: '#0F172A' }]}
                  placeholder={t('Enter password...')}
                  placeholderTextColor={isLight ? '#94A3B8' : COLORS.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoFocus={true}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={wp('5%')}
                    color={isLight ? '#64748B' : COLORS.text.secondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, isLight && { backgroundColor: '#E2E8F0' }]}
                  onPress={handleReset}
                  disabled={isLoading}
                >
                  <Text style={[styles.cancelBtnText, isLight && { color: '#0F172A' }]}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.importBtn, isLoading && { opacity: 0.6 }]}
                  onPress={handleDecryptAndImport}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="lock-open" size={wp('4%')} color="#fff" />
                      <Text style={styles.importBtnText}>{t('Decrypt & Import')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp('4%'),
    width: wp('88%'),
    padding: wp('5%'),
    maxHeight: hp('75%'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  title: {
    fontSize: wp('5.5%'),
    fontWeight: '700',
    color: COLORS.text.primary,
    marginLeft: wp('2%'),
    flex: 1,
  },
  closeBtn: {
    padding: wp('1.5%'),
  },
  subtitle: {
    fontSize: wp('3.4%'),
    color: COLORS.text.secondary,
    marginBottom: hp('2.5%'),
    marginLeft: wp('1%'),
  },
  optionsContainer: {
    gap: hp('1.5%'),
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: wp('3%'),
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionIconCircle: {
    width: wp('14%'),
    height: wp('14%'),
    borderRadius: wp('7%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: wp('3%'),
    marginRight: wp('1%'),
  },
  optionTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: hp('0.3%'),
  },
  optionDesc: {
    fontSize: wp('3%'),
    color: COLORS.text.secondary,
    lineHeight: wp('4.2%'),
  },
  passwordContainer: {
    gap: hp('1.5%'),
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 33, 224, 0.1)',
    borderRadius: wp('2%'),
    padding: wp('3%'),
    gap: wp('2%'),
  },
  fileName: {
    fontSize: wp('3.5%'),
    color: COLORS.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  passwordLabel: {
    fontSize: wp('3.8%'),
    color: COLORS.text.primary,
    fontWeight: '600',
    marginTop: hp('0.5%'),
  },
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: wp('2.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  passwordInput: {
    flex: 1,
    color: COLORS.text.primary,
    fontSize: wp('4%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  eyeBtn: {
    padding: wp('3%'),
  },
  passwordActions: {
    flexDirection: 'row',
    gap: wp('3%'),
    marginTop: hp('0.5%'),
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('2.5%'),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtnText: {
    color: COLORS.text.secondary,
    fontSize: wp('3.8%'),
    fontWeight: '600',
  },
  importBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('2.5%'),
    backgroundColor: COLORS.primary,
    gap: wp('2%'),
  },
  importBtnText: {
    color: '#fff',
    fontSize: wp('3.8%'),
    fontWeight: '600',
  },
});

export default SyncDataModal;
