// AppGuideOverlay.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { COLORS } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from './globalProvider';

const TOUR_STEPS = [
  {
    id: 'welcome',
    icon: 'sparkles',
    titleKey: 'Welcome to FinFit',
    subtitleKey: 'Smart Financial Tracking',
    descKey: 'Manage your daily expenses, track income in real-time, and get AI-powered financial insights.',
    position: 'center',
    arrow: null,
  },
  {
    id: 'overview',
    icon: 'stats-chart',
    titleKey: 'Monthly Overview',
    subtitleKey: 'Real-time Balance & Totals',
    descKey: 'Keep an eye on total expenses, income, and remaining cash flow for the active month at the top of your screen.',
    position: 'top',
    arrow: 'top',
  },
  {
    id: 'actions',
    icon: 'add-circle',
    titleKey: 'Quick Actions & AI Scan',
    subtitleKey: 'Add or Scan Instantly',
    descKey: 'Tap the "+" button to record an expense or transfer, or tap the camera icon to parse paper receipts with AI.',
    position: 'bottom-fab',
    arrow: 'right',
  },
  {
    id: 'navigation',
    icon: 'compass',
    titleKey: 'Explore FinFit',
    subtitleKey: 'Analysis, Budgets & Accounts',
    descKey: 'Use the bottom tabs for visual spending trends and category budgets, and the top-left menu for backup & settings.',
    position: 'bottom-tabs',
    arrow: 'bottom',
  },
];

