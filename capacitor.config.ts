import type { CapacitorConfig } from "@capacitor/cli";

// Kartogo Android wrapper. The app itself is server-rendered, so the native
// shell loads the hosted site and adds native push notifications on top.
const config: CapacitorConfig = {
  appId: "app.lovable.kartogo",
  appName: "Kartogo",
  webDir: "dist/client",
  server: {
    // Point the shell at the live Kartogo site. Swap this for your custom
    // domain once kartogo.com is live.
    url: "https://project--d2006ba3-49d0-4e1b-a1e2-4185f124983c.lovable.app",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
