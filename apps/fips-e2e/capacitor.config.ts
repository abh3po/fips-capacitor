import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.formstr.fips.e2e",
  appName: "FIPS E2E Test",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    FipsPlugin: {},
  },
};

export default config;
