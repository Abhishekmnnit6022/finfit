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
} from 'react-native';
import { COLORS } from '../constants/theme';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useGlobalContext } from '../components/globalProvider';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';

const QRScreen = () => {
  const { generateTransferData } = useGlobalContext();
  const [qrData, setQrData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState('');

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
        // Fallback gracefully if device has no biometric hardware or device lock
        setIsAuthenticated(true);
        await loadData();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Financial Backup QR',
        fallbackLabel: 'Use Device PIN / Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAuthenticated(true);
        await loadData();
      } else {
        setIsAuthenticated(false);
        setAuthError('Authentication required to reveal financial backup QR');
      }
    } catch (err) {
      console.warn('Authentication error:', err?.message);
      setAuthError('Authentication failed. Please tap to try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    authenticateUser();
  }, []);

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
          <Text style={styles.authTitle}>Security Verification</Text>
          <Text style={styles.authSubtitle}>
            FinFit requires device authentication (Fingerprint, Face ID, or PIN) to protect your financial backup data.
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
                <Text style={styles.authButtonText}>Unlock with Biometrics / PIN</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>Encrypted Backup QR</Text>
          <Text style={styles.subtitle}>
            Scan with FinFit on another device to restore all transactions. Third-party scanners only see encrypted gibberish.
          </Text>

          <View style={styles.qrContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : qrData ? (
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrData}
                  size={wp('60%')}
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
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.securityBadge}>
            <Ionicons name="lock-closed" size={wp('4%')} color="#51cf66" />
            <Text style={styles.securityBadgeText}>Protected with FinFit V1 End-to-End Encryption</Text>
          </View>

          <Text style={styles.helpText}>
            Point another device's FinFit camera scanner at this QR code to transfer and sync your data securely.
          </Text>
        </View>
      )}
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
  content: {
    flex: 1,
    paddingHorizontal: wp('5%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: wp('5.8%'),
    fontWeight: 'bold',
    color: COLORS.whiteBg,
    marginBottom: hp('0.8%'),
  },
  subtitle: {
    fontSize: wp('3.6%'),
    color: '#a0a0a0',
    marginBottom: hp('3%'),
    textAlign: 'center',
    lineHeight: wp('5%'),
  },
  qrContainer: {
    width: wp('70%'),
    height: wp('70%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrWrapper: {
    padding: wp('4%'),
    backgroundColor: COLORS.whiteBg,
    borderRadius: wp('6%'),
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
    marginTop: hp('2.5%'),
    borderWidth: 1,
    borderColor: 'rgba(81, 207, 102, 0.3)',
  },
  securityBadgeText: {
    color: '#51cf66',
    fontSize: wp('3.2%'),
    marginLeft: wp('1.5%'),
    fontWeight: '500',
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
    fontSize: wp('3.3%'),
    color: '#808080',
    textAlign: 'center',
    marginTop: hp('2%'),
    paddingHorizontal: wp('8%'),
  },
});

export default QRScreen;