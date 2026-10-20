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
  DeviceEventEmitter,
  Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import QRScannerModel from "../../components/QRCodeScanner";
import SyncDataModal from "../../components/SyncDataModal";
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
  const [isSyncModalVisible, setIsSyncModalVisible] = useState(false);
  const { state, dispatch, changeLanguage, setTheme, importTransferData, showAlert } = useGlobalContext();
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
      showAlert({
        title: t('Error'),
        message: t('Failed to update default currency'),
        type: 'error',
      });
    } finally {
      setLoading(false);
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
      showAlert({
        title: 'Sync Successful',
        message: 'All transactions, budgets, accounts, and categories have been restored and synced successfully!',
        type: 'success',
      });
      setDataImported(true);
    } catch (error) {
      showAlert({
        title: 'Sync Failed',
        message: 'Error importing data: ' + (error?.message || 'Invalid QR code'),
        type: 'error',
      });
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

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('FINFIT_DATA_SYNCED', async () => {
      try {
        await loadExpensesFromDB();
      } catch (e) {
        console.error('Error reloading data on FINFIT_DATA_SYNCED:', e);
      }
    });
    return () => sub.remove();
  }, [loadExpensesFromDB]);

  const isLight = state?.theme === "light";
  const drawerTextColor = isLight ? "#0F172A" : COLORS.text.primary;

  return (
    <>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[
          styles.drawerContent,
          {
            paddingTop: 0,
            backgroundColor: isLight ? "#FFFFFF" : COLORS.background,
          },
        ]}
        style={{ backgroundColor: isLight ? "#FFFFFF" : COLORS.background }}
      >
        <StatusBar
          barStyle={isLight ? "dark-content" : "light-content"}
          backgroundColor={isLight ? "#FFFFFF" : COLORS.background}
          translucent={true}
          hidden={false}
        />
        <View
          style={[
            styles.profileContainer,
            {
              paddingTop: Math.max(insets.top, hp("2%")) + hp("1.5%"),
              backgroundColor: isLight ? "#F8FAFC" : COLORS.background,
              borderBottomColor: isLight ? "#E2E8F0" : COLORS.lightbackground,
            },
          ]}
        >
          <Image
            source={require("../../assets/images/logoFinFitWhite.png")}
            style={[styles.profileImage, { tintColor: isLight ? COLORS.primary : "#FFFFFF" }]}
          />
          <Text style={[styles.userName, { color: drawerTextColor }]}>FinFit</Text>
        </View>
        <View style={[styles.drawerItemsContainer, { backgroundColor: isLight ? "#FFFFFF" : COLORS.background }]}>
          {props.state.routes
            .filter((route) => route.name !== "(tabs)")
            .map((route) => (
              <DrawerItem
                key={route.key}
                label={t(props.descriptors[route.key].options.drawerLabel || route.name)}
                icon={props.descriptors[route.key].options.drawerIcon}
                labelStyle={{
                  color: selectedItem === route.key ? COLORS.secondary : drawerTextColor,
                  fontWeight: selectedItem === route.key ? "bold" : "600",
                  fontSize: wp("3.8%"),
                }}
                onPress={() => {
                  setSelectedItem(route.key);
                  props.navigation?.navigate?.(route.name);
                }}
                style={{
                  backgroundColor:
                    selectedItem === route.key
                      ? COLORS.primary
                      : isLight
                      ? "#F8FAFC"
                      : "transparent",
                  borderRadius: wp("2.5%"),
                  marginHorizontal: wp("2%"),
                }}
              />
            ))}

          {/* 1. Language */}
          <DrawerItem
            label={t('Language')}
            icon={() => <Ionicons name="language" size={wp("5.5%")} color={isLight ? COLORS.primary : "#94A3B8"} />}
            onPress={() => setIsModalVisible(true)}
            labelStyle={{ color: drawerTextColor, fontSize: wp("3.8%"), fontWeight: "600" }}
            style={[styles.drawerItemRow, isLight && styles.drawerItemRowLight]}
          />

          {/* 2. Currency Settings */}
          <DrawerItem
            label={t('CurrencySettings')}
            icon={() => <MaterialIcons name="attach-money" size={wp("5.5%")} color={isLight ? COLORS.primary : "#94A3B8"} />}
            onPress={() => setIsCurrencyModalVisible(true)}
            labelStyle={{ color: drawerTextColor, fontSize: wp("3.8%"), fontWeight: "600" }}
            style={[styles.drawerItemRow, isLight && styles.drawerItemRowLight]}
          />

          {/* 3. Export Data */}
          <DrawerItem
            label={t('Export Data')}
            icon={() => <Ionicons name="exit-outline" size={wp("5.5%")} color={isLight ? COLORS.primary : "#94A3B8"} />}
            onPress={() => setIsExportModalVisible(true)}
            labelStyle={{ color: drawerTextColor, fontSize: wp("3.8%"), fontWeight: "600" }}
            style={[styles.drawerItemRow, isLight && styles.drawerItemRowLight]}
          />

          {/* 4. Sync Data */}
          <DrawerItem
            label={t('Sync Data')}
            icon={() => <MaterialIcons name="sync" size={wp("5.5%")} color={isLight ? COLORS.primary : "#94A3B8"} />}
            onPress={() => setIsSyncModalVisible(true)}
            labelStyle={{ color: drawerTextColor, fontSize: wp("3.8%"), fontWeight: "600" }}
            style={[styles.drawerItemRow, isLight && styles.drawerItemRowLight]}
          />

          {/* 5. Backup */}
          <DrawerItem
            label={t('Backup')}
            icon={() => <MaterialIcons name="backup" size={wp("5.5%")} color={isLight ? COLORS.primary : "#94A3B8"} />}
            onPress={() => router.push('/signup')}
            labelStyle={{ color: drawerTextColor, fontSize: wp("3.8%"), fontWeight: "600" }}
            style={[styles.drawerItemRow, isLight && styles.drawerItemRowLight]}
          />

          {/* 6. Help -> Triggers Interactive User Guide Tour (AppGuideOverlay) */}
          <DrawerItem
            label={t('Help')}
            icon={() => <MaterialIcons name="help-outline" size={wp("5.5%")} color={isLight ? COLORS.primary : "#94A3B8"} />}
            onPress={() => {
              try {
                if (props.navigation && typeof props.navigation.closeDrawer === 'function') {
                  props.navigation.closeDrawer();
                }
              } catch (e) {
                console.warn("Could not close drawer:", e);
              }
              try {
                router.navigate("/(drawer)/(tabs)");
              } catch (e) {
                console.warn("Could not navigate to tabs:", e);
              }
              setTimeout(() => {
                DeviceEventEmitter.emit("TRIGGER_APP_TOUR");
              }, 300);
            }}
            labelStyle={{ color: drawerTextColor, fontSize: wp("3.8%"), fontWeight: "600" }}
            style={[styles.drawerItemRow, isLight && styles.drawerItemRowLight]}
          />

          {/* 7. Theme Toggle with Switch */}
          <TouchableOpacity
            style={[
              styles.drawerItemRow,
              isLight && styles.drawerItemRowLight,
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: hp('1%'),
                paddingHorizontal: wp('4%'),
                marginHorizontal: wp('2%'),
                marginVertical: hp('0.4%'),
                borderRadius: wp('2.5%'),
                backgroundColor: isLight ? "#F8FAFC" : "transparent",
              }
            ]}
            activeOpacity={0.7}
            onPress={async () => {
              const nextTheme = isLight ? "dark" : "light";
              if (setTheme) {
                await setTheme(nextTheme);
              }
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp('4%') }}>
              <Ionicons
                name={isLight ? "sunny" : "moon"}
                size={wp("5.5%")}
                color={isLight ? "#F59E0B" : COLORS.primary}
              />
              <Text style={{
                color: drawerTextColor,
                fontSize: wp("3.8%"),
                fontWeight: "600"
              }}>
                {isLight ? (t("Light Mode") || "Light Mode") : (t("Dark Mode") || "Dark Mode")}
              </Text>
            </View>
            <Switch
              value={!isLight}
              onValueChange={async (val) => {
                const nextTheme = val ? "dark" : "light";
                if (setTheme) {
                  await setTheme(nextTheme);
                }
              }}
              trackColor={{ false: "#CBD5E1", true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </DrawerContentScrollView>

      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isLight && { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" }]}>
            <Text style={[styles.modalTitle, isLight && { color: "#0F172A" }]}>{t('selectLanguage')}</Text>
            {[
              { id: "English", label: "English" },
              { id: "Hindi", label: "Hindi (हिंदी)" },
              { id: "Tamil", label: "Tamil (தமிழ்)" },
              { id: "Kannada", label: "Kannada (ಕನ್ನಡ)" },
              { id: "Marathi", label: "Marathi (मराठी)" },
              { id: "Urdu", label: "Urdu (اردو)" },
            ].map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[
                  styles.languageOption,
                  isLight && { backgroundColor: "#F1F5F9" },
                  state.language === id && styles.selectedLanguage
                ]}
                onPress={() => handleLanguageSelect(id)}
              >
                <Text style={[
                  styles.languageText,
                  isLight && { color: "#0F172A" },
                  state.language === id && styles.selectedLanguageText
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.closeButton, isLight && { backgroundColor: "#E2E8F0" }]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, isLight && { color: "#0F172A" }]}>{t('close')}</Text>
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

      <SyncDataModal
        visible={isSyncModalVisible}
        onClose={() => setIsSyncModalVisible(false)}
        onScanQR={() => setIsQRScannerVisible(true)}
      />

      <ExportDataModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
      />
    </>

  );
};

