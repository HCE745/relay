package io.getrelay.app.scanner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * HoneywellScannerPlugin — Capacitor plugin for Honeywell and Datalogic scan intent delivery.
 *
 * # Honeywell scanner integration options
 *
 * Honeywell provides two distinct integration paths:
 *
 * 1. AIDC Manager SDK (direct scanner control):
 *    - Requires the Honeywell AIDC SDK jar/AAR, which must be placed in the project.
 *    - Provides scan session acquisition/release (AidcManager.openBarcodeReader).
 *    - Not used here: the SDK is not included in this project; no hardware purchases
 *      were authorized. This path requires direct Honeywell SDK integration.
 *
 * 2. Intent Wedge (IT-configured broadcast delivery):
 *    - Configured by IT in the device's Scan Wedge settings or via MDM.
 *    - Does NOT require scanner acquisition/release commands from the app.
 *    - The app listens for the configured broadcast action.
 *    - This is the approach used by this plugin (no SDK dependency).
 *
 * This plugin uses path 2 (Intent Wedge). No scanner acquisition or release commands
 * are sent — that is only relevant for path 1.
 *
 * # Receiver configuration
 *
 * Honeywell Scan Wedge runs as a separate system process. RECEIVER_EXPORTED is required
 * on Android 13+ for the same reason as ZebraDataWedgePlugin. See ScanReceiverHelper.
 *
 * # Datalogic Intent Wedge
 *
 * Datalogic devices (Memor, Skorpio, Falcon, Joya) deliver scan data via:
 *   Action:     com.datalogic.decode.action.SCAN
 *   Data extra: com.datalogic.decode.intentwedge.barcode_string (String)
 *   Type extra: com.datalogic.decode.intentwedge.barcode_symbology (String)
 *
 * Source: https://datalogic.github.io/wedge/overview/
 *
 * Configuration: via ScanConfig app → Intent Wedge → enable, action default is
 * com.datalogic.decode.action.SCAN. No additional configuration needed to use the
 * default action. Custom action is optional.
 *
 * # Honeywell extra key variants
 *
 * Different Honeywell firmware families use different extra key names:
 *   CT-series, EDA-series (newer): com.honeywell.aidc.barcodedata
 *   Some older CN/Dolphin firmware:  DATA_STRING
 *   Thor/ScanPal some versions:      barcode_string
 * This plugin checks all three in priority order.
 */
@CapacitorPlugin(name = "HoneywellScanner")
public class HoneywellScannerPlugin extends Plugin {

    private static final String TAG = "HoneywellScanner";

    // Relay application-defined action (Honeywell Scan Wedge can be configured to use this)
    private static final String RELAY_ACTION = ZebraDataWedgePlugin.ACTION_SCAN_INTENT;

    // Datalogic native action
    private static final String DATALOGIC_ACTION     = "com.datalogic.decode.action.SCAN";
    private static final String DATALOGIC_EXTRA_DATA = "com.datalogic.decode.intentwedge.barcode_string";
    private static final String DATALOGIC_EXTRA_TYPE = "com.datalogic.decode.intentwedge.barcode_symbology";

    // Honeywell extra key names in priority order
    private static final String[] HONEYWELL_DATA_EXTRAS = {
        "com.honeywell.aidc.barcodedata",
        "DATA_STRING",
        "barcode_string",
    };
    private static final String HONEYWELL_TYPE_EXTRA = "com.honeywell.aidc.labeltype";

    private BroadcastReceiver scanReceiver;
    private boolean           registered = false;

    @Override
    public void load() {
        registerScanReceiver();
    }

    @Override
    protected void handleOnPause() {
        unregisterScanReceiver();
    }

    @Override
    protected void handleOnResume() {
        registerScanReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterScanReceiver();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        String manufacturer = Build.MANUFACTURER != null ? Build.MANUFACTURER : "";
        String lc = manufacturer.toLowerCase();
        boolean isHoneywell = lc.contains("honeywell");
        boolean isDatalogic = lc.contains("datalogic");
        JSObject result = new JSObject();
        result.put("available",   isHoneywell || isDatalogic);
        result.put("isHoneywell", isHoneywell);
        result.put("isDatalogic", isDatalogic);
        result.put("manufacturer", manufacturer);
        // Report integration path so JS can show appropriate user guidance
        result.put("integrationPath", "INTENT_WEDGE");
        result.put("requiresAidcSdk", false);
        call.resolve(result);
    }

    // ── Broadcast receiver lifecycle ────────────────────────────────────────────

    private void registerScanReceiver() {
        if (registered) return;

        scanReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (ScanReceiverHelper.validateSender(context, intent, TAG)) {
                    handleScanBroadcast(intent);
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(RELAY_ACTION);
        filter.addAction(DATALOGIC_ACTION);

        ScanReceiverHelper.registerExportedReceiver(getContext(), scanReceiver, filter, TAG);
        registered = true;
    }

    private void unregisterScanReceiver() {
        if (!registered || scanReceiver == null) return;
        try {
            getContext().unregisterReceiver(scanReceiver);
        } catch (Exception e) {
            Log.w(TAG, "Error unregistering receiver: " + e.getMessage());
        } finally {
            registered = false;
        }
    }

    // ── Scan broadcast handler ──────────────────────────────────────────────────

    private void handleScanBroadcast(Intent intent) {
        if (intent == null) return;

        String action    = intent.getAction();
        String data      = null;
        String labelType = null;
        String source;

        if (DATALOGIC_ACTION.equals(action)) {
            data      = intent.getStringExtra(DATALOGIC_EXTRA_DATA);
            labelType = intent.getStringExtra(DATALOGIC_EXTRA_TYPE);
            source    = "DATALOGIC_WEDGE";
        } else {
            // Honeywell: check extra key variants in priority order
            for (String key : HONEYWELL_DATA_EXTRAS) {
                String v = intent.getStringExtra(key);
                if (v != null && !v.isEmpty()) {
                    data = v;
                    break;
                }
            }
            labelType = intent.getStringExtra(HONEYWELL_TYPE_EXTRA);
            source    = "HONEYWELL_WEDGE";
        }

        if (data == null || data.isEmpty()) {
            Log.w(TAG, "Received scan intent (" + action + ") with empty data — ignored");
            return;
        }

        Log.d(TAG, "Scan [" + source + "]: len=" + data.length());

        JSObject event = new JSObject();
        event.put("value",     data);
        event.put("source",    source);
        event.put("labelType", labelType != null ? labelType : "");

        notifyListeners("scan", event);
    }
}
