package com.formstr.fips;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.List;

@CapacitorPlugin(
    name = "FipsPlugin",
    permissions = {
        @Permission(strings = { Manifest.permission.INTERNET }, alias = "internet"),
        @Permission(strings = { Manifest.permission.FOREGROUND_SERVICE }, alias = "foregroundService"),
        @Permission(strings = { Manifest.permission.FOREGROUND_SERVICE_SPECIAL_USE }, alias = "foregroundServiceSpecialUse"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class FipsPlugin extends Plugin {

    private FipsService fipsService;

    @Override
    public void load() {
        Context context = getContext();
        fipsService = new FipsService(context);
        fipsService.setDatagramListener(datagram -> {
            JSObject event = new JSObject();
            event.put("fromNpub", datagram.fromNpub);
            event.put("fromNodeAddr", datagram.fromNodeAddr);
            event.put("data", datagram.data);
            notifyListeners("onDatagram", event);
        });
    }

    @PluginMethod
    public void start(PluginCall call) {
        try {
            JSONObject config = call.getData();

            FipsNodeConfig nodeConfig = new FipsNodeConfig();
            if (config.has("nsec")) nodeConfig.nsec = config.getString("nsec");
            if (config.has("persistent")) nodeConfig.persistent = config.getBoolean("persistent");
            if (config.has("leafOnly")) nodeConfig.leafOnly = config.getBoolean("leafOnly");
            if (config.has("udpPort")) nodeConfig.udpPort = config.getInt("udpPort");
            if (config.has("logLevel")) nodeConfig.logLevel = config.getString("logLevel");
            if (config.has("nostrDiscovery")) nodeConfig.nostrDiscovery = config.getBoolean("nostrDiscovery");
            if (config.has("lanDiscovery")) nodeConfig.lanDiscovery = config.getBoolean("lanDiscovery");

            if (config.has("nostrRelays")) {
                JSONArray relays = config.getJSONArray("nostrRelays");
                nodeConfig.nostrRelays = new String[relays.length()];
                for (int i = 0; i < relays.length(); i++) {
                    nodeConfig.nostrRelays[i] = relays.getString(i);
                }
            }

            if (config.has("peers")) {
                JSONArray peers = config.getJSONArray("peers");
                nodeConfig.peers = new FipsPeerConfig[peers.length()];
                for (int i = 0; i < peers.length(); i++) {
                    JSONObject peer = peers.getJSONObject(i);
                    FipsPeerConfig pc = new FipsPeerConfig();
                    pc.npub = peer.getString("npub");
                    if (peer.has("transport")) pc.transport = peer.getString("transport");
                    if (peer.has("addr")) pc.addr = peer.getString("addr");
                    if (peer.has("connectPolicy")) pc.connectPolicy = peer.getString("connectPolicy");
                    nodeConfig.peers[i] = pc;
                }
            }

            FipsNodeStatus status = fipsService.start(nodeConfig);

            JSObject result = new JSObject();
            result.put("state", status.state);
            result.put("npub", status.npub);
            result.put("nodeAddr", status.nodeAddr);
            result.put("fipsAddress", status.fipsAddress);
            result.put("peerCount", status.peerCount);
            result.put("sessionCount", status.sessionCount);
            result.put("linkCount", status.linkCount);
            result.put("transportCount", status.transportCount);
            result.put("uptimeSecs", status.uptimeSecs);
            result.put("estimatedMeshSize", status.estimatedMeshSize);
            result.put("tunName", status.tunName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start FIPS node: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            fipsService.stop();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop FIPS node: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            FipsNodeStatus status = fipsService.getStatus();
            JSObject result = new JSObject();
            result.put("state", status.state);
            result.put("npub", status.npub);
            result.put("nodeAddr", status.nodeAddr);
            result.put("fipsAddress", status.fipsAddress);
            result.put("peerCount", status.peerCount);
            result.put("sessionCount", status.sessionCount);
            result.put("linkCount", status.linkCount);
            result.put("transportCount", status.transportCount);
            result.put("uptimeSecs", status.uptimeSecs);
            result.put("estimatedMeshSize", status.estimatedMeshSize);
            result.put("tunName", status.tunName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get status: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getNpub(PluginCall call) {
        try {
            String npub = fipsService.getNpub();
            JSObject result = new JSObject();
            result.put("npub", npub);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get npub: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getAddress(PluginCall call) {
        try {
            String address = fipsService.getAddress();
            JSObject result = new JSObject();
            result.put("address", address);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get address: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void sendDatagram(PluginCall call) {
        try {
            String toNpub = call.getString("toNpub");
            String data = call.getString("data");
            if (toNpub == null || data == null) {
                call.reject("MISSING_PARAMS: toNpub, data");
                return;
            }
            fipsService.sendDatagram(toNpub, data);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to send datagram: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void sendDatagramByAddr(PluginCall call) {
        try {
            String toNodeAddr = call.getString("toNodeAddr");
            String data = call.getString("data");
            if (toNodeAddr == null || data == null) {
                call.reject("MISSING_PARAMS: toNodeAddr, data");
                return;
            }
            fipsService.sendDatagramByAddr(toNodeAddr, data);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to send datagram: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void listSessions(PluginCall call) {
        try {
            List<FipsSessionInfo> sessions = fipsService.listSessions();
            JSONArray arr = new JSONArray();
            for (FipsSessionInfo s : sessions) {
                JSONObject obj = new JSONObject();
                obj.put("remoteNpub", s.remoteNpub);
                obj.put("remoteNodeAddr", s.remoteNodeAddr);
                obj.put("established", s.established);
                obj.put("packetsSent", s.packetsSent);
                obj.put("packetsRecv", s.packetsRecv);
                obj.put("bytesSent", s.bytesSent);
                obj.put("bytesRecv", s.bytesRecv);
                arr.put(obj);
            }
            JSObject result = new JSObject();
            result.put("sessions", arr);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to list sessions: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void listPeers(PluginCall call) {
        try {
            List<FipsPeerInfo> peers = fipsService.listPeers();
            JSONArray arr = new JSONArray();
            for (FipsPeerInfo p : peers) {
                JSONObject obj = new JSONObject();
                obj.put("npub", p.npub);
                obj.put("nodeAddr", p.nodeAddr);
                obj.put("transport", p.transport);
                obj.put("linkEstablished", p.linkEstablished);
                obj.put("rttMs", p.rttMs);
                obj.put("lossPercent", p.lossPercent);
                obj.put("jitterMs", p.jitterMs);
                obj.put("bytesSent", p.bytesSent);
                obj.put("bytesRecv", p.bytesRecv);
                arr.put(obj);
            }
            JSObject result = new JSObject();
            result.put("peers", arr);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to list peers: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void addPeer(PluginCall call) {
        try {
            JSONObject peer = call.getData();
            FipsPeerConfig pc = new FipsPeerConfig();
            pc.npub = peer.getString("npub");
            if (peer.has("transport")) pc.transport = peer.getString("transport");
            if (peer.has("addr")) pc.addr = peer.getString("addr");
            if (peer.has("connectPolicy")) pc.connectPolicy = peer.getString("connectPolicy");
            fipsService.addPeer(pc);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to add peer: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void removePeer(PluginCall call) {
        try {
            String npub = call.getString("npub");
            if (npub == null) {
                call.reject("MISSING_PARAMS: npub");
                return;
            }
            fipsService.removePeer(npub);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to remove peer: " + e.getMessage(), e);
        }
    }
}