export default function Layout() {
  const { state } = useGlobalContext();
  const isLight = state?.theme === "light";

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: wp("72%"),
          backgroundColor: isLight ? "#FFFFFF" : COLORS.background,
        },
        swipeEnabled: true,
        drawerType: "front",
        overlayColor: "rgba(0,0,0,0.5)",
        hideStatusBar: false,
        statusBarAnimation: "slide",
      }}
      drawerContent={(props) => (
        <CustomDrawerContent {...props} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    paddingTop: 0,
    flexGrow: 1,
  },
  profileContainer: {
    alignItems: "center",
    padding: wp("5%"),
    borderBottomWidth: 1,
  },
  profileImage: {
    width: wp("20%"),
    height: wp("20%"),
    resizeMode: "contain",
    borderRadius: wp("10%"),
    marginBottom: hp("1%"),
    backgroundColor: "transparent",
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
  drawerItemRow: {
    borderRadius: wp("2.5%"),
    marginHorizontal: wp("2%"),
    marginVertical: hp("0.2%"),
  },
  drawerItemRowLight: {
    backgroundColor: "transparent",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  modalContent: {
    backgroundColor: COLORS.lightbackground,
    padding: 22,
    borderRadius: 16,
    width: wp("85%"),
  },
  modalTitle: {
    fontSize: wp("5%"),
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: COLORS.text.primary,
  },
  languageOption: {
    padding: 14,
    borderRadius: 10,
    marginVertical: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  selectedLanguage: {
    backgroundColor: COLORS.primary,
  },
  languageText: {
    fontSize: wp("4%"),
    textAlign: "center",
    color: COLORS.text.primary,
  },
  selectedLanguageText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  closeButton: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 10,
  },
  closeButtonText: {
    color: COLORS.text.primary,
    textAlign: "center",
    fontSize: wp("4%"),
    fontWeight: "600",
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