const AppGuideOverlay = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { state } = useGlobalContext();
  const isLight = state?.theme === 'light';
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      animateIn();
    }
  }, [visible]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    cardScaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose?.();
    });
  };

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  // Compute position styles based on step
  let positionStyle = styles.posCenter;
  if (step.position === 'top') {
    positionStyle = styles.posTop;
  } else if (step.position === 'bottom-fab') {
    positionStyle = styles.posBottomFab;
  } else if (step.position === 'bottom-tabs') {
    positionStyle = styles.posBottomTabs;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleFinish}>
      <View style={styles.overlay}>
        {/* Semi-transparent backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleFinish}
        />

        {/* Guided Coachmark Card */}
        <Animated.View
          style={[
            styles.card,
            positionStyle,
            isLight && { backgroundColor: '#FFFFFF', borderColor: COLORS.primary, shadowColor: '#000000' },
            {
              opacity: fadeAnim,
              transform: [{ scale: cardScaleAnim }],
            },
          ]}
        >
          {/* Top Primary Accent Bar */}
          <View style={styles.accentBar} />

          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name={step.icon} size={wp('5.5%')} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: wp('3%') }}>
              <Text style={styles.stepCounter}>
                {`${t('Step') || 'STEP'} ${currentStep + 1} ${t('of') || 'OF'} ${TOUR_STEPS.length}`}
              </Text>
              <Text style={[styles.stepTitle, isLight && { color: '#0F172A' }]}>
                {t(step.titleKey) || step.titleKey}
              </Text>
            </View>
            <TouchableOpacity onPress={handleFinish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={wp('5.5%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Subtitle / Category */}
          <Text style={[styles.stepSubtitle, isLight && { color: COLORS.primary }]}>
            {t(step.subtitleKey) || step.subtitleKey}
          </Text>

          {/* Description */}
          <Text style={[styles.stepDesc, isLight && { color: '#475569' }]}>
            {t(step.descKey) || step.descKey}
          </Text>

          {/* Progress Indicators & Action Buttons */}
          <View style={[styles.footerRow, isLight && { borderTopColor: '#E2E8F0' }]}>
            {/* Dots */}
            <View style={styles.dotsContainer}>
              {TOUR_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentStep
                      ? styles.dotActive
                      : [styles.dotInactive, isLight && { backgroundColor: '#CBD5E1' }],
                  ]}
                />
              ))}
            </View>

            {/* Navigation buttons */}
            <View style={styles.buttonsWrap}>
              {!isFirst && (
                <TouchableOpacity
                  style={[styles.prevBtn, isLight && { backgroundColor: '#F1F5F9' }]}
                  onPress={handlePrev}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.prevBtnText, isLight && { color: '#0F172A' }]}>
                    {t('Back') || 'Back'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.nextBtn}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.nextBtnText}>
                  {isLast ? (t('Get Started') || 'Got it!') : (t('Next') || 'Next')}
                </Text>
                <Ionicons
                  name={isLast ? 'checkmark' : 'arrow-forward'}
                  size={wp('4%')}
                  color="#FFFFFF"
                  style={{ marginLeft: wp('1%') }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Directional Pointer Arrows */}
          {step.arrow === 'top' && <View style={[styles.arrowTop, isLight && { borderBottomColor: '#FFFFFF' }]} />}
          {step.arrow === 'right' && <View style={[styles.arrowRight, isLight && { borderLeftColor: '#FFFFFF' }]} />}
          {step.arrow === 'bottom' && <View style={[styles.arrowBottom, isLight && { borderTopColor: '#FFFFFF' }]} />}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default AppGuideOverlay;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#181724',
    borderRadius: wp('4.5%'),
    padding: wp('4.5%'),
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    elevation: 15,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: wp('5%'),
    right: wp('5%'),
    height: 3,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  posCenter: {
    left: wp('7%'),
    right: wp('7%'),
    top: hp('28%'),
  },
  posTop: {
    left: wp('6%'),
    right: wp('6%'),
    top: hp('21%'),
  },
  posBottomFab: {
    left: wp('6%'),
    right: wp('22%'),
    bottom: hp('10%'),
  },
  posBottomTabs: {
    left: wp('6%'),
    right: wp('6%'),
    bottom: hp('10%'),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.8%'),
  },
  iconWrap: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('5.5%'),
    backgroundColor: 'rgba(48, 33, 224, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(48, 33, 224, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCounter: {
    fontSize: wp('2.7%'),
    fontWeight: '700',
    color: COLORS.secondary || '#38BDF8',
    letterSpacing: 1.2,
  },
  stepTitle: {
    fontSize: wp('4.3%'),
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: 1,
  },
  stepSubtitle: {
    fontSize: wp('3.3%'),
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: hp('0.6%'),
  },
  stepDesc: {
    fontSize: wp('3.2%'),
    color: COLORS.text.secondary,
    lineHeight: wp('4.8%'),
    marginBottom: hp('2%'),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: hp('0.5%'),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
  },
  dot: {
    height: wp('2%'),
    borderRadius: wp('1%'),
  },
  dotActive: {
    width: wp('5%'),
    backgroundColor: COLORS.primary,
  },
  dotInactive: {
    width: wp('2%'),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  prevBtn: {
    paddingHorizontal: wp('3%'),
    paddingVertical: wp('2%'),
  },
  prevBtnText: {
    fontSize: wp('3.2%'),
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('2.2%'),
    borderRadius: wp('2.5%'),
  },
  nextBtnText: {
    fontSize: wp('3.2%'),
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Directional Pointer Arrows
  arrowTop: {
    position: 'absolute',
    top: -wp('2.5%'),
    left: wp('12%'),
    width: 0,
    height: 0,
    borderLeftWidth: wp('2.5%'),
    borderRightWidth: wp('2.5%'),
    borderBottomWidth: wp('2.5%'),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: COLORS.primary,
  },
  arrowRight: {
    position: 'absolute',
    right: -wp('2.5%'),
    bottom: hp('3%'),
    width: 0,
    height: 0,
    borderTopWidth: wp('2.5%'),
    borderBottomWidth: wp('2.5%'),
    borderLeftWidth: wp('2.5%'),
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: COLORS.primary,
  },
  arrowBottom: {
    position: 'absolute',
    bottom: -wp('2.5%'),
    left: wp('25%'),
    width: 0,
    height: 0,
    borderLeftWidth: wp('2.5%'),
    borderRightWidth: wp('2.5%'),
    borderTopWidth: wp('2.5%'),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.primary,
  },
});
