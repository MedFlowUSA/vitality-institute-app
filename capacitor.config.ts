import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vitalityinstitute.app",
  appName: "Vitality Institute",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
