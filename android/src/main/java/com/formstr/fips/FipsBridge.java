package com.formstr.fips;

public class FipsBridge {

    static {
        System.loadLibrary("fips_jni");
    }

    public native String nativeStart(String configJson);
    public native long nativeGetHandle();
    public native void nativeStop();
    public native String nativeGetStatus();
    public native String nativeGetNpub();
    public native String nativeGetAddress();
    public native void nativeSendDatagram(String toNpub, String data);
    public native void nativeSendDatagramByAddr(String toNodeAddr, String data);
    public native String nativeListSessions();
    public native String nativeListPeers();
    public native void nativeAddPeer(String peerJson);
    public native void nativeRemovePeer(String npub);
    public native String nativePollDatagram(int timeoutMs);
}
