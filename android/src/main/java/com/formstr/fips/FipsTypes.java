package com.formstr.fips;

public class FipsNodeConfig {
    public String nsec;
    public boolean persistent;
    public boolean leafOnly;
    public int udpPort;
    public String logLevel;
    public boolean nostrDiscovery;
    public boolean lanDiscovery;
    public String[] nostrRelays;
    public FipsPeerConfig[] peers;
}

class FipsPeerConfig {
    public String npub;
    public String transport;
    public String addr;
    public String connectPolicy;
}

class FipsNodeStatus {
    public String state;
    public String npub;
    public String nodeAddr;
    public String fipsAddress;
    public int peerCount;
    public int sessionCount;
    public int linkCount;
    public int transportCount;
    public long uptimeSecs;
    public Long estimatedMeshSize;
    public String tunName;
}

class FipsSessionInfo {
    public String remoteNpub;
    public String remoteNodeAddr;
    public boolean established;
    public long packetsSent;
    public long packetsRecv;
    public long bytesSent;
    public long bytesRecv;
}

class FipsPeerInfo {
    public String npub;
    public String nodeAddr;
    public String transport;
    public boolean linkEstablished;
    public Double rttMs;
    public Double lossPercent;
    public Double jitterMs;
    public long bytesSent;
    public long bytesRecv;
}

class FipsDatagram {
    public String fromNpub;
    public String fromNodeAddr;
    public String data;
}
