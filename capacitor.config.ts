import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ruangwarga.vsj',
  appName: 'Ruang Warga VSJ',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Keyboard: {
      resize: "body",
    }
  }
};

export default config;
