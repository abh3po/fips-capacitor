import { Capacitor, __getMockPlugin, __resetMockPlugin, __setPlatform } from "./__mocks__/@capacitor/core";

jest.mock("@capacitor/core", () => {
  const actual = jest.requireActual("./__mocks__/@capacitor/core");
  return actual;
});

import { Fips } from "../index";
import type { FipsNodeConfig, FipsNodeStatus, FipsPeerConfig } from "../definitions";

beforeEach(() => {
  __resetMockPlugin();
  __setPlatform("android");
});

describe("Fips", () => {
  const mockStatus: FipsNodeStatus = {
    state: "running",
    npub: "npub1test0000000000000000000000000000000000000000000000000000",
    nodeAddr: "abcdef1234567890abcdef1234567890",
    fipsAddress: "fd00::1",
    peerCount: 3,
    sessionCount: 2,
    linkCount: 4,
    transportCount: 1,
    uptimeSecs: 120,
    estimatedMeshSize: 42,
    tunName: "fips0",
  };

  describe("start", () => {
    it("calls native start with config and returns status", async () => {
      const mock = __getMockPlugin();
      mock.start.mockResolvedValue(mockStatus);

      const config: FipsNodeConfig = {
        leafOnly: false,
        udpPort: 51820,
        logLevel: "debug",
      };

      const result = await Fips.start(config);
      expect(mock.start).toHaveBeenCalledWith(config);
      expect(result).toEqual(mockStatus);
    });

    it("throws on non-Android platform", async () => {
      __setPlatform("web");
      await expect(Fips.start({})).rejects.toThrow("Android-only");
    });
  });

  describe("stop", () => {
    it("calls native stop", async () => {
      const mock = __getMockPlugin();
      mock.stop.mockResolvedValue(undefined);

      await Fips.stop();
      expect(mock.stop).toHaveBeenCalled();
    });

    it("throws on non-Android platform", async () => {
      __setPlatform("ios");
      await expect(Fips.stop()).rejects.toThrow("Android-only");
    });
  });

  describe("getStatus", () => {
    it("returns node status", async () => {
      const mock = __getMockPlugin();
      mock.getStatus.mockResolvedValue(mockStatus);

      const result = await Fips.getStatus();
      expect(result).toEqual(mockStatus);
    });
  });

  describe("getNpub", () => {
    it("returns npub", async () => {
      const mock = __getMockPlugin();
      mock.getNpub.mockResolvedValue({ npub: mockStatus.npub });

      const result = await Fips.getNpub();
      expect(result).toEqual({ npub: mockStatus.npub });
    });
  });

  describe("getAddress", () => {
    it("returns fips address", async () => {
      const mock = __getMockPlugin();
      mock.getAddress.mockResolvedValue({ address: mockStatus.fipsAddress });

      const result = await Fips.getAddress();
      expect(result).toEqual({ address: mockStatus.fipsAddress });
    });
  });

  describe("sendDatagram", () => {
    it("sends a datagram by npub", async () => {
      const mock = __getMockPlugin();
      mock.sendDatagram.mockResolvedValue(undefined);

      await Fips.sendDatagram({ toNpub: "npub1abc...", data: "aGVsbG8=" });
      expect(mock.sendDatagram).toHaveBeenCalledWith({
        toNpub: "npub1abc...",
        data: "aGVsbG8=",
      });
    });

    it("throws if toNpub is missing", async () => {
      await expect(
        Fips.sendDatagram({ toNpub: "", data: "aGVsbG8=" })
      ).rejects.toThrow("MISSING_PARAMS");
    });

    it("throws if data is missing", async () => {
      await expect(
        Fips.sendDatagram({ toNpub: "npub1abc...", data: "" })
      ).rejects.toThrow("MISSING_PARAMS");
    });
  });

  describe("sendDatagramByAddr", () => {
    it("sends a datagram by node address", async () => {
      const mock = __getMockPlugin();
      mock.sendDatagramByAddr.mockResolvedValue(undefined);

      await Fips.sendDatagramByAddr({
        toNodeAddr: "abcdef1234567890",
        data: "aGVsbG8=",
      });
      expect(mock.sendDatagramByAddr).toHaveBeenCalledWith({
        toNodeAddr: "abcdef1234567890",
        data: "aGVsbG8=",
      });
    });

    it("throws if toNodeAddr is missing", async () => {
      await expect(
        Fips.sendDatagramByAddr({ toNodeAddr: "", data: "aGVsbG8=" })
      ).rejects.toThrow("MISSING_PARAMS");
    });
  });

  describe("listSessions", () => {
    it("returns session list", async () => {
      const mock = __getMockPlugin();
      mock.listSessions.mockResolvedValue({
        sessions: [
          {
            remoteNpub: "npub1abc...",
            remoteNodeAddr: "abcdef12",
            established: true,
            packetsSent: 100,
            packetsRecv: 200,
            bytesSent: 1024,
            bytesRecv: 2048,
          },
        ],
      });

      const result = await Fips.listSessions();
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].established).toBe(true);
    });
  });

  describe("listPeers", () => {
    it("returns peer list", async () => {
      const mock = __getMockPlugin();
      mock.listPeers.mockResolvedValue({
        peers: [
          {
            npub: "npub1peer...",
            nodeAddr: "deadbeef",
            transport: "udp",
            linkEstablished: true,
            rttMs: 12.5,
            lossPercent: 0.1,
            jitterMs: 2.3,
            bytesSent: 5000,
            bytesRecv: 8000,
          },
        ],
      });

      const result = await Fips.listPeers();
      expect(result.peers).toHaveLength(1);
      expect(result.peers[0].rttMs).toBe(12.5);
    });
  });

  describe("addPeer", () => {
    it("adds a peer", async () => {
      const mock = __getMockPlugin();
      mock.addPeer.mockResolvedValue(undefined);

      const peer: FipsPeerConfig = {
        npub: "npub1peer...",
        transport: "udp",
        addr: "10.0.0.1:51820",
        connectPolicy: "auto",
      };

      await Fips.addPeer(peer);
      expect(mock.addPeer).toHaveBeenCalledWith(peer);
    });

    it("throws if npub is missing", async () => {
      await expect(
        Fips.addPeer({ npub: "", transport: "udp" })
      ).rejects.toThrow("MISSING_PARAMS");
    });
  });

  describe("removePeer", () => {
    it("removes a peer by npub", async () => {
      const mock = __getMockPlugin();
      mock.removePeer.mockResolvedValue(undefined);

      await Fips.removePeer({ npub: "npub1peer..." });
      expect(mock.removePeer).toHaveBeenCalledWith({ npub: "npub1peer..." });
    });

    it("throws if npub is missing", async () => {
      await expect(Fips.removePeer({ npub: "" })).rejects.toThrow(
        "MISSING_PARAMS"
      );
    });
  });

  describe("addListener", () => {
    it("registers a datagram listener", async () => {
      const mock = __getMockPlugin();
      const removeHandle = { remove: jest.fn() };
      mock.addListener.mockResolvedValue(removeHandle);

      const listener = jest.fn();
      const result = await Fips.addListener("onDatagram", listener);

      expect(mock.addListener).toHaveBeenCalledWith("onDatagram", listener);
      expect(result).toBe(removeHandle);
    });
  });

  describe("removeAllListeners", () => {
    it("removes all listeners", async () => {
      const mock = __getMockPlugin();
      mock.removeAllListeners.mockResolvedValue(undefined);

      await Fips.removeAllListeners();
      expect(mock.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe("platform guard", () => {
    const platforms = ["web", "ios"] as const;
    for (const platform of platforms) {
      it(`all methods throw on ${platform}`, async () => {
        __setPlatform(platform);
        const errMsg = "Android-only";

        await expect(Fips.start({})).rejects.toThrow(errMsg);
        await expect(Fips.stop()).rejects.toThrow(errMsg);
        await expect(Fips.getStatus()).rejects.toThrow(errMsg);
        await expect(Fips.getNpub()).rejects.toThrow(errMsg);
        await expect(Fips.getAddress()).rejects.toThrow(errMsg);
        await expect(
          Fips.sendDatagram({ toNpub: "x", data: "x" })
        ).rejects.toThrow(errMsg);
        await expect(
          Fips.sendDatagramByAddr({ toNodeAddr: "x", data: "x" })
        ).rejects.toThrow(errMsg);
        await expect(Fips.listSessions()).rejects.toThrow(errMsg);
        await expect(Fips.listPeers()).rejects.toThrow(errMsg);
        await expect(
          Fips.addPeer({ npub: "x" })
        ).rejects.toThrow(errMsg);
        await expect(
          Fips.removePeer({ npub: "x" })
        ).rejects.toThrow(errMsg);
        await expect(
          Fips.addListener("onDatagram", jest.fn())
        ).rejects.toThrow(errMsg);
        await expect(Fips.removeAllListeners()).rejects.toThrow(errMsg);
      });
    }
  });
});
