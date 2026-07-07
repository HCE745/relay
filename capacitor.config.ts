import { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "io.getrelay.app",
  appName: "Relay",
  // webDir is used when there is no server.url — set to Next.js static export output
  webDir: "out",
  server: {
    // Load the live web app in both debug and production so web deployments
    // are immediately reflected in the Android app without a new Play Store build.
    url: "https://app.getrelay.software",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b1f3a",
    },
  },
}

export default config
