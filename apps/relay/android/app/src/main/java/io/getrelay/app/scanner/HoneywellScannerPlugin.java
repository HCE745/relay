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
 * Honeywell devices (Dolphin, CN, CT, EDA, Thor, ScanPal series):
 *   The Honeywell Scan Wedge feature delivers scan data as a broadcast intent.
 *   Unlike Zebra DataWedge, Honeywell Scan Wedge is configured in the device's
 *   "Scan Wedge" settings app or via MDM. This plugin listens for the standard
 *   Honeywell intent action.
 *
 * Datalogic devices (Memor, Skorpio, Falcon):
 *   Datalogic Intent Wedge similarly delivers scan data as a broadcast intent.
 *   See: https://datalogic.github.io/wedge/overview/
 *   Intent action: "com.datalogic.decode.action.SCAN"
 *   Intent extra key: "com.datalogic.decode.intentwedge.barcode_string"
 *
 * IMPORTANT — what this plugin does NOT do:
 *   - Does NOT modify Honeywell Scan Wedge configuration.
 *   - Does NOT modify Datalogic Intent Wedge configuration.
 *   - IT administrators configure the wedge application independently.
 *
 * Recommended Honeywell Scan Wedge configuration:
 *   - Scan Wedge mode: Intent
 *   - Intent action: "io.getrelay.app.ACTION_SCAN" (same as DataWedge)
 *   - Intent type: Broadcast
 *   - Barcode data extra: "com.honeywell.aidc.barcodedata"
 *
 * This plugin handles both Honeywell's standard extra key and the Datalogic extra key,
 * emitting a unified "scan" event to the WebView.
 *
 * References:
 *   Honeywell: https://hsmftp.honeywell.com/tech-pubs/
 *   Datalogic: https://datalogic.github.io/wedge/overview/
 */
@CapacitorPlugin(name = "HoneywellScanner")
public class HoneywellScannerPlugin extends Plugin {

    private static final String TAG = "HoneywellScanner";

    // Honeywell Scan Wedge intent action (configure in Scan Wedge app)
    // We reuse the same application-defined action used for Zebra, so a single
    // IT configuration works across scanner brands.
    private static final String ACTION_SCAN_INTENT = ZebraDataWedgePlugin.ACTION_SCAN_INTENT;

    // Datalogic Intent Wedge — standard action and extra key
    private static final String DATALOGIC_ACTION      = "com.datalogic.decode.action.SCAN";
    private static final String DATALOGIC_EXTRA_DATA  = "com.datalogic.decode.intentwedge.barcode_string";
    private static final String DATALOGIC_EXTRA_TYPE  = "com.datalogic.decode.intentwedge.barcode_symbology";

    // Honeywell standard extra keys
    // Different Honeywell firmware versions use slightly different extra key names.
    private static final String HONEYWELL_EXTRA_DATA  = "com.honeywell.aidc.barcodedata";
    // Some older Honeywell devices use "DATA_STRING":
    private static final String HONEYWELL_EXTRA_DATA2 = "DATA_STRING";
    private static final String HONEYWELL_EXTRA_TYPE  = "com.honeywell.aidc.labeltype";

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

    /**
     * @PluginMethod isAvailable — returns true if running on a Honeywell or Datalogic device.
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        String manufacturer = Build.MANUFACTURER;
        if (manufacturer == null) manufacturer = "";
        String lc = manufacturer.toLowerCase();
        boolean isHoneywell  = lc.contains("honeywell");
        boolean isDatalogic  = lc.contains("datalogic");
        JSObject result = new JSObject();
        result.put("available",   isHoneywell || isDatalogic);
        result.put("isHoneywell", isHoneywell);
        result.put("isDatalogic", isDatalogic);
        result.put("manufacturer", manufacturer);
        call.resolve(result);
    }

    // ── Broadcast receiver lifecycle ────────────────────────────────────────────

    private void registerScanReceiver() {
        if (registered) return;

        scanReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                handleScanBroadcast(intent);
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_SCAN_INTENT);  // shared relay action (Honeywell + Zebra)
        filter.addAction(DATALOGIC_ACTION);    // Datalogic native action

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(scanReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(scanReceiver, filter);
            }
            registered = true;
            Log.d(TAG, "Honeywell/Datalogic scan receiver registered");
        } catch (Exception e) {
            Log.e(TAG, "Failed to register Honeywell/Datalogic receiver: " + e.getMessage());
        }
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

        String action     = intent.getAction();
        String dataString = null;
        String labelType  = null;
        String source;

        if (DATALOGIC_ACTION.equals(action)) {
            // Datalogic Intent Wedge
            dataString = intent.getStringExtra(DATALOGIC_EXTRA_DATA);
            labelType  = intent.getStringExtra(DATALOGIC_EXTRA_TYPE);
            source     = "DATALOGIC_WEDGE";
        } else {
            // Honeywell Scan Wedge (or any device configured with ACTION_SCAN_INTENT)
            dataString = intent.getStringExtra(HONEYWELL_EXTRA_DATA);
            if (dataString == null) {
                dataString = intent.getStringExtra(HONEYWELL_EXTRA_DATA2);
            }
            if (dataString == null) {
                // Try DataWedge key as fallback (this receiver also fires for DataWedge
                // when ZebraDataWedgePlugin is not installed — defensive)
                dataString = intent.getStringExtra("com.symbol.datawedge.data_string");
            }
            labelType = intent.getStringExtra(HONEYWELL_EXTRA_TYPE);
            source    = "HONEYWELL_WEDGE";
        }

        if (dataString == null || dataString.isEmpty()) {
            Log.w(TAG, "Received scan intent (" + action + ") with empty data — ignored");
            return;
        }

        Log.d(TAG, "Scan [" + source + "]: type=" + labelType + " value=" + dataString);

        JSObject event = new JSObject();
        event.put("value",     dataString);
        event.put("source",    source);
        event.put("labelType", labelType != null ? labelType : "");

        notifyListeners("scan", event);
    }
}
