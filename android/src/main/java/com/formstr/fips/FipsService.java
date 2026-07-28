package com.formstr.fips;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public class FipsService {

    private final Context context;
    private final FipsBridge bridge;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private DatagramListener datagramListener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private long nodeHandle;

    public interface DatagramListener {
        void onDatagram(FipsDatagram datagram);
    }

    public FipsService(Context context) {
        this.context = context;
        this.bridge = new FipsBridge();
    }

    public void setDatagramListener(DatagramListener listener) {
        this.datagramListener = listener;
    }

    public FipsNodeStatus start(FipsNodeConfig config) {
        if (running.get()) {
            throw new IllegalStateException("FIPS node is already running");
        }

        String configJson = buildConfigJson(config);
        String resultJson = bridge.nativeStart(configJson);
        nodeHandle = bridge.nativeGetHandle();

        running.set(true);
        startDatagramPoller();

        return parseStatus(resultJson);
    }

    public void stop() {
        if (!running.get()) {
            return;
        }
        running.set(false);
        bridge.nativeStop();
        nodeHandle = 0;
    }

    public FipsNodeStatus getStatus() {
        ensureRunning();
        String json = bridge.nativeGetStatus();
        return parseStatus(json);
    }

    public String getNpub() {
        ensureRunning();
        return bridge.nativeGetNpub();
    }

    public String getAddress() {
        ensureRunning();
        return bridge.nativeGetAddress();
    }

    public void sendDatagram(String toNpub, String data) {
        ensureRunning();
        bridge.nativeSendDatagram(toNpub, data);
    }

    public void sendDatagramByAddr(String toNodeAddr, String data) {
        ensureRunning();
        bridge.nativeSendDatagramByAddr(toNodeAddr, data);
    }

    public List<FipsSessionInfo> listSessions() {
        ensureRunning();
        String json = bridge.nativeListSessions();
        return parseSessions(json);
    }

    public List<FipsPeerInfo> listPeers() {
        ensureRunning();
        String json = bridge.nativeListPeers();
        return parsePeers(json);
    }

    public void addPeer(FipsPeerConfig config) {
        ensureRunning();
        bridge.nativeAddPeer(buildPeerJson(config));
    }

    public void removePeer(String npub) {
        ensureRunning();
        bridge.nativeRemovePeer(npub);
    }

    private void ensureRunning() {
        if (!running.get()) {
            throw new IllegalStateException("FIPS node is not running");
        }
    }

    private void startDatagramPoller() {
        Thread poller = new Thread(() -> {
            while (running.get()) {
                try {
                    String datagramJson = bridge.nativePollDatagram(100);
                    if (datagramJson != null && !datagramJson.isEmpty()) {
                        FipsDatagram d = parseDatagram(datagramJson);
                        if (datagramListener != null) {
                            mainHandler.post(() -> datagramListener.onDatagram(d));
                        }
                    }
                } catch (Exception e) {
                    // Log and continue polling
                }
            }
        }, "fips-datagram-poller");
        poller.setDaemon(true);
        poller.start();
    }

    private String buildConfigJson(FipsNodeConfig config) {
        StringBuilder sb = new StringBuilder("{");
        if (config.nsec != null) {
            sb.append("\"nsec\":\"").append(escapeJson(config.nsec)).append("\",");
        }
        sb.append("\"persistent\":").append(config.persistent).append(",");
        sb.append("\"leaf_only\":").append(config.leafOnly).append(",");
        if (config.udpPort > 0) {
            sb.append("\"udp_port\":").append(config.udpPort).append(",");
        }
        if (config.logLevel != null) {
            sb.append("\"log_level\":\"").append(escapeJson(config.logLevel)).append("\",");
        }
        sb.append("\"nostr_discovery\":").append(config.nostrDiscovery).append(",");
        sb.append("\"lan_discovery\":").append(config.lanDiscovery).append(",");

        if (config.nostrRelays != null && config.nostrRelays.length > 0) {
            sb.append("\"nostr_relays\":[");
            for (int i = 0; i < config.nostrRelays.length; i++) {
                if (i > 0) sb.append(",");
                sb.append("\"").append(escapeJson(config.nostrRelays[i])).append("\"");
            }
            sb.append("],");
        }

        if (config.peers != null && config.peers.length > 0) {
            sb.append("\"peers\":[");
            for (int i = 0; i < config.peers.length; i++) {
                if (i > 0) sb.append(",");
                sb.append(buildPeerJson(config.peers[i]));
            }
            sb.append("],");
        }

        if (sb.charAt(sb.length() - 1) == ',') {
            sb.setLength(sb.length() - 1);
        }
        sb.append("}");
        return sb.toString();
    }

    private String buildPeerJson(FipsPeerConfig peer) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"npub\":\"").append(escapeJson(peer.npub)).append("\"");
        if (peer.transport != null) {
            sb.append(",\"transport\":\"").append(escapeJson(peer.transport)).append("\"");
        }
        if (peer.addr != null) {
            sb.append(",\"addr\":\"").append(escapeJson(peer.addr)).append("\"");
        }
        if (peer.connectPolicy != null) {
            sb.append(",\"connect_policy\":\"").append(escapeJson(peer.connectPolicy)).append("\"");
        }
        sb.append("}");
        return sb.toString();
    }

    private String escapeJson(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private native FipsNodeStatus parseStatus(String json);
    private native List<FipsSessionInfo> parseSessions(String json);
    private native List<FipsPeerInfo> parsePeers(String json);
    private native FipsDatagram parseDatagram(String json);
}
