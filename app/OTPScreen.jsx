import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { generateOTP, sendOTPViaSMS } from '../utils/otp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/theme';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';

const OTPScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOTP] = useState('');
  const [sentOTP, setSentOTP] = useState('');
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSendOTP = async () => {
    setIsLoading(true);
    const generatedOTP = generateOTP();
    setSentOTP(generatedOTP);
    const isSent = await sendOTPViaSMS(phoneNumber, generatedOTP);
    setIsOTPSent(isSent);
    setIsLoading(false);
    if (!isSent) {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOTP = async () => {
    const isVerified = otp === sentOTP;
    setIsOTPVerified(isVerified);
    if (isVerified) {
      try {
        await AsyncStorage.setItem('phoneNumber', phoneNumber);
        router.replace('/(drawer)');
      } catch (error) {
        console.error('Error saving phone number:', error);
      }
    } else {
      Alert.alert('Invalid OTP', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.container}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Image source={require('../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.title}>OTP Login</Text>
          {!isOTPSent ? (
            <View>
              <TextInput
                style={[styles.input, { marginTop: hp(3), color: COLORS.text.primary }]}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.text.secondary}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.button} onPress={handleSendOTP} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TextInput
                style={[styles.input, { marginTop: hp(3), color: COLORS.text.primary }]}
                placeholder="Enter OTP"
                placeholderTextColor={COLORS.text.secondary}
                value={otp}
                onChangeText={setOTP}
                keyboardType="number-pad"
              />
              <TouchableOpacity style={styles.button} onPress={handleVerifyOTP}>
                <Text style={styles.buttonText}>Verify OTP</Text>
              </TouchableOpacity>
            </View>
          )}
          {isOTPVerified && (
            <Text style={styles.message}>OTP verified! You can now access the app.</Text>
          )}
        </Animated.View>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  logo: {
    width: wp('72%'),
    height: wp('30%'),
    resizeMode: 'contain',
    marginBottom: hp('3%'),
  },
  title: {
    fontSize: wp('6%'),
    fontWeight: "900",

    color: COLORS.text.primary,
    marginBottom: hp('3%'),
  },
  input: {
    width: wp('80%'),
    height: hp('6%'),
    borderWidth: 1,
    borderColor: COLORS.text.secondary,
    borderRadius: wp('2%'),
    paddingHorizontal: wp('3%'),
    marginVertical: hp('1.5%'),
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('5%'),
    borderRadius: wp('2%'),
    alignItems: 'center',
    marginTop: hp('2%'),
  },
  buttonText: {
    color: '#fff',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  message: {
    fontSize: wp('4%'),
    color: COLORS.accent,
    marginTop: hp('3%'),
  },
});

export default OTPScreen;