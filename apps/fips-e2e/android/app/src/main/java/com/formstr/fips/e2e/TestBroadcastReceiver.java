package com.formstr.fips.e2e;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

public class TestBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "FipsE2E";
    private static WebView webView;

    public static void setWebView(WebView wv) {
        webView = wv;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (webView == null) {
            Log.w(TAG, "WebView not ready, ignoring broadcast");
            return;
        }

        String action = intent.getAction();
        if (action == null) return;

        final String js;
        switch (action) {
            case "com.formstr.fips.e2e.START_NODE":
                js = "startNode()";
                break;
            case "com.formstr.fips.e2e.STOP_NODE":
                js = "stopNode()";
                break;
            case "com.formstr.fips.e2e.ADD_PEER": {
                String npub = intent.getStringExtra("npub");
                String addr = intent.getStringExtra("addr");
                js = "addPeer(" +
                    (npub != null ? "'" + npub.replace("'", "\\'") + "'" : "null") + "," +
                    (addr != null ? "'" + addr.replace("'", "\\'") + "'" : "null") + ")";
                break;
            }
            case "com.formstr.fips.e2e.SEND_DATAGRAM": {
                String npub = intent.getStringExtra("npub");
                String payload = intent.getStringExtra("payload");
                js = "sendDatagram(" +
                    (npub != null ? "'" + npub.replace("'", "\\'") + "'" : "null") + "," +
                    (payload != null ? "'" + payload.replace("'", "\\'") + "'" : "null") + ")";
                break;
            }
            case "com.formstr.fips.e2e.REFRESH_PEERS":
                js = "refreshPeers()";
                break;
            default:
                Log.d(TAG, "Unknown action: " + action);
                return;
        }

        webView.post(() -> webView.evaluateJavascript(js, null));
        Log.d(TAG, "Executed: " + js);
    }
}
