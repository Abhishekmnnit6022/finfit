import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { COLORS } from '../constants/theme';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../components/globalProvider';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const QRScreen = () => {
  const { t } = useTranslation();
  const { generateTransferData, generateBackupFileData, showAlert } = useGlobalContext();
  const [qrData, setQrData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState('');

  // Password-protected file export modal state
  // exportMode: 'SAVE' (save to device storage) or 'SHARE' (share via apps like WhatsApp/Drive)
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState('SAVE');
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const router = useRouter();

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await generateTransferData();
      if (data) {
        setQrData(data);
      } else {
        setErrorMsg('No data available to generate QR code');
      }
    } catch (error) {
      console.error('Error generating QR data:', error);
      setErrorMsg(error?.message || 'Failed to generate QR code');
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateUser = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError('');

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsAuthenticated(true);
        await loadData();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('Authenticate to access Financial Backup'),
        fallbackLabel: t('Use Device PIN / Password'),
        cancelLabel: t('Cancel'),
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAuthenticated(true);
        await loadData();
      } else {
        setIsAuthenticated(false);
        setAuthError(t('Authentication required to reveal financial backup'));
      }
    } catch (err) {
      console.warn('Authentication error:', err?.message);
      setAuthError(t('Authentication failed. Please tap to try again.'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    authenticateUser();
  }, []);

  const openExportModal = (mode) => {
    setExportMode(mode);
    setBackupPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowExportModal(true);
  };

  const handleCloseExportModal = () => {
    if (isExporting) return;
    setShowExportModal(false);
    setBackupPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleProcessExport = async () => {
    const trimmedPwd = backupPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPwd) {
      showAlert({
        title: t('Password Required'),
        message: t('Please enter a password to protect your backup file.'),
        type: 'warning',
      });
      return;
    }

    if (trimmedPwd.length < 4) {
      showAlert({
        title: t('Password Too Short'),
        message: t('Password must be at least 4 characters long.'),
        type: 'warning',
      });
      return;
    }

    if (trimmedPwd !== trimmedConfirm) {
      showAlert({
        title: t('Passwords Do Not Match'),
        message: t('Please make sure both passwords match.'),
        type: 'error',
      });
      return;
    }

    setIsExporting(true);
    try {
      const encryptedData = await generateBackupFileData(trimmedPwd);
      if (!encryptedData) {
        throw new Error('Failed to generate backup payload');
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `finfit_backup_${dateStr}_${Date.now().toString().slice(-4)}.json`;

      // Standard JSON wrapper so Drive, WhatsApp and downloaders never corrupt or rename to .bin
      const backupPayload = JSON.stringify(
        {
          finfit_backup: true,
          version: '2.0',
          format: 'encrypted',
          createdAt: new Date().toISOString(),
          payload: encryptedData,
        },
        null,
        2
      );

      if (exportMode === 'SAVE') {
        // Option 1: Save directly into chosen folder on same device
        if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
          const permissions =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              'application/json'
            );
            await FileSystem.writeAsStringAsync(fileUri, backupPayload, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            handleCloseExportModal();
            showAlert({
              title: t('Backup Saved'),
              message: `${t('Backup file saved successfully to your selected folder:')} ${fileName}`,
              type: 'success',
            });
            return;
          } else {
            // User cancelled folder picker
            handleCloseExportModal();
            return;
          }
        } else {
          // Fallback for non-SAF
          const localPath = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(localPath, backupPayload, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          handleCloseExportModal();
          showAlert({
            title: t('Backup Saved'),
            message: `${t('Backup saved to app documents:')} ${fileName}`,
            type: 'success',
          });
          return;
        }
      } else {
        // Option 2: Share via Apps (WhatsApp, Google Drive, Email)
        const cachePath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(cachePath, backupPayload, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        handleCloseExportModal();

        const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
        if (isAvailable) {
          await Sharing.shareAsync(cachePath, {
            mimeType: 'application/json',
            dialogTitle: 'Share FinFit Encrypted Backup (.json)',
            UTI: 'public.json',
          });
        }
      }
    } catch (err) {
      console.error('Export backup file error:', err);
      showAlert({
        title: t('Export Failed'),
        message: err?.message || 'Could not create encrypted backup file.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent={false} backgroundColor={COLORS.background} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={wp('6%')} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
      </View>

      {!isAuthenticated ? (
        <View style={styles.authContainer}>
          <View style={styles.lockIconCircle}>
            <Ionicons name="shield-checkmark" size={wp('16%')} color={COLORS.primary} />
          </View>
          <Text style={styles.authTitle}>{t('Security Verification')}</Text>
          <Text style={styles.authSubtitle}>
            {t('FinFit requires device authentication (Fingerprint, Face ID, or PIN) to protect your financial backup data.')}
          </Text>

          {authError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={wp('4.5%')} color="#ff4d4f" />
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.authButton}
            onPress={authenticateUser}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="fingerprint" size={wp('6%')} color="#FFFFFF" />
                <Text style={styles.authButtonText}>{t('Unlock with Biometrics / PIN')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{t('Data Backup & Transfer')}</Text>
          <Text style={styles.subtitle}>
            {t('Scan the QR code directly, save an encrypted file to this device, or share via WhatsApp / Drive.')}
          </Text>

          {/* QR Code Container */}
          <View style={styles.qrContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : qrData ? (
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrData}
                  size={wp('54%')}
                  backgroundColor="white"
                  color="black"
                  onError={(err) => {
                    console.warn('QR render error:', err);
                    setErrorMsg('Failed to render QR code graphic');
                    setQrData('');
                  }}
                />
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.errorText}>{errorMsg || 'Failed to generate QR code'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadData}>
                  <Text style={styles.retryButtonText}>{t('Retry')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Security Badge */}
          <View style={styles.securityBadge}>
            <Ionicons name="lock-closed" size={wp('3.8%')} color="#51cf66" />
            <Text style={styles.securityBadgeText}>{t('Protected with FinFit End-to-End Encryption')}</Text>
          </View>

          {/* Export Options Section: 2 distinct cards */}
          <View style={styles.exportSection}>
            <Text style={styles.sectionHeader}>{t('File Backup Options (Supports Unlimited Data)')}</Text>

            {/* 1. Save to Device Storage */}
            <TouchableOpacity
              style={styles.exportFileCard}
              onPress={() => openExportModal('SAVE')}
              activeOpacity={0.7}
            >
              <View style={[styles.exportFileIconCircle, { backgroundColor: 'rgba(81, 207, 102, 0.15)' }]}>
                <Ionicons name="folder-outline" size={wp('6%')} color="#51cf66" />
              </View>
              <View style={styles.exportFileTextContainer}>
                <View style={styles.exportFileTitleRow}>
                  <Text style={styles.exportFileTitle}>{t('Save to Phone Storage')}</Text>
                  <View style={[styles.badgeNew, { backgroundColor: 'rgba(81, 207, 102, 0.2)' }]}>
                    <Text style={[styles.badgeNewText, { color: '#51cf66' }]}>{t('This Device')}</Text>
                  </View>
                </View>
                <Text style={styles.exportFileDesc}>
                  {t('Choose a folder (Downloads, Documents) to save encrypted backup file locally.')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={wp('5%')} color={COLORS.text.secondary} />
            </TouchableOpacity>

            {/* 2. Share via WhatsApp / Drive */}
            <TouchableOpacity
              style={[styles.exportFileCard, { marginTop: hp('1.2%') }]}
              onPress={() => openExportModal('SHARE')}
              activeOpacity={0.7}
            >
              <View style={[styles.exportFileIconCircle, { backgroundColor: 'rgba(48, 33, 224, 0.15)' }]}>
                <Ionicons name="share-social-outline" size={wp('6%')} color={COLORS.primary} />
              </View>
              <View style={styles.exportFileTextContainer}>
                <View style={styles.exportFileTitleRow}>
                  <Text style={styles.exportFileTitle}>{t('Share via WhatsApp / Drive')}</Text>
                  <View style={[styles.badgeNew, { backgroundColor: 'rgba(48, 33, 224, 0.2)' }]}>
                    <Text style={[styles.badgeNewText, { color: COLORS.primary }]}>{t('Cloud / Apps')}</Text>
                  </View>
                </View>
                <Text style={styles.exportFileDesc}>
                  {t('Send password-protected JSON backup via WhatsApp, Google Drive, or Email.')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={wp('5%')} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.helpText}>
            {t('To restore data later, go to Drawer → Sync Data → Load Backup File and select the saved backup.')}
          </Text>
        </ScrollView>
      )}

      {/* Password Modal for Backup File Export */}
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseExportModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconCircle}>
                <Ionicons
                  name={exportMode === 'SAVE' ? 'folder' : 'share-social'}
                  size={wp('5%')}
                  color={exportMode === 'SAVE' ? '#51cf66' : COLORS.primary}
                />
              </View>
              <Text style={styles.modalTitle}>
                {exportMode === 'SAVE' ? t('Save to Device Storage') : t('Share Backup File')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={handleCloseExportModal}
                disabled={isExporting}
              >
                <Ionicons name="close" size={wp('6%')} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {t('Set a password to encrypt your financial backup file. You will need to enter this exact password when restoring.')}
            </Text>

            {/* Password Input */}
            <Text style={styles.inputLabel}>{t('Choose Password')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder={t('Enter password...')}
                placeholderTextColor={COLORS.text.secondary}
                value={backupPassword}
                onChangeText={setBackupPassword}
                secureTextEntry={!showPassword}
                editable={!isExporting}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={wp('5%')}
                  color={COLORS.text.secondary}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <Text style={styles.inputLabel}>{t('Confirm Password')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder={t('Re-enter password...')}
                placeholderTextColor={COLORS.text.secondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                editable={!isExporting}
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={handleCloseExportModal}
                disabled={isExporting}
              >
                <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  exportMode === 'SAVE' && { backgroundColor: '#2b8a3e' },
                  isExporting && { opacity: 0.6 },
                ]}
                onPress={handleProcessExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={exportMode === 'SAVE' ? 'download-outline' : 'share-social'}
                      size={wp('4%')}
                      color="#FFFFFF"
                    />
                    <Text style={styles.modalSubmitText}>
                      {exportMode === 'SAVE' ? t('Save Backup') : t('Encrypt & Share')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
  },
  logo: {
    width: wp('20%'),
    height: wp('8%'),
  },
  menuButton: {
    padding: wp('2%'),
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp('5%'),
    paddingBottom: hp('4%'),
    alignItems: 'center',
  },
  authContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('8%'),
  },
  lockIconCircle: {
    width: wp('28%'),
    height: wp('28%'),
    borderRadius: wp('14%'),
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('3%'),
  },
  authTitle: {
    fontSize: wp('5.8%'),
    fontWeight: 'bold',
    color: COLORS.whiteBg,
    marginBottom: hp('1.5%'),
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: wp('3.8%'),
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: wp('5.5%'),
    marginBottom: hp('3%'),
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 77, 79, 0.15)',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: wp('2.5%'),
    marginBottom: hp('2.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 79, 0.3)',
    maxWidth: '90%',
  },
  errorBannerText: {
    color: '#ff4d4f',
    fontSize: wp('3.4%'),
    marginLeft: wp('2%'),
    flexShrink: 1,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.8%'),
    borderRadius: wp('3.5%'),
    width: '100%',
    maxWidth: wp('80%'),
    gap: wp('2%'),
    elevation: 3,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  title: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: COLORS.whiteBg,
    marginBottom: hp('0.6%'),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: wp('3.4%'),
    color: '#a0a0a0',
    marginBottom: hp('2.2%'),
    textAlign: 'center',
    lineHeight: wp('4.8%'),
  },
  qrContainer: {
    width: wp('64%'),
    height: wp('64%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrWrapper: {
    padding: wp('4%'),
    backgroundColor: COLORS.whiteBg,
    borderRadius: wp('5%'),
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(81, 207, 102, 0.12)',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.8%'),
    borderRadius: wp('4%'),
    marginTop: hp('1.8%'),
    borderWidth: 1,
    borderColor: 'rgba(81, 207, 102, 0.3)',
  },
  securityBadgeText: {
    color: '#51cf66',
    fontSize: wp('3.1%'),
    marginLeft: wp('1.5%'),
    fontWeight: '500',
  },
  exportSection: {
    width: '100%',
    marginTop: hp('2.5%'),
  },
  sectionHeader: {
    fontSize: wp('3.3%'),
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: hp('1%'),
    marginLeft: wp('1%'),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exportFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: wp('3.5%'),
    padding: wp('3.8%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  exportFileIconCircle: {
    width: wp('13%'),
    height: wp('13%'),
    borderRadius: wp('6.5%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportFileTextContainer: {
    flex: 1,
    marginLeft: wp('3%'),
    marginRight: wp('1%'),
  },
  exportFileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: wp('1.5%'),
    marginBottom: hp('0.3%'),
  },
  exportFileTitle: {
    fontSize: wp('3.6%'),
    fontWeight: '700',
    color: COLORS.text.primary,
    flexShrink: 1,
  },
  badgeNew: {
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.2%'),
    borderRadius: wp('2%'),
    alignSelf: 'center',
  },
  badgeNewText: {
    fontSize: wp('2.5%'),
    fontWeight: '700',
  },
  exportFileDesc: {
    fontSize: wp('3%'),
    color: COLORS.text.secondary,
    lineHeight: wp('4.2%'),
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: wp('4%'),
    textAlign: 'center',
    marginBottom: hp('1.5%'),
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('3%'),
    marginTop: hp('1%'),
  },
  retryButtonText: {
    color: '#fff',
    fontSize: wp('3.8%'),
    fontWeight: '600',
  },
  helpText: {
    fontSize: wp('3.1%'),
    color: '#808080',
    textAlign: 'center',
    marginTop: hp('2%'),
    paddingHorizontal: wp('6%'),
    lineHeight: wp('4.4%'),
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp('4%'),
    width: wp('88%'),
    padding: wp('5%'),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  modalIconCircle: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: 'rgba(48, 33, 224, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: COLORS.text.primary,
    marginLeft: wp('2.5%'),
    flex: 1,
  },
  modalCloseBtn: {
    padding: wp('1.5%'),
  },
  modalSubtitle: {
    fontSize: wp('3.2%'),
    color: COLORS.text.secondary,
    marginBottom: hp('2%'),
    lineHeight: wp('4.4%'),
  },
  inputLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: hp('0.6%'),
    marginTop: hp('0.8%'),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: wp('2.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: hp('1%'),
  },
  textInput: {
    flex: 1,
    color: COLORS.text.primary,
    fontSize: wp('3.8%'),
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('1.3%'),
  },
  eyeBtn: {
    padding: wp('3%'),
  },
  modalActions: {
    flexDirection: 'row',
    gap: wp('3%'),
    marginTop: hp('1.5%'),
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('2.5%'),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCancelText: {
    color: COLORS.text.secondary,
    fontSize: wp('3.8%'),
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('2.5%'),
    backgroundColor: COLORS.primary,
    gap: wp('2%'),
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: wp('3.6%'),
    fontWeight: '600',
  },
});

export default QRScreen;