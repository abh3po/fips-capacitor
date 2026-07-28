package com.formstr.fips.e2e;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(com.formstr.fips.FipsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
