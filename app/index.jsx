import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import * as Haptics from 'expo-haptics';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { COLORS } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../components/globalProvider';

const BUTTON_WIDTH = wp(15);
const CONTAINER_WIDTH = wp(85);
const THRESHOLD = CONTAINER_WIDTH - BUTTON_WIDTH - wp(2.5);

const SlideButton = ({ onSlideComplete, isLight, buttonText }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx >= 0 && gesture.dx <= THRESHOLD) {
          pan.x.setValue(gesture.dx);
        }
      },
      onPanResponderRelease: async (_, gesture) => {
        if (gesture.dx >= THRESHOLD) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.spring(pan.x, {
            toValue: THRESHOLD,
            useNativeDriver: false,
          }).start(() => {
            onSlideComplete();
          });
        } else {
          Animated.spring(pan.x, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const opacity = pan.x.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [1, 0],
  });

  return (
    <View style={[styles.sliderContainer, isLight && { backgroundColor: '#E2E8F0' }]}>
      <View style={styles.sliderTrack}>
        <Animated.View style={[styles.slideText, { opacity }]}>
          <Text style={[styles.slideTextContent, isLight && { color: '#0F172A' }]}>
            {buttonText || 'Slide to start'}
          </Text>
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.slider, { transform: [{ translateX: pan.x }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.circle}>
          <Text style={styles.arrow}>➔</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const WelcomeScreen = () => {
  const router = useRouter();
  const [isOnboarded, setIsOnboarded] = React.useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const { state } = useGlobalContext();
  const { t, i18n } = useTranslation();
  const isLight = state?.theme === 'light';

  useEffect(() => {
    let isMounted = true;
    const checkWelcomeStatus = async () => {
      try {
        const seenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
        const launched = await AsyncStorage.getItem('hasLaunched');
        const onboardingDone = await AsyncStorage.getItem('FINFIT_ONBOARDING_DONE');
        if (
          seenWelcome === 'true' ||
          launched === 'true' ||
          onboardingDone === 'true' ||
          seenWelcome === '"true"'
        ) {
          if (isMounted) setIsOnboarded(true);
          return;
        }
        if (isMounted) setIsOnboarded(false);
      } catch (e) {
        if (isMounted) setIsOnboarded(true);
      }
    };
    checkWelcomeStatus();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (state?.language && i18n.language !== state.language) {
      i18n.changeLanguage(state.language);
    }
  }, [state?.language]);

  useEffect(() => {
    if (isOnboarded === false) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOnboarded]);

  const handleSlideComplete = async () => {
    try {
      await AsyncStorage.setItem('FINFIT_ONBOARDING_DONE', 'true');
      await AsyncStorage.setItem('hasSeenWelcome', 'true');
      await AsyncStorage.setItem('hasLaunched', 'true');
      setIsOnboarded(true);
      router.replace('/(drawer)');
    } catch (error) {
      console.error('Error marking welcome as seen:', error);
      setIsOnboarded(true);
      router.replace('/(drawer)');
    }
  };

  if (isOnboarded === true) {
    return <Redirect href="/(drawer)" />;
  }

  if (isOnboarded === null) {
    return <View style={{ flex: 1, backgroundColor: isLight ? '#FFFFFF' : COLORS.background }} />;
  }

  return (
    <SafeAreaView style={[styles.mainContainer, isLight && { backgroundColor: '#FFFFFF' }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isLight ? 'dark-content' : 'light-content'} />
      <View style={styles.container}>
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Image 
            source={require('../assets/images/logo.png')} 
            style={{ width: wp(72), height: wp(30), resizeMode: 'contain' }} 
          />
        </Animated.View>

        <Animated.View 
          style={[
            styles.featuresContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.featureItem}>
            <Text style={[styles.featureTitle, isLight && { color: '#0F172A' }]}>
              {t('Real-Time Tracking') || t('📊Real-Time Tracking') || '📊 Real-Time Tracking'}
            </Text>
            <Text style={[styles.featureDescription, isLight && { color: '#64748B' }]}>
              {t('Monitor your finances as they happen') || 'Monitor your finances as they happen'}
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={[styles.featureTitle, isLight && { color: '#0F172A' }]}>
              {t('Smart Budgeting') || t('🎯Smart Budgeting') || '🎯 Smart Budgeting'}
            </Text>
            <Text style={[styles.featureDescription, isLight && { color: '#64748B' }]}>
              {t('AI-powered budget recommendations') || 'AI-powered budget recommendations'}
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={[styles.featureTitle, isLight && { color: '#0F172A' }]}>
              {t('Detailed Analytics') || t('📈Detailed Analytics') || '📈 Detailed Analytics'}
            </Text>
            <Text style={[styles.featureDescription, isLight && { color: '#64748B' }]}>
              {t('Understand your spending patterns') || 'Understand your spending patterns'}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.buttonContainer}>
          <SlideButton
            onSlideComplete={handleSlideComplete}
            isLight={isLight}
            buttonText={t('slideToStart') || 'Slide to start'}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: hp(4),
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: hp(4),
  },
  featuresContainer: {
    width: '100%',
    paddingHorizontal: wp(8),
  },
  featureItem: {
    marginBottom: hp(3),
  },
  featureTitle: {
    fontSize: wp(5),
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: hp(0.5),
  },
  featureDescription: {
    fontSize: wp(4),
    color: COLORS.text.secondary,
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: hp(4),
  },
  sliderContainer: {
    width: CONTAINER_WIDTH,
    height: hp(7),
    backgroundColor: COLORS.lightbackground,
    borderRadius: wp(6),
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  sliderTrack: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    justifyContent: 'center',
  },
  slider: {
    width: BUTTON_WIDTH,
    height: '100%',
    position: 'absolute',
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: wp(12),
    height: wp(12),
    backgroundColor: COLORS.whiteBg,
    borderRadius: wp(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    color: COLORS.primary,
    fontSize: wp(5),
    fontWeight: 'bold',
  },
  slideText: {
    paddingLeft: wp(18),
    alignItems: 'flex-start',
  },
  slideTextContent: {
    color: COLORS.text.primary,
    fontSize: wp(4),
    fontWeight: '600',
    letterSpacing: wp(0.1),
  },
});

export default WelcomeScreen;