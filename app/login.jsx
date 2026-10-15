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
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/theme';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import axios from 'axios';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('http://172.29.49.198:8001/user/login', { username, password });
      setIsLoading(false);
      if (response.status !== 200) {
        throw new Error('Network response was not ok');
      }
      Alert.alert('Login Successful', 'You have successfully logged in!');
      router.replace('/(drawer)');
    } catch (error) {
      setIsLoading(false);
      console.error('There was a problem with the login operation:', error);
      Alert.alert('Login Failed', 'Please try again later.');
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.container}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Image source={require('../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.title}>Login</Text>
          <TextInput
            style={[styles.input, { marginTop: hp(3), color: COLORS.text.primary }]}
            placeholder="Enter username"
            placeholderTextColor={COLORS.text.secondary}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={[styles.input, { marginTop: hp(2), color: COLORS.text.primary }]}
            placeholder="Enter password"
            placeholderTextColor={COLORS.text.secondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
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
    fontWeight: '900',
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
});

export default Login;
