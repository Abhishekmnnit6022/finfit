//_layout.jsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Animated, Image, Text, TouchableOpacity,Platform } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { GlobalProvider } from '../components/globalProvider';
import { I18nextProvider } from 'react-i18next';
import i18n from '../utils/language/i18config';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { COLORS } from '../constants';
import { BiometricAuth } from '../utils/biometricAuth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState(null);
  const slideAnim = new Animated.Value(0);
  const [biometricType, setBiometricType] = useState(null);

  
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const authenticate = async () => {
    try {
      const biometricStatus = await BiometricAuth.isBiometricAvailable();
      setBiometricType(biometricStatus);

      if (!biometricStatus.available) {
        setIsAuthenticating(false);
        checkFirstLaunch();
        return;
      }

      const { success, error } = await BiometricAuth.authenticate();
      
      if (success) {
        setIsAuthenticating(false);
        checkFirstLaunch();
      } else {
        setAuthError(`Authentication failed. Please try again using ${biometricStatus.name}.`);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthError('Authentication error. Please try again.');
    }
  };


  const checkFirstLaunch = async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem('hasLaunched');
      await SplashScreen.hideAsync();
      
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start(async () => {
        setShowSplash(false);
        if (hasLaunched === null) {
          await AsyncStorage.setItem('hasLaunched', 'true');
          router.replace('/');
        } else {
          router.replace('/(drawer)');
        }
      });
    } catch (error) {
      console.error('Error checking first launch:', error);
      await SplashScreen.hideAsync();
      setShowSplash(false);
    }
  };

  useEffect(() => {
    if (loaded) {
      authenticate();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  if (isAuthenticating) {
    return (
      <View style={styles.authContainer}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.authLogo}
        />
        {biometricType?.available ? (
          <>
            <Text style={styles.authText}>
              {Platform.select({
                ios: 'Please authenticate with Face ID',
                android: 'Please authenticate with Fingerprint'
              })}
            </Text>
            {authError ? (
              <>
                <Text style={styles.authError}>{authError}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={authenticate}
                >
                  <Text style={styles.retryButtonText}>
                    Retry with {biometricType.name}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.notAvailableContainer}>
            <Text style={styles.authError}>
              {Platform.select({
                ios: 'Face ID is not set up on this device.',
                android: 'Fingerprint is not set up on this device.'
              })}
            </Text>
            <TouchableOpacity 
              style={styles.proceedButton}
              onPress={() => {
                setIsAuthenticating(false);
                checkFirstLaunch();
              }}
            >
              <Text style={styles.proceedButtonText}>Proceed without authentication</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );}

  return (
    <I18nextProvider i18n={i18n}>
      <GlobalProvider>
        <GestureHandlerRootView style={styles.container}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            {showSplash ? (
              <Animated.View
                style={[
                  styles.splashContainer,
                  {
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -hp('100%')],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.splashContent}>
                  <Image
                    source={require('../assets/images/logo.png')}
                    style={styles.splashImage}
                  />
                </View>
              </Animated.View>
            ) : null}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ gestureEnabled: true }} />
              <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
            </Stack>
          </ThemeProvider>
        </GestureHandlerRootView>
      </GlobalProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 1,
  },
  splashContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: wp('50%'),
    height: wp('50%'),
    resizeMode: 'contain',
  },
  authContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp(5),
  },
  authLogo: {
    width: wp('50%'),
    height: wp('50%'),
    resizeMode: 'contain',
    marginBottom: hp(3),
  },
  authText: {
    color: COLORS.text.primary,
    fontSize: wp(4),
    marginTop: hp(2),
  },
  authError: {
    color: 'red',
    fontSize: wp(4),
    marginTop: hp(2),
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    padding: wp(4),
    borderRadius: wp(2),
    marginTop: hp(2),
  },
  retryButtonText: {
    color: COLORS.whiteBg,
    fontSize: wp(4),
    fontWeight: '600',
  },
  notAvailableContainer: {
    alignItems: 'center',
    padding: wp(4),
  },
  proceedButton: {
    backgroundColor: COLORS.primary,
    padding: wp(4),
    borderRadius: wp(2),
    marginTop: hp(2),
    opacity: 0.8,
  },
  proceedButtonText: {
    color: COLORS.whiteBg,
    fontSize: wp(4),
    fontWeight: '500',
  },
  authText: {
    color: COLORS.text.primary,
    fontSize: wp(4),
    marginTop: hp(2),
    textAlign: 'center',
    fontWeight: '500',
  },
});