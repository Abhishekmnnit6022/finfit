import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../constants/theme';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp
} from 'react-native-responsive-screen';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../../../components/globalProvider';

export default function TabLayout() {

  const { state, dispatch, changeLanguage } = useGlobalContext();
  const { t ,i18n} = useTranslation();

  const handleLanguageSelect = (language) => {
    console.log("Current language in state:", state.language);
    changeLanguage(language);
    setIsModalVisible(false); 
    console.log("Language changed to", language);
};

useEffect(() => {
    
  if (state.language && i18n.language !== state.language) {
    i18n.changeLanguage(state.language);
  }
  else{
    i18n.changeLanguage(state.language);
  }
}, [state.language]);


  const isLight = state?.theme === 'light';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isLight ? '#FFFFFF' : COLORS.background }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.secondary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isLight ? '#FFFFFF' : COLORS.background,
          borderTopColor: isLight ? '#E2E8F0' : COLORS.lightbackground,
          borderTopWidth: 1,
          paddingBottom: hp('1%'),
          height: hp('7.5%')
        },
        tabBarLabelStyle: {
          fontSize: wp('3%'),
          marginTop: 0,
          paddingBottom: hp('0.5%')
        },
        tabBarInactiveTintColor: isLight ? '#64748B' : COLORS.text.secondary,
        safeAreaInsets: { bottom: true },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('Records'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="list" size={wp('6%')} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: t('Analysis'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="pie-chart" size={wp('6%')} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: t('Budgets'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="wallet" size={wp('6%')} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: t('Accounts'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="card" size={wp('6%')} color={color} />
          ),
        }}
      />
       {/* <Tabs.Screen
        name="qrCode"
        options={{
          title: t('Qr Code'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="wallet" size={wp('6%')} color={color} />
          ),
        }}
      /> */}
      
    </Tabs>
    </SafeAreaView>
  );
}