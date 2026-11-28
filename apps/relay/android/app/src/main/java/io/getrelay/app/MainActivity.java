package io.getrelay.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import io.getrelay.app.scanner.ZebraDataWedgePlugin;
import io.getrelay.app.scanner.HoneywellScannerPlugin;
import io.getrelay.app.scanner.GenericIntentScannerPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register scanner plugins before the Bridge is built in super.onCreate()
        registerPlugin(ZebraDataWedgePlugin.class);
        registerPlugin(HoneywellScannerPlugin.class);
        registerPlugin(GenericIntentScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
