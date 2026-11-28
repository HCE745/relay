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
 * ZebraDataWedgePlugin — Capacitor plugin for Zebra DataWedge scan intent delivery.
 *
 * DataWedge delivers scan data as a broadcast intent to the application. This plugin
 * registers a receiver for that intent and forwards the decoded data to the WebView
 * via a Capacitor event ("scan").
 *
 * IMPORTANT — what this plugin does NOT do:
 *   - Does NOT modify any existing DataWedge profiles.
 *   - Does NOT create new DataWedge profiles or change scanner configuration.
 *   - Does NOT use the DataWedge configuration API (com.symbol.datawedge.api.ACTION).
 *   - Does NOT intercept DataWedge API command-result broadcasts
 *     (com.symbol.datawedge.api.RESULT_ACTION is for command results, not scan data).
 *
 * IT administrators configure DataWedge independently. The recommended profile:
 *   - Intent Output: enabled
 *   - Intent action: "io.getrelay.app.ACTION_SCAN" (see ACTION_SCAN_INTENT below)
 *   - Intent category: (empty)
 *   - Intent delivery: Broadcast intent
 *
 * The app falls back to keyboard-wedge mode if no DataWedge scan intent is received.
 *
 * DataWedge scan data extras (standard):
 *   - com.symbol.datawedge.data_string : the decoded barcode string
 *   - com.symbol.datawedge.label_type  : the barcode symbology (e.g. "LABEL-TYPE-CODE128")
 *
 * References:
 *   https://techdocs.zebra.com/datawedge/13-0/guide/api/intentoutput/
 */
@CapacitorPlugin(name = "ZebraDataWedge")
public class ZebraDataWedgePlugin extends Plugin {

    private static final String TAG = "ZebraDataWedge";

    /**
     * The intent action that DataWedge should be configured to broadcast scan results to.
     * IT admins must set this exact action in the DataWedge Intent Output profile.
     */
    public static final String ACTION_SCAN_INTENT = "io.getrelay.app.ACTION_SCAN";

    /**
     * Standard DataWedge extra keys.
     * See: https://techdocs.zebra.com/datawedge/13-0/guide/api/intentoutput/#intentoutputextras
     */
    private static final String EXTRA_DATA_STRING   = "com.symbol.datawedge.data_string";
    private static final String EXTRA_LABEL_TYPE    = "com.symbol.datawedge.label_type";
    // Some DataWedge versions also include source scanner info
    private static final String EXTRA_DECODE_DATA   = "com.symbol.datawedge.decode_data";

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
     * @PluginMethod isAvailable — returns true if running on a Zebra device.
     * The calling JS code uses this to decide whether to listen for native scan events
     * or rely on keyboard-wedge detection.
     *
     * Detection is heuristic: Zebra devices typically report manufacturer "Zebra Technologies"
     * or model prefixes like "TC", "MC", "EC", "PS", "CC", "ZD", "ZT".
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        String manufacturer = Build.MANUFACTURER;
        boolean isZebra = manufacturer != null &&
            manufacturer.toLowerCase().contains("zebra");
        JSObject result = new JSObject();
        result.put("available", isZebra);
        result.put("manufacturer", manufacturer != null ? manufacturer : "unknown");
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
        filter.addAction(ACTION_SCAN_INTENT);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 13+: must specify RECEIVER_NOT_EXPORTED for implicit receivers
                // DataWedge sends broadcasts from a trusted system context, so NOT_EXPORTED is correct.
                getContext().registerReceiver(scanReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(scanReceiver, filter);
            }
            registered = true;
            Log.d(TAG, "DataWedge scan receiver registered for action: " + ACTION_SCAN_INTENT);
        } catch (Exception e) {
            Log.e(TAG, "Failed to register DataWedge receiver: " + e.getMessage());
        }
    }

    private void unregisterScanReceiver() {
        if (!registered || scanReceiver == null) return;
        try {
            getContext().unregisterReceiver(scanReceiver);
            Log.d(TAG, "DataWedge scan receiver unregistered");
        } catch (Exception e) {
            Log.w(TAG, "Error unregistering DataWedge receiver: " + e.getMessage());
        } finally {
            registered = false;
        }
    }

    // ── Scan broadcast handler ──────────────────────────────────────────────────

    private void handleScanBroadcast(Intent intent) {
        if (intent == null) return;

        String dataString = intent.getStringExtra(EXTRA_DATA_STRING);
        String labelType  = intent.getStringExtra(EXTRA_LABEL_TYPE);

        if (dataString == null || dataString.isEmpty()) {
            Log.w(TAG, "Received scan intent with empty data_string — ignored");
            return;
        }

        Log.d(TAG, "DataWedge scan: type=" + labelType + " value=" + dataString);

        JSObject event = new JSObject();
        event.put("value",     dataString);
        event.put("source",    "ZEBRA_DATAWEDGE");
        event.put("labelType", labelType != null ? labelType : "");

        // Notify all JS listeners registered via addListener("scan", ...)
        notifyListeners("scan", event);
    }
}
