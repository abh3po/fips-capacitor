import { Fips } from "@formstr/fips-capacitor-plugin";
import type { FipsNodeStatus, FipsDatagramEvent, FipsPeerInfo } from "@formstr/fips-capacitor-plugin";

let running = false;
let listenerHandle: { remove: () => void } | null = null;
let myNpub = "";

function log(message: string, type: "in" | "out" | "system" = "system") {
  const logEl = document.getElementById("log")!;
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  const time = new Date().toLocaleTimeString();
  entry.textContent = `[${time}] ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function logcat(tag: string, message: string) {
  console.log(`FipsE2E:${tag}:${message}`);
}

function updateStatus(status: FipsNodeStatus) {
  document.getElementById("npub")!.textContent = status.npub;
  document.getElementById("address")!.textContent = status.fipsAddress;
  document.getElementById("node-addr")!.textContent = status.nodeAddr;
  document.getElementById("peer-count")!.textContent = String(status.peerCount);
  document.getElementById("session-count")!.textContent = String(status.sessionCount);
  document.getElementById("uptime")!.textContent = `${status.uptimeSecs}s`;

  const badge = document.getElementById("state-badge")!;
  badge.textContent = status.state.toUpperCase();
  badge.className = `badge ${status.state}`;
}

function setRunning(state: boolean) {
  running = state;
  (document.getElementById("btn-start") as HTMLButtonElement).disabled = state;
  (document.getElementById("btn-stop") as HTMLButtonElement).disabled = !state;
}

async function startNode() {
  try {
    log("Starting FIPS node...", "system");
    logcat("STATUS", "starting");
    updateStatus({ state: "starting", npub: "—", nodeAddr: "—", fipsAddress: "—", peerCount: 0, sessionCount: 0, linkCount: 0, transportCount: 0, uptimeSecs: 0, estimatedMeshSize: null, tunName: null });
    setRunning(true);

    const status = await Fips.start({
      leafOnly: false,
      udpPort: 0,
      nostrDiscovery: false,
      lanDiscovery: true,
      logLevel: "debug",
    });

    myNpub = status.npub;
    updateStatus(status);
    log(`Node started: ${status.npub}`, "system");
    log(`FIPS address: ${status.fipsAddress}`, "system");
    logcat("STATUS", "running");
    logcat("NPUB", status.npub);
    logcat("ADDRESS", status.fipsAddress);
    logcat("NODE_ADDR", status.nodeAddr);

    listenerHandle = await Fips.addListener("onDatagram", (event: FipsDatagramEvent) => {
      log(`RECV from ${event.fromNpub.slice(0, 12)}...: ${event.data}`, "in");
      logcat("DATAGRAM_RECV", JSON.stringify({ fromNpub: event.fromNpub, fromNodeAddr: event.fromNodeAddr, data: event.data }));
    });

    await refreshPeers();
  } catch (e: any) {
    log(`Error starting node: ${e.message}`, "system");
    logcat("ERROR", `start:${e.message}`);
    setRunning(false);
  }
}

async function stopNode() {
  try {
    log("Stopping FIPS node...", "system");
    if (listenerHandle) {
      await Fips.removeAllListeners();
      listenerHandle = null;
    }
    await Fips.stop();
    setRunning(false);
    updateStatus({ state: "stopped", npub: "—", nodeAddr: "—", fipsAddress: "—", peerCount: 0, sessionCount: 0, linkCount: 0, transportCount: 0, uptimeSecs: 0, estimatedMeshSize: null, tunName: null });
    log("Node stopped", "system");
    logcat("STATUS", "stopped");
  } catch (e: any) {
    log(`Error stopping node: ${e.message}`, "system");
    logcat("ERROR", `stop:${e.message}`);
  }
}

async function sendDatagram(toNpub?: string, payload?: string) {
  const npub = toNpub || (document.getElementById("send-npub") as HTMLInputElement).value.trim();
  const data = payload || (document.getElementById("send-payload") as HTMLTextAreaElement).value.trim();
  if (!npub || !data) {
    log("Missing npub or payload", "system");
    logcat("ERROR", "send:missing_params");
    return;
  }
  try {
    const encoded = btoa(data);
    await Fips.sendDatagram({ toNpub: npub, data: encoded });
    log(`SENT to ${npub.slice(0, 12)}...: ${data}`, "out");
    logcat("DATAGRAM_SENT", JSON.stringify({ toNpub: npub, data: encoded }));
  } catch (e: any) {
    log(`Error sending: ${e.message}`, "system");
    logcat("ERROR", `send:${e.message}`);
  }
}

async function addPeer(npub?: string, addr?: string) {
  const peerNpub = npub || (document.getElementById("peer-npub") as HTMLInputElement).value.trim();
  const peerAddr = addr || (document.getElementById("peer-addr") as HTMLInputElement).value.trim();
  if (!peerNpub) {
    log("Missing npub", "system");
    logcat("ERROR", "add_peer:missing_npub");
    return;
  }
  try {
    await Fips.addPeer({ npub: peerNpub, transport: "udp", addr: peerAddr || undefined });
    log(`Peer added: ${peerNpub.slice(0, 12)}...`, "system");
    logcat("PEER_ADDED", peerNpub);
    await refreshPeers();
  } catch (e: any) {
    log(`Error adding peer: ${e.message}`, "system");
    logcat("ERROR", `add_peer:${e.message}`);
  }
}

async function refreshPeers() {
  try {
    const result = await Fips.listPeers();
    const el = document.getElementById("peer-list")!;
    if (result.peers.length === 0) {
      el.textContent = "No peers connected";
    } else {
      el.innerHTML = result.peers
        .map(
          (p: FipsPeerInfo) =>
            `<div style="padding:4px 0;border-bottom:1px solid #21262d;">
              <span style="color:#58a6ff;">${p.npub.slice(0, 12)}...</span>
              ${p.linkEstablished ? '<span class="badge running">connected</span>' : '<span class="badge stopped">pending</span>'}
              ${p.rttMs != null ? ` rtt=${p.rttMs.toFixed(1)}ms` : ""}
              ${p.transport ? ` [${p.transport}]` : ""}
            </div>`
        )
        .join("");
    }
    logcat("PEERS", JSON.stringify(result.peers.map(p => ({ npub: p.npub, established: p.linkEstablished }))));
  } catch (e: any) {
    log(`Error listing peers: ${e.message}`, "system");
    logcat("ERROR", `list_peers:${e.message}`);
  }
}

function clearLog() {
  document.getElementById("log")!.innerHTML = "";
}

(window as any).startNode = startNode;
(window as any).stopNode = stopNode;
(window as any).sendDatagram = sendDatagram;
(window as any).addPeer = addPeer;
(window as any).refreshPeers = refreshPeers;
(window as any).clearLog = clearLog;

log("FIPS E2E Test Harness ready", "system");
logcat("STATUS", "ready");
