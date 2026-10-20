import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { Camera } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";

const QRScannerModal = ({ visible, onClose, onScanSuccess }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  React.useEffect(() => {
    (async () => {
      if (visible) {
        // Reset the scanned lock each time the scanner is opened so it can be
        // reused for multiple scans (e.g. repeated UPI payments).
        setScanned(false);
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      }
    })();
  }, [visible]);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);
    try {
      await onScanSuccess(data);
      onClose();
    } catch (error) {
      alert('Error importing data: ' + error.message);
    }
  };

  if (!visible) return null;

  if (hasPermission === null) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.permissionText}>No access to camera</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
          <MaterialIcons name="close" size={wp('8%')} color="#fff" />
        </TouchableOpacity>
        
        <BarCodeScanner
          style={[StyleSheet.absoluteFill, styles.camera]}
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
            <Text style={styles.instructions}>
              Position the QR code within the frame to scan
            </Text>
          </View>
        </BarCodeScanner>
        
        {scanned && (
          <TouchableOpacity 
            style={styles.rescanButton} 
            onPress={() => setScanned(false)}
          >
            <Text style={styles.rescanButtonText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: wp('70%'),
    height: wp('70%'),
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    borderRadius: wp('4%'),
  },
  instructions: {
    color: '#fff',
    fontSize: wp('4%'),
    marginTop: hp('2%'),
    textAlign: 'center',
    paddingHorizontal: wp('10%'),
  },
  closeIcon: {
    position: 'absolute',
    top: hp('5%'),
    right: wp('5%'),
    zIndex: 1,
    padding: wp('2%'),
  },
  rescanButton: {
    position: 'absolute',
    bottom: hp('5%'),
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('8%'),
    borderRadius: wp('2%'),
  },
  rescanButtonText: {
    color: '#fff',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  permissionText: {
    color: '#fff',
    fontSize: wp('4%'),
    marginBottom: hp('2%'),
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('8%'),
    borderRadius: wp('2%'),
  },
  closeButtonText: {
    color: '#fff',
    fontSize: wp('4%'),
  },
});

export default QRScannerModal;