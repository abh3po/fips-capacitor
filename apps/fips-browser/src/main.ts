import { Fips } from "@formstr/fips-capacitor-plugin";
import type { FipsNodeStatus, FipsDatagramEvent, FipsPeerInfo, FipsSessionInfo } from "@formstr/fips-capacitor-plugin";

let running = false;
let listenerHandle: { remove: () => void } | null = null;
let statusInterval: ReturnType<typeof setInterval> | null = null;
let navigationHistory: string[] = [];
let historyIndex = -1;

function updateStatusBar(status: FipsNodeStatus | null) {
  const dot = document.getElementById("status-dot")!;
  const text = document.getElementById("status-text")!;
  if (!status || status.state === "stopped") {
    dot.className = "dot red";
    text.textContent = "Disconnected";
    document.getElementById("status-peers")!.textContent = "0";
    document.getElementById("status-sessions")!.textContent = "0";
    document.getElementById("status-uptime")!.textContent = "—";
  } else if (status.state === "starting") {
    dot.className = "dot yellow";
    text.textContent = "Starting...";
  } else {
    dot.className = "dot green";
    text.textContent = "Connected";
    document.getElementById("status-peers")!.textContent = String(status.peerCount);
    document.getElementById("status-sessions")!.textContent = String(status.sessionCount);
    document.getElementById("status-uptime")!.textContent = `${status.uptimeSecs}s`;
  }
}

function updateDrawer(status: FipsNodeStatus) {
  document.getElementById("d-npub")!.textContent = status.npub;
  document.getElementById("d-address")!.textContent = status.fipsAddress;
  document.getElementById("d-node-addr")!.textContent = status.nodeAddr;
  document.getElementById("d-state")!.textContent = status.state;
  document.getElementById("d-peers")!.textContent = String(status.peerCount);
  document.getElementById("d-sessions")!.textContent = String(status.sessionCount);
  document.getElementById("d-links")!.textContent = String(status.linkCount);
  document.getElementById("d-transports")!.textContent = String(status.transportCount);
  document.getElementById("d-mesh-size")!.textContent = status.estimatedMeshSize != null ? String(status.estimatedMeshSize) : "—";
  document.getElementById("d-uptime")!.textContent = `${status.uptimeSecs}s`;
}

async function refreshDrawerDetails() {
  try {
    const peers = await Fips.listPeers();
    const peerList = document.getElementById("d-peer-list")!;
    if (peers.peers.length === 0) {
      peerList.innerHTML = '<span style="color:#8b949e;">No peers</span>';
    } else {
      peerList.innerHTML = peers.peers
        .map(
          (p: FipsPeerInfo) =>
            `<div class="drawer-peer">
              <div class="npub">${p.npub.slice(0, 16)}...</div>
              <div class="meta">
                ${p.linkEstablished ? "connected" : "pending"}
                ${p.rttMs != null ? ` · ${p.rttMs.toFixed(1)}ms RTT` : ""}
                ${p.transport ? ` · ${p.transport}` : ""}
              </div>
            </div>`
        )
        .join("");
    }

    const sessions = await Fips.listSessions();
    const sessionList = document.getElementById("d-session-list")!;
    if (sessions.sessions.length === 0) {
      sessionList.innerHTML = '<span style="color:#8b949e;">No sessions</span>';
    } else {
      sessionList.innerHTML = sessions.sessions
        .map(
          (s: FipsSessionInfo) =>
            `<div class="drawer-session">
              <div class="npub">${s.remoteNpub.slice(0, 16)}...</div>
              <div class="meta">
                ${s.established ? "established" : "pending"}
                ${s.bytesSent > 0 ? ` · ↑${formatBytes(s.bytesSent)}` : ""}
                ${s.bytesRecv > 0 ? ` · ↓${formatBytes(s.bytesRecv)}` : ""}
              </div>
            </div>`
        )
        .join("");
    }
  } catch {}
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function startNode() {
  try {
    updateStatusBar({ state: "starting", npub: "—", nodeAddr: "—", fipsAddress: "—", peerCount: 0, sessionCount: 0, linkCount: 0, transportCount: 0, uptimeSecs: 0, estimatedMeshSize: null, tunName: null });

    const status = await Fips.start({
      leafOnly: false,
      udpPort: 0,
      nostrDiscovery: false,
      lanDiscovery: true,
      logLevel: "info",
    });

    running = true;
    updateStatusBar(status);
    updateDrawer(status);

    listenerHandle = await Fips.addListener("onDatagram", (_event: FipsDatagramEvent) => {
      // Datagrams are handled by the FIPS protocol internally
    });

    statusInterval = setInterval(async () => {
      try {
        const s = await Fips.getStatus();
        updateStatusBar(s);
        updateDrawer(s);
      } catch {}
    }, 3000);

    document.getElementById("content")!.style.display = "none";
    document.getElementById("webview-container")!.classList.add("active");
  } catch (e: any) {
    updateStatusBar(null);
    alert(`Failed to start FIPS node: ${e.message}`);
  }
}

async function stopNode() {
  try {
    if (listenerHandle) {
      await Fips.removeAllListeners();
      listenerHandle = null;
    }
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    await Fips.stop();
    running = false;
    updateStatusBar(null);
    document.getElementById("content")!.style.display = "";
    document.getElementById("webview-container")!.classList.remove("active");
    toggleDrawer(false);
  } catch (e: any) {
    alert(`Failed to stop: ${e.message}`);
  }
}

function navigate() {
  const input = document.getElementById("url-input") as HTMLInputElement;
  const url = input.value.trim();
  if (!url) return;
  navigateTo(url);
}

function navigateTo(url: string) {
  (document.getElementById("url-input") as HTMLInputElement).value = url;

  if (historyIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, historyIndex + 1);
  }
  navigationHistory.push(url);
  historyIndex = navigationHistory.length - 1;

  if (!running) {
    alert("Start the FIPS node first");
    return;
  }

  const iframe = document.getElementById("webview-frame") as HTMLIFrameElement;
  document.getElementById("content")!.style.display = "none";
  document.getElementById("webview-container")!.classList.add("active");

  if (url.endsWith(".fips")) {
    iframe.src = `https://${url}`;
  } else if (url.startsWith("npub1")) {
    iframe.src = `https://${url}.fips`;
  } else {
    iframe.src = `https://${url}`;
  }
}

function goBack() {
  if (historyIndex > 0) {
    historyIndex--;
    const url = navigationHistory[historyIndex];
    (document.getElementById("url-input") as HTMLInputElement).value = url;
    navigateTo(url);
  }
}

function goForward() {
  if (historyIndex < navigationHistory.length - 1) {
    historyIndex++;
    const url = navigationHistory[historyIndex];
    (document.getElementById("url-input") as HTMLInputElement).value = url;
    navigateTo(url);
  }
}

function goReload() {
  const iframe = document.getElementById("webview-frame") as HTMLIFrameElement;
  iframe.src = iframe.src;
}

function toggleDrawer(force?: boolean) {
  const drawer = document.getElementById("drawer")!;
  const overlay = document.getElementById("drawer-overlay")!;
  const isOpen = force !== undefined ? force : !drawer.classList.contains("open");

  if (isOpen) {
    drawer.classList.add("open");
    overlay.classList.add("open");
    if (running) refreshDrawerDetails();
  } else {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
  }
}

(window as any).startNode = startNode;
(window as any).stopNode = stopNode;
(window as any).navigate = navigate;
(window as any).navigateTo = navigateTo;
(window as any).goBack = goBack;
(window as any).goForward = goForward;
(window as any).goReload = goReload;
(window as any).toggleDrawer = toggleDrawer;
