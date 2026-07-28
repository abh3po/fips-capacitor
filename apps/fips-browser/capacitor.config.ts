import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.formstr.fips.browser",
  appName: "FIPS Browser",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    FipsPlugin: {},
  },
};

export default config;
