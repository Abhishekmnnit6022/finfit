import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { COLORS } from '../constants/theme';
import { useTranslation } from 'react-i18next';

export default function AppAuthGate({ children }) {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [authError, setAuthError] = useState(false);
  const isAuthenticating = useRef(false);
  const backgroundTime = useRef(0);

  const performAuthentication = async () => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;

    try {
      // 1. Check if user has completed first-time welcome/onboarding
      const seenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
      const launched = await AsyncStorage.getItem('hasLaunched');
      const onboardingDone = await AsyncStorage.getItem('FINFIT_ONBOARDING_DONE');
      const hasOnboarded = seenWelcome === 'true' || launched === 'true' || onboardingDone === 'true' || seenWelcome === '"true"';
      if (!hasOnboarded) {
        // First install -> Let user see welcome screen first
        setIsAuthenticated(true);
        setIsChecking(false);
        isAuthenticating.current = false;
        return;
      }

      // 2. Check device lock hardware and enrollment
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Device does not have biometric or PIN lock enrolled -> allow access
        setIsAuthenticated(true);
        setIsChecking(false);
        isAuthenticating.current = false;
        return;
      }

      // 3. Prompt native system authentication (Biometrics or PIN/Password)
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('Unlock FinFit') || 'Unlock FinFit',
        fallbackLabel: t('Use Device PIN') || 'Use Device PIN',
        cancelLabel: t('Cancel') || 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAuthenticated(true);
        setAuthError(false);
      } else {
        setAuthError(true);
      }
    } catch (err) {
      console.warn('Native authentication error:', err);
      // On unexpected native error, allow retry
      setAuthError(true);
    } finally {
      setIsChecking(false);
      isAuthenticating.current = false;
    }
  };

  useEffect(() => {
    performAuthentication();

    // Re-authenticate when returning from background after leaving app
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        backgroundTime.current = Date.now();
      } else if (nextAppState === 'active') {
        // If app was backgrounded for more than 15 seconds, re-lock
        const elapsed = Date.now() - backgroundTime.current;
        if (backgroundTime.current > 0 && elapsed > 15000) {
          setIsAuthenticated(false);
          performAuthentication();
        }
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  if (isAuthenticated) {
    return children;
  }

  return (
    <View style={styles.lockContainer}>
      <View style={styles.lockContent}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={wp('14%')} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>{t('FinFit is Locked') || 'FinFit is Locked'}</Text>
        <Text style={styles.subtitle}>
          {t('Authenticate with your fingerprint, face, or device PIN to continue.') ||
            'Authenticate with your fingerprint, face, or device PIN to continue.'}
        </Text>

        {isChecking ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: hp('3%') }} />
        ) : (
          <TouchableOpacity
            style={styles.unlockButton}
            activeOpacity={0.8}
            onPress={performAuthentication}
          >
            <Ionicons name="finger-print" size={wp('6%')} color="#FFFFFF" />
            <Text style={styles.unlockButtonText}>{t('Unlock FinFit') || 'Unlock FinFit'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockContainer: {
    flex: 1,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('8%'),
  },
  lockContent: {
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: wp('40%'),
    height: wp('16%'),
    marginBottom: hp('4%'),
  },
  iconCircle: {
    width: wp('26%'),
    height: wp('26%'),
    borderRadius: wp('13%'),
    backgroundColor: 'rgba(48, 33, 224, 0.12)',
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('3%'),
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp('6%'),
    fontWeight: '700',
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: wp('3.8%'),
    textAlign: 'center',
    lineHeight: wp('5.5%'),
    marginBottom: hp('4%'),
    paddingHorizontal: wp('4%'),
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: hp('1.8%'),
    paddingHorizontal: wp('8%'),
    borderRadius: wp('3.5%'),
    gap: wp('2.5%'),
    width: '100%',
    maxWidth: wp('70%'),
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: wp('4.2%'),
    fontWeight: '700',
  },
});
