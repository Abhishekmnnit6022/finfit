//_layout.jsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Animated, Image } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { GlobalProvider, useGlobalContext } from '../components/globalProvider';
import { I18nextProvider } from 'react-i18next';
import i18n from '../utils/language/i18config';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { COLORS } from '../constants';
import AppAuthGate from '../components/AppAuthGate';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav({ showSplash, slideAnim }) {
  const { state } = useGlobalContext();
  const isLight = state?.theme === 'light';
  const navTheme = isLight ? DefaultTheme : DarkTheme;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: isLight ? '#FFFFFF' : COLORS.background }]}>
      <ThemeProvider value={navTheme}>
        {showSplash ? (
          <Animated.View
            style={[
              styles.splashContainer,
              {
                backgroundColor: isLight ? '#FFFFFF' : COLORS.background,
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
        <AppAuthGate>
          <Stack screenOptions={{ 
            headerShown: false,
            contentStyle: { backgroundColor: isLight ? '#FFFFFF' : COLORS.background }
          }}>
            <Stack.Screen name="index" options={{ gestureEnabled: true }} />
            <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          </Stack>
        </AppAuthGate>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem('FINFIT_ONBOARDING_DONE');
        const hasSeenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
        const isAlreadyOnboarded = onboardingDone === 'true' || hasSeenWelcome === 'true';
        await SplashScreen.hideAsync().catch(() => {});

        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start(async () => {
          if (!isMounted) return;
          setShowSplash(false);
          if (isAlreadyOnboarded) {
            try {
              router.replace('/(drawer)');
            } catch (e) {
              console.warn('Navigation error:', e);
            }
          } else {
            try {
              router.replace('/');
            } catch (e) {
              console.warn('Navigation error:', e);
            }
          }
        });
      } catch (error) {
        console.error('Error in initializeApp:', error);
        await SplashScreen.hideAsync().catch(() => {});
        if (isMounted) {
          setShowSplash(false);
          try {
            router.replace('/(drawer)');
          } catch (e) {}
        }
      }
    };

    if (loaded) {
      initializeApp();
    }

    // Safety timeout: Ensure splash screen never freezes on any device
    const safetyTimer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      if (isMounted && showSplash) {
        setShowSplash(false);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <GlobalProvider>
        <RootLayoutNav showSplash={showSplash} slideAnim={slideAnim} />
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
    zIndex: 999,
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
});