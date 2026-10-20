// components/ThemedAlertModal.jsx
import React, { useRef, useEffect } from 'react';
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

const ThemedAlertModal = ({
  visible,
  title,
  message,
  type = 'info', // 'info' | 'success' | 'error' | 'warning' | 'confirm'
  icon,
  buttons = [{ text: 'OK', style: 'default' }],
  onClose,
  theme = 'dark',
}) => {
  const { t } = useTranslation();
  const isLight = theme === 'light';
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  // Resolve icon and colors by type
  let resolvedIcon = icon;
  let iconColor = COLORS.primary;

  if (!resolvedIcon) {
    switch (type) {
      case 'success':
        resolvedIcon = 'checkmark-circle-outline';
        iconColor = '#10B981';
        break;
      case 'error':
        resolvedIcon = 'alert-circle-outline';
        iconColor = '#EF4444';
        break;
      case 'warning':
        resolvedIcon = 'warning-outline';
        iconColor = '#F59E0B';
        break;
      case 'confirm':
        resolvedIcon = 'help-circle-outline';
        iconColor = COLORS.primary;
        break;
      default:
        resolvedIcon = 'information-circle-outline';
        iconColor = COLORS.primary;
        break;
    }
  }

  const handleButtonPress = (btn) => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onClose?.();
      if (typeof btn.onPress === 'function') {
        btn.onPress();
      }
    });
  };

  const getTranslatedText = (val) => {
    if (!val) return '';
    return t(val) || val;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => handleButtonPress(buttons[0] || {})}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableOpacity
          style={[styles.backdrop, isLight && { backgroundColor: 'rgba(0, 0, 0, 0.45)' }]}
          activeOpacity={1}
          onPress={() => handleButtonPress(buttons[buttons.length - 1] || {})}
        />

        {/* Alert Card */}
        <Animated.View
          style={[
            styles.card,
            isLight && styles.cardLight,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Primary Accent Bar */}
          <View style={[styles.accentBar, { backgroundColor: iconColor }]} />

          {/* Icon Badge */}
          <View style={[styles.iconCircle, { backgroundColor: iconColor + '18' }]}>
            <Ionicons name={resolvedIcon} size={wp('8%')} color={iconColor} />
          </View>

          {/* Title */}
          {Boolean(title) && (
            <Text style={[styles.title, isLight && { color: '#0F172A' }]}>
              {getTranslatedText(title)}
            </Text>
          )}

          {/* Message */}
          {Boolean(message) && (
            <Text style={[styles.message, isLight && { color: '#64748B' }]}>
              {getTranslatedText(message)}
            </Text>
          )}

          {/* Buttons */}
          <View style={[styles.buttonRow, buttons.length > 2 && styles.buttonCol]}>
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isCancel
                      ? (isLight ? styles.cancelButtonLight : styles.cancelButton)
                      : isDestructive
                      ? styles.destructiveButton
                      : styles.primaryButton,
                    buttons.length === 2 && { flex: 1 },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleButtonPress(btn)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel
                        ? (isLight ? styles.cancelButtonTextLight : styles.cancelButtonText)
                        : isDestructive
                        ? styles.destructiveButtonText
                        : styles.primaryButtonText,
                    ]}
                  >
                    {getTranslatedText(btn.text) || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default ThemedAlertModal;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  card: {
    width: wp('86%'),
    backgroundColor: '#181724',
    borderRadius: wp('4.5%'),
    padding: wp('5.5%'),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    elevation: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    overflow: 'hidden',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  iconCircle: {
    width: wp('15%'),
    height: wp('15%'),
    borderRadius: wp('7.5%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
    marginTop: hp('0.5%'),
  },
  title: {
    fontSize: wp('4.6%'),
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: hp('1%'),
  },
  message: {
    fontSize: wp('3.4%'),
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: wp('5.2%'),
    marginBottom: hp('2.5%'),
    paddingHorizontal: wp('2%'),
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: wp('2.5%'),
  },
  buttonCol: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: hp('1.4%'),
    paddingHorizontal: wp('5%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: wp('28%'),
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: wp('3.6%'),
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: wp('3.6%'),
    fontWeight: '600',
  },
  cancelButtonLight: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonTextLight: {
    color: '#334155',
    fontSize: wp('3.6%'),
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  destructiveButtonText: {
    color: '#EF4444',
    fontSize: wp('3.6%'),
    fontWeight: '700',
  },
});
