export interface FipsNodeConfig {
  /** bech32 nsec or hex secret key. If omitted, a random identity is generated. */
  nsec?: string;
  /** Whether to persist the identity across restarts. */
  persistent?: boolean;
  /** Run as a leaf-only node (no tree/bloom participation). */
  leafOnly?: boolean;
  /** UDP bind port. Default: 0 (OS-assigned). */
  udpPort?: number;
  /** Peers to auto-connect to on start. */
  peers?: FipsPeerConfig[];
  /** Nostr relays for discovery. */
  nostrRelays?: string[];
  /** Enable Nostr-based peer discovery. */
  nostrDiscovery?: boolean;
  /** Enable mDNS LAN discovery. */
  lanDiscovery?: boolean;
  /** Log level: "trace", "debug", "info", "warn", "error". Default: "info". */
  logLevel?: string;
}

export interface FipsPeerConfig {
  /** bech32 npub or hex public key. */
  npub: string;
  /** Transport type: "udp", "tcp", "tor". */
  transport?: string;
  /** Address string (e.g. "host:port"). */
  addr?: string;
  /** Connect policy: "auto" (default), "on_demand", "manual". */
  connectPolicy?: "auto" | "on_demand" | "manual";
}

export interface FipsNodeStatus {
  state: "created" | "starting" | "running" | "stopping" | "stopped";
  npub: string;
  nodeAddr: string;
  fipsAddress: string;
  peerCount: number;
  sessionCount: number;
  linkCount: number;
  transportCount: number;
  uptimeSecs: number;
  estimatedMeshSize: number | null;
  tunName: string | null;
}

export interface FipsSessionInfo {
  remoteNpub: string;
  remoteNodeAddr: string;
  established: boolean;
  packetsSent: number;
  packetsRecv: number;
  bytesSent: number;
  bytesRecv: number;
}

export interface FipsPeerInfo {
  npub: string;
  nodeAddr: string;
  transport: string;
  linkEstablished: boolean;
  rttMs: number | null;
  lossPercent: number | null;
  jitterMs: number | null;
  bytesSent: number;
  bytesRecv: number;
}

export interface FipsDatagramEvent {
  /** Source npub of the datagram. */
  fromNpub: string;
  /** Source node address. */
  fromNodeAddr: string;
  /** Raw datagram payload bytes (base64-encoded). */
  data: string;
}

export interface FipsPlugin {
  /** Start the FIPS node with the given configuration. */
  start(config: FipsNodeConfig): Promise<FipsNodeStatus>;
  /** Stop the FIPS node. */
  stop(): Promise<void>;
  /** Get the current node status. */
  getStatus(): Promise<FipsNodeStatus>;
  /** Get the node's npub. */
  getNpub(): Promise<{ npub: string }>;
  /** Get the node's FIPS IPv6 address. */
  getAddress(): Promise<{ address: string }>;
  /** Send a datagram to a remote peer by npub. */
  sendDatagram(options: { toNpub: string; data: string }): Promise<void>;
  /** Send a datagram to a remote peer by node address. */
  sendDatagramByAddr(options: { toNodeAddr: string; data: string }): Promise<void>;
  /** List active sessions. */
  listSessions(): Promise<{ sessions: FipsSessionInfo[] }>;
  /** List connected peers. */
  listPeers(): Promise<{ peers: FipsPeerInfo[] }>;
  /** Add a peer to connect to. */
  addPeer(config: FipsPeerConfig): Promise<void>;
  /** Remove a peer by npub. */
  removePeer(options: { npub: string }): Promise<void>;
  /** Add a listener for incoming datagrams. */
  addListener(eventName: "onDatagram", listenerFunc: (event: FipsDatagramEvent) => void): Promise<{ remove: () => void }>;
  /** Remove all listeners for an event. */
  removeAllListeners(): Promise<void>;
}
