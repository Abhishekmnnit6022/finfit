// components/BudgetGuideOverlay.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { COLORS } from '../constants/theme';
import { useTranslation } from 'react-i18next';

const BUDGET_STEPS = [
  {
    id: 'overview',
    icon: 'pie-chart',
    titleKey: 'Monthly Budgeting',
    subtitleKey: 'Smart Limit Tracking',
    descKey: 'Monitor overall monthly budget versus your actual spending in real-time.',
    position: 'top',
    arrow: 'top',
  },
  {
    id: 'categories',
    icon: 'list',
    titleKey: 'Category Limits',
    subtitleKey: 'Tap Any Category to Edit',
    descKey: 'Set custom spending caps on Food, Shopping, Bills, etc. Tap any card to adjust its limit.',
    position: 'center',
    arrow: null,
  },
  {
    id: 'add_category',
    icon: 'add-circle',
    titleKey: 'Add Custom Categories',
    subtitleKey: 'Tailored to Your Lifestyle',
    descKey: 'Use the "+" icon at the top right to add new categories with their initial budget limits.',
    position: 'top-right',
    arrow: 'top',
  },
];

const BudgetGuideOverlay = ({ visible, onClose }) => {
  const { t } = useTranslation();
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
    if (currentStep < BUDGET_STEPS.length - 1) {
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

  const step = BUDGET_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === BUDGET_STEPS.length - 1;

  let positionStyle = styles.posCenter;
  if (step.position === 'top') {
    positionStyle = styles.posTop;
  } else if (step.position === 'top-right') {
    positionStyle = styles.posTopRight;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleFinish}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleFinish}
        />

        <Animated.View
          style={[
            styles.card,
            positionStyle,
            {
              opacity: fadeAnim,
              transform: [{ scale: cardScaleAnim }],
            },
          ]}
        >
          <View style={styles.accentBar} />

          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name={step.icon} size={wp('5.5%')} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: wp('3%') }}>
              <Text style={styles.stepCounter}>
                {`${t('Step') || 'STEP'} ${currentStep + 1} ${t('of') || 'OF'} ${BUDGET_STEPS.length}`}
              </Text>
              <Text style={styles.stepTitle}>
                {t(step.titleKey) || step.titleKey}
              </Text>
            </View>
            <TouchableOpacity onPress={handleFinish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={wp('5.5%')} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.stepSubtitle}>
            {t(step.subtitleKey) || step.subtitleKey}
          </Text>

          <Text style={styles.stepDesc}>
            {t(step.descKey) || step.descKey}
          </Text>

          <View style={styles.footerRow}>
            <View style={styles.dotsContainer}>
              {BUDGET_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentStep ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.buttonsWrap}>
              {!isFirst && (
                <TouchableOpacity
                  style={styles.prevBtn}
                  onPress={handlePrev}
                  activeOpacity={0.7}
                >
                  <Text style={styles.prevBtnText}>{t('Back') || 'Back'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.nextBtn}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.nextBtnText}>
                  {isLast ? (t('Got It') || 'Got it!') : (t('Next') || 'Next')}
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

          {step.arrow === 'top' && (
            <View
              style={[
                styles.arrowTop,
                step.position === 'top-right' && { left: wp('65%') },
              ]}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default BudgetGuideOverlay;

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
    top: hp('30%'),
  },
  posTop: {
    left: wp('6%'),
    right: wp('6%'),
    top: hp('18%'),
  },
  posTopRight: {
    left: wp('6%'),
    right: wp('6%'),
    top: hp('13%'),
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
    color: '#38BDF8',
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
  arrowTop: {
    position: 'absolute',
    top: -wp('2.5%'),
    left: wp('14%'),
    width: 0,
    height: 0,
    borderLeftWidth: wp('2.5%'),
    borderRightWidth: wp('2.5%'),
    borderBottomWidth: wp('2.5%'),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: COLORS.primary,
  },
});
