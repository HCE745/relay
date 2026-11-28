package io.getrelay.app;

import com.getcapacitor.BridgeActivity;

import io.getrelay.app.scanner.ZebraDataWedgePlugin;
import io.getrelay.app.scanner.HoneywellScannerPlugin;
import io.getrelay.app.scanner.GenericIntentScannerPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void registerPlugins() {
        super.registerPlugins();
        // Phase 4A: Zebra DataWedge
        registerPlugin(ZebraDataWedgePlugin.class);
        // Phase 4B: Honeywell / Datalogic
        registerPlugin(HoneywellScannerPlugin.class);
        // Phase 4C: Generic intent wedge (Urovo, Unitech, CipherLab, Newland, etc.)
        registerPlugin(GenericIntentScannerPlugin.class);
    }
}
