import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  StatusBar

} from 'react-native';
import { COLORS } from '../constants/theme';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp
} from 'react-native-responsive-screen';
import Header from '../components/commonheader';
import { useGlobalContext } from '../components/globalProvider';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const QRScreen = () => {
  const { generateTransferData } = useGlobalContext();
  const [qrData, setQrData] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const router=useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await generateTransferData();
        setQrData(data);
      } catch (error) {
        console.error('Error generating QR data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
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
      <View style={styles.content}>
        <Text style={styles.title}>Scan QR Code</Text>
        <Text style={styles.subtitle}>
          Share this QR code to quickly transfer data
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
              />
            </View>
          ) : (
            <Text style={styles.errorText}>Failed to generate QR code</Text>
          )}
        </View>
        
        <Text style={styles.helpText}>
          Point your camera at this QR code to begin the transfer process
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: wp('5%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: COLORS.whiteBg,
    marginBottom: hp('1%'),
  },
  subtitle: {
    fontSize: wp('4%'),
    color: COLORS.whiteBg,
    marginBottom: hp('4%'),
    textAlign: 'center',
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
    borderRadius: wp('8%'),
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  errorText: {
    color: 'red',
    fontSize: wp('4%'),
    textAlign: 'center',
  },
  helpText: {
    fontSize: wp('3.5%'),
    color: COLORS.whiteBg,
    textAlign: 'center',
    marginTop: hp('4%'),
    paddingHorizontal: wp('10%'),
  },
  logo: {
    width: wp('20%'),
    height: wp('8%'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    backgroundColor: COLORS.background,
    gap:wp('27%')
  },
  logo: {
    width: wp('20%'),
    height: wp('8%'),
  },
  menuButton: {
    padding: wp('2%'),
  },
  searchButton: {
    padding: wp('2%'),
  },
});

export default QRScreen;