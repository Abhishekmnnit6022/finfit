import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

export const UPI_APPS = [
  {
    id: 'gpay',
    name: 'Google Pay',
    package: 'com.google.android.apps.nbu.paisa.user',
    uriSchema: 'gpay://',
    iosBundleId: 'com.google.GooglePay'
  },
  {
    id: 'paytm',
    name: 'Paytm',
    package: 'net.one97.paytm',
    uriSchema: 'paytm://',
    iosBundleId: 'net.one97.paytm'
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    package: 'com.phonepe.app',
    uriSchema: 'phonepe://',
    iosBundleId: 'com.phonepe.PhonePe'
  },
  {
    id: 'bhim',
    name: 'BHIM',
    package: 'in.org.npci.upiapp',
    uriSchema: 'bhim://',
    iosBundleId: 'in.org.npci.upiapp'
  }
];

export const PaymentService = {
  createUPILink: (amount, note, merchantUPI) => {
    const transactionNote = note || 'Payment';
    // Remove any commas from amount and ensure it's a valid number
    const cleanAmount = amount.toString().replace(/,/g, '');
    
    if (Platform.OS === 'ios') {
      // iOS requires a different format for UPI URLs
      const baseURL = `upi://pay`;
      const params = new URLSearchParams({
        pa: merchantUPI,
        pn: 'Merchant',
        tn: transactionNote,
        am: cleanAmount,
        cu: 'INR',
        mode: '04' // UPI payment mode
      });
      return `${baseURL}?${params.toString()}`;
    } else {
      // Android format
      const baseURL = 'upi://pay';
      const params = new URLSearchParams({
        pa: merchantUPI,
        pn: 'Merchant',
        tn: transactionNote,
        am: cleanAmount,
        cu: 'INR'
      });
      return `${baseURL}?${params.toString()}`;
    }
  },

  handleUPIPayment: async (app, amount, note, merchantUPI) => {
    try {
      const upiUrl = 'upi://pay';
      
      if (Platform.OS === 'android') {
        const activity = {
          package: app?.package,
          data: upiUrl,
          flags: (IntentLauncher.FLAG_ACTIVITY_NEW_TASK || 0x10000000)
        };
        
        return await IntentLauncher.startActivityAsync(
          'android.intent.action.VIEW', 
          activity
        );
      } else {
        try {
          const appSpecificUrl = `${app?.uriSchema || 'upi'}://`;
          const canOpenApp = await Linking.canOpenURL(appSpecificUrl);
          
          if (canOpenApp) {
            await Linking.openURL(appSpecificUrl);
            return true;
          }
          
          await Linking.openURL(upiUrl);
          return true;
        } catch (error) {
          console.warn('iOS linking fallback:', error?.message);
          await Linking.openURL(upiUrl);
          return true;
        }
      }
    } catch (error) {
      console.warn('Payment launch notice:', error?.message);
      return false;
    }
  },

  isAppInstalled: async (app) => {
    try {
      if (Platform.OS === 'android') {
        try {
          // Use IntentLauncher to check if the package exists for Android
          const result = await IntentLauncher.getApplicationInfo(app.package);
          return !!result;
        } catch {
          return false;
        }
      } else {
        // For iOS, check if the app's URL scheme can be opened
        const testUrl = `${app.uriSchema}://`;
        const canOpen = await Linking.canOpenURL(testUrl);
        return canOpen;
      }
    } catch (error) {
      console.error('Error checking app installation:', error);
      return false;
    }
  },

  checkInstalledApps: async () => {
    const installedApps = [];
    for (const app of UPI_APPS) {
      const isInstalled = await PaymentService.isAppInstalled(app);
      if (isInstalled) {
        installedApps.push(app);
      }
    }
    return installedApps;
  }
};

