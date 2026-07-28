import { Capacitor, registerPlugin } from "@capacitor/core";
import type { FipsPlugin } from "./definitions";

const native = registerPlugin<FipsPlugin>("FipsPlugin");

const ANDROID_ONLY = "ANDROID_ONLY";

const ensureAndroid = () => {
  if (Capacitor.getPlatform() !== "android") {
    const err = new Error(
      "fips-capacitor-plugin is Android-only. FIPS requires raw UDP socket access."
    );
    (err as any).code = ANDROID_ONLY;
    throw err;
  }
};

export const Fips = {
  async start(config: Parameters<FipsPlugin["start"]>[0]) {
    ensureAndroid();
    return native.start(config);
  },

  async stop() {
    ensureAndroid();
    return native.stop();
  },

  async getStatus() {
    ensureAndroid();
    return native.getStatus();
  },

  async getNpub() {
    ensureAndroid();
    return native.getNpub();
  },

  async getAddress() {
    ensureAndroid();
    return native.getAddress();
  },

  async sendDatagram(options: Parameters<FipsPlugin["sendDatagram"]>[0]) {
    ensureAndroid();
    if (!options.toNpub || !options.data) {
      throw new Error("MISSING_PARAMS: toNpub, data");
    }
    return native.sendDatagram(options);
  },

  async sendDatagramByAddr(
    options: Parameters<FipsPlugin["sendDatagramByAddr"]>[0]
  ) {
    ensureAndroid();
    if (!options.toNodeAddr || !options.data) {
      throw new Error("MISSING_PARAMS: toNodeAddr, data");
    }
    return native.sendDatagramByAddr(options);
  },

  async listSessions() {
    ensureAndroid();
    return native.listSessions();
  },

  async listPeers() {
    ensureAndroid();
    return native.listPeers();
  },

  async addPeer(config: Parameters<FipsPlugin["addPeer"]>[0]) {
    ensureAndroid();
    if (!config.npub) {
      throw new Error("MISSING_PARAMS: npub");
    }
    return native.addPeer(config);
  },

  async removePeer(options: Parameters<FipsPlugin["removePeer"]>[0]) {
    ensureAndroid();
    if (!options.npub) {
      throw new Error("MISSING_PARAMS: npub");
    }
    return native.removePeer(options);
  },

  async addListener(
    eventName: "onDatagram",
    listenerFunc: Parameters<FipsPlugin["addListener"]>[1]
  ) {
    ensureAndroid();
    return native.addListener(eventName, listenerFunc);
  },

  async removeAllListeners() {
    ensureAndroid();
    return native.removeAllListeners();
  },
};

export type {
  FipsNodeConfig,
  FipsPeerConfig,
  FipsNodeStatus,
  FipsSessionInfo,
  FipsPeerInfo,
  FipsDatagramEvent,
  FipsPlugin,
} from "./definitions";
