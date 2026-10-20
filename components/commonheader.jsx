// components/CommonHeader.jsx
import React from 'react';
import { View, TouchableOpacity, SafeAreaView, Image, StatusBar, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { useGlobalContext } from './globalProvider';

export default function Header({ 
  searchIconShown, 
  onSearchPress,
  filterIconShown,
  onFilterPress,
  showFilterBadge = false
}) {
  const navigation = useNavigation();
  const { state } = useGlobalContext();
  const isLight = state?.theme === 'light';
  const headerBg = isLight ? '#FFFFFF' : COLORS.background;
  const headerIconColor = isLight ? '#0F172A' : COLORS.text.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBg }]}>
      <StatusBar
        translucent={false}
        backgroundColor={headerBg}
        barStyle={isLight ? "dark-content" : "light-content"}
      />
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomWidth: isLight ? 1 : 0, borderBottomColor: '#E2E8F0' }]}>
        {/* Left side: Menu button */}
        <TouchableOpacity 
          style={styles.menuButton} 
          onPress={() => {
            try {
              if (navigation && typeof navigation.openDrawer === 'function') {
                navigation.openDrawer();
              }
            } catch (err) {
              console.warn('Error opening drawer:', err);
            }
          }}
        >
          <Ionicons name="menu" size={wp('6%')} color={headerIconColor} />
        </TouchableOpacity>

        {/* Center: Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo.png')}
            style={[styles.logo, isLight && { tintColor: COLORS.primary }]}
            resizeMode="contain"
          />
        </View>

        {/* Right side: Search and Filter icons */}
        <View style={styles.rightButtons}>
          {searchIconShown ? (
            <TouchableOpacity
              onPress={onSearchPress}
              style={styles.iconButton}
            >
              <Ionicons name="search" size={wp('6%')} color={headerIconColor} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}

          {filterIconShown ? (
            <TouchableOpacity
              onPress={onFilterPress}
              style={styles.iconButton}
            >
              <Ionicons name="funnel-outline" size={wp('6%')} color={headerIconColor} />
              {showFilterBadge && (
                <View style={styles.filterBadge} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp('4%'),
    backgroundColor: COLORS.background,
  },
  menuButton: {
    width: wp('20%'),
    alignItems: 'flex-start',
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: -1,
  },
  logo: {
    width: wp('20%'),
    height: wp('8%'),
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    width: wp('20%'),
    justifyContent: 'flex-end',
  },
  iconButton: {
    width: wp('10%'),
    alignItems: 'center',
    position: 'relative',
  },
  iconButtonPlaceholder: {
    width: wp('10%'),
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: wp('2%'),
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});