# @formstr/fips-capacitor-plugin

Capacitor plugin that runs a **FIPS mesh networking node** on Android, enabling peer-to-peer encrypted communication via Nostr identities.

## Overview

This plugin embeds the full [FIPS](https://fips.network/) protocol (compiled from Rust to a native `.so` via JNI) into a Capacitor Android app. It gives the app:

- A self-generated **Nostr identity** (npub) that doubles as a FIPS network address
- **Raw UDP transport** — no WebSocket, no gateway, no TURN server
- **End-to-end encrypted datagrams** to any other FIPS node
- **Mesh routing** — automatic peer discovery, NAT traversal, multi-hop forwarding

## Installation

```bash
npm install @formstr/fips-capacitor-plugin
npx cap sync android
```

## Usage

```typescript
import { Fips } from '@formstr/fips-capacitor-plugin';

// Start the FIPS node
const status = await Fips.start({
  // nsec: "nsec1...",  // optional, generates random identity if omitted
  leafOnly: false,
  udpPort: 0,           // 0 = OS-assigned
  nostrDiscovery: true,
  nostrRelays: ["wss://relay.damus.io"],
  peers: [
    { npub: "npub1...", transport: "udp", addr: "1.2.3.4:51820" }
  ]
});

console.log(`Node running: ${status.npub} at ${status.fipsAddress}`);

// Listen for incoming datagrams
await Fips.addListener("onDatagram", (event) => {
  console.log(`Datagram from ${event.fromNpub}: ${event.data}`);
});

// Send a datagram
await Fips.sendDatagram({
  toNpub: "npub1...",
  data: btoa("hello world")
});

// Stop the node
await Fips.stop();
```

## API

| Method | Description |
|--------|-------------|
| `start(config)` | Start the FIPS node with configuration |
| `stop()` | Stop the FIPS node |
| `getStatus()` | Get current node status |
| `getNpub()` | Get the node's npub |
| `getAddress()` | Get the node's FIPS IPv6 address |
| `sendDatagram({ toNpub, data })` | Send a base64-encoded datagram to a peer by npub |
| `sendDatagramByAddr({ toNodeAddr, data })` | Send a datagram by node address |
| `listSessions()` | List active end-to-end sessions |
| `listPeers()` | List connected peers |
| `addPeer(config)` | Add a peer to connect to |
| `removePeer({ npub })` | Remove a peer |
| `addListener("onDatagram", fn)` | Listen for incoming datagrams |
| `removeAllListeners()` | Remove all listeners |

## Platform Support

| Platform | Status |
|----------|--------|
| Android | Supported (arm64-v8a, armeabi-v7a, x86_64) |
| iOS | Planned |
| Web | Not supported (requires raw UDP) |

## Building from source

### Prerequisites

- Rust with Android targets: `rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android`
- Android NDK (r26+)
- `cargo-ndk`: `cargo install cargo-ndk`

### Build the native library

```bash
cd rust
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 -o ../android/src/main/jniLibs build --release
```

### Build the TypeScript

```bash
npm install
npm run build
```

## License

MIT
