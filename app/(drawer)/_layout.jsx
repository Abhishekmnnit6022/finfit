//_layout.jsx
import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Linking,
  StatusBar,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { Drawer } from "expo-router/drawer";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect } from "react";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { currencies, setDefaultCurrency, fetchExchangeRates } from '../../utils/currencyService';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from './../../components/globalProvider';
import { COLORS } from "../../constants/theme";
import ExportDataModal from '../../components/ExportDataModal';
import { set } from "date-fns";
import { backupService } from '../../components/backup';
import QRScannerModel from "../../components/QRCodeScanner"
import { useRouter } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import { ExpoCamera } from 'expo-camera';
import { Alert } from 'react-native';
import CurrencySelector from "../../components/CurrencySettings";

const CustomDrawerContent = (props) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);
  const { state, dispatch, changeLanguage, importTransferData } = useGlobalContext();
  const { t, i18n } = useTranslation();
  const [isQRScannerVisible, setIsQRScannerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataImported, setDataImported] = useState(false);

  const { loadExpensesFromDB } = useGlobalContext();

  const handleCurrencyChange = async (currencyCode) => {
    setLoading(true);
    try {
      await setDefaultCurrency(currencyCode);
      dispatch({ type: 'SET_DEFAULT_CURRENCY', payload: currencyCode });

      const rates = await fetchExchangeRates();
      if (rates) {
        dispatch({
          type: 'UPDATE_EXCHANGE_RATES',
          payload: { rates }
        });
      }


    } catch (error) {
      Alert.alert(
        t('Error'),
        t('Failed to update default currency')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      await backupService.exportToMongoDB();
      alert('Backup completed successfully');
      await loadExpensesFromDB();

    } catch (error) {
      alert('Backup failed: ' + error.message);
    }
  };

  const handleLanguageSelect = (language) => {
    console.log("Current language in state:", state.language);
    changeLanguage(language);
    setIsModalVisible(false);
    console.log("Language changed to", language);
  };

  const handleScanQR = async () => {

    setIsQRScannerVisible(true);

  };
  const handleScanSuccess = async (data) => {
    try {
      await importTransferData(data);
      alert('Data imported successfully!');
      setDataImported(true);
    } catch (error) {
      alert('Error importing data: ' + error.message);
    } finally {
      setIsQRScannerVisible(false);
    }
  };

  useEffect(() => {
    if (state.language && i18n.language !== state.language) {
      i18n.changeLanguage(state.language);
    } else {
      i18n.changeLanguage(state.language);
    }
  }, [state.language]);

  useEffect(() => {
    if (dataImported) {
      const reloadData = async () => {
        try {
          await loadExpensesFromDB();
        } catch (error) {
          console.error('Error reloading data:', error);
        } finally {
          setDataImported(false);
        }
      };

      reloadData();
    }
  }, [dataImported, loadExpensesFromDB]);

  return (
    <>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[styles.drawerContent, { paddingTop: 0 }]}
        style={{ backgroundColor: COLORS.background }}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background}
          translucent={true}
          hidden={false}
        />
        <View style={[styles.profileContainer, { paddingTop: Math.max(insets.top, hp("2%")) + hp("1.5%") }]}>
          <Image
            source={require("../../assets/images/logoFinFit.png")}
            style={styles.profileImage}
          />
          <Text style={styles.userName}>{t('TeamAuxin')}</Text>
        </View>
        <View style={styles.drawerItemsContainer}>
          {props.state.routes
            .filter((route) => route.name !== "(tabs)")
            .map((route) => (
              <DrawerItem
                key={route.key}
                label={t(props.descriptors[route.key].options.drawerLabel || route.name)}
                icon={props.descriptors[route.key].options.drawerIcon}
                labelStyle={{
                  color: selectedItem === route.key ? COLORS.secondary : COLORS.text.primary,
                  fontWeight: selectedItem === route.key ? "bold" : "normal",
                }}
                onPress={() => {
                  setSelectedItem(route.key);
                  props.navigation.navigate(route.name);
                }}
                style={{
                  backgroundColor: selectedItem === route.key ? COLORS.primary : COLORS.lightbackground,
                }}
              />
            ))}

          <DrawerItem
            label={t('Language')}
            icon={() => <Ionicons name="language" size={wp("6%")} color={"#000000"} />}
            onPress={() => setIsModalVisible(true)}
            labelStyle={{ color: COLORS.background }}
          />
          <DrawerItem
            label={t('Scan QR')}
            icon={() => <MaterialIcons name="qr-code-scanner" size={wp("6%")} color={"#000000"} />}
            onPress={handleScanQR}
            labelStyle={{ color: COLORS.background }}
          />
          <DrawerItem
            label={t('Export Data')}
            icon={() => <Ionicons name="exit" size={wp("6%")} color={"#000000"} />}
            onPress={() => setIsExportModalVisible(true)}
            labelStyle={{ color: COLORS.background }}
          />
           <DrawerItem
              label={t('CurrencySettings')}
              icon={() => <MaterialIcons name="money" size={wp("6%")} color="#1f1f1f" />}
              onPress={() => setIsCurrencyModalVisible(true)}
              labelStyle={{ color: COLORS.background }}
            />      
          <DrawerItem
            label={t('Backup')}
            icon={() => <MaterialIcons name="logout" size={wp("6%")} color="#1f1f1f" />}
            onPress={() => router.push('/signup')}
            labelStyle={{ color: COLORS.background }}
          />
          <DrawerItem

            label={t('Help')}
            icon={() => <MaterialIcons name="help-outline" size={wp("6%")} color={"#000000"} />}
            onPress={() => Linking.openURL("https://forms.gle/5iJKWrfCXMsviTiL8")}
            labelStyle={{ color: COLORS.background }}
          />
          <DrawerItem
            label={t('Feedback')}
            icon={() => <MaterialIcons name="feedback" size={wp("6%")} color={"#000000"} />}
            onPress={() => Linking.openURL("https://forms.gle/5iJKWrfCXMsviTiL8")}
            labelStyle={{ color: COLORS.background }}
          />
           
        </View>
      </DrawerContentScrollView>

      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('selectLanguage')}</Text>
            {["English", "Hindi", "Tamil"].map((language) => (
              <TouchableOpacity
                key={language}
                style={[
                  styles.languageOption,
                  state.language === language && styles.selectedLanguage
                ]}
                onPress={() => handleLanguageSelect(language)}
              >
                <Text style={[
                  styles.languageText,
                  state.language === language && styles.selectedLanguageText
                ]}>
                  {language}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CurrencySelector
        visible={isCurrencyModalVisible}
        onClose={() => setIsCurrencyModalVisible(false)}
        onSelectCurrency={handleCurrencyChange}
        currentCurrency={state.defaultCurrency}
        loading={loading}
        t={t}
      />
      <QRScannerModel
        visible={isQRScannerVisible}
        onClose={() => setIsQRScannerVisible(false)}
        onScanSuccess={handleScanSuccess}
      />

      <ExportDataModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
      />
    </>

  );
};

export default function Layout({ navigation }) {
  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: wp("72%"),
          backgroundColor: COLORS.background,
        },
        swipeEnabled: true,
        drawerType: "front",
        overlayColor: "rgba(0,0,0,0.5)",
        hideStatusBar: false,
        statusBarAnimation: "slide",
      }}
      drawerContent={(props) => (
        <CustomDrawerContent {...props} navigation={navigation} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    paddingTop: 0,
    flexGrow: 1,
    backgroundColor: "#f4f4f4",
  },
  profileContainer: {
    alignItems: "center",
    padding: wp("5%"),
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightbackground,
  },
  profileImage: {
    width: wp("20%"),
    height: wp("20%"),
    resizeMode: "contain",
    borderRadius: wp("10%"),
    marginBottom: hp("1%"),
    backgroundColor: "#fff",
  },
  userName: {
    fontSize: wp("5%"),
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  userEmail: {
    fontSize: wp("3.5%"),
    color: COLORS.text.secondary,
    marginTop: hp("0.5%"),
  },
  drawerItemsContainer: {
    flex: 1,
    paddingTop: hp("1%"),
    marginTop: hp("1%"),
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: wp("80%"),
  },
  modalTitle: {
    fontSize: wp("5%"),
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  languageOption: {
    padding: 15,
    borderRadius: 5,
    marginVertical: 5,
    backgroundColor: "#f0f0f0",
  },
  selectedLanguage: {
    backgroundColor: COLORS.primary,
  },
  languageText: {
    fontSize: wp("4%"),
    textAlign: "center",
  },
  selectedLanguageText: {
    color: "white",
  },
  closeButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: COLORS.text.secondary,
    borderRadius: 5,
  },
  closeButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: wp("4%"),
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: wp('2.5%'),
  },
  currencyButton: {
    width: wp('30%'),
    padding: wp('4%'),
    borderRadius: wp('2%'),
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    marginBottom: hp('1.2%'),
  },
  selectedCurrency: {
    backgroundColor: COLORS.primary,
  },
  currencySymbol: {
    fontSize: wp('6%'),
    marginBottom: hp('0.5%'),
  },
  currencyCode: {
    fontSize: wp('4%'),
  },
  selectedText: {
    color: '#fff',
  },
  note: {
    marginTop: hp('2.5%'),
    color: '#666',
    textAlign: 'center',
    fontSize: wp('3.5%'),
  },
});