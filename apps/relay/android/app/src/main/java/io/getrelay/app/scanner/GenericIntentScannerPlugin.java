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

import java.util.HashMap;
import java.util.Map;

/**
 * GenericIntentScannerPlugin — Capacitor plugin for additional industrial scanner brands.
 *
 * Covers Phase 4C manufacturers: Urovo, Unitech, CipherLab, Newland, Point Mobile,
 * Chainway, and Bluebird. Each brand delivers scan data via broadcast intents but uses
 * different action names and extra key names.
 *
 * This plugin registers receivers for all known per-brand intent actions, plus the
 * application-defined relay action (io.getrelay.app.ACTION_SCAN) for devices configured
 * by IT administrators to use a custom intent output.
 *
 * IMPORTANT — what this plugin does NOT do:
 *   - Does NOT modify scanner configuration on any device.
 *   - Does NOT use vendor configuration APIs.
 *   - IT administrators are responsible for configuring Intent Wedge output on each device.
 *
 * Per-manufacturer known intent action/extra mappings (Phase 4C):
 *
 *  Urovo:
 *    Action:  "urovo.rcv.message" or "android.intent.action.DECODE_DATA"
 *    Extra:   "urovo.rcv.message" contains the scan data in some firmware versions,
 *             "barcode_string" in others. Urovo also supports a keyboard-wedge mode.
 *
 *  Unitech:
 *    Action:  "unitech.scanservice.data" or the shared relay action
 *    Extra:   "text" (string)
 *
 *  CipherLab:
 *    Action:  "com.cipherlab.barcodebaselib.PASS_KEYCODE_DATA_CIPHER" (older)
 *             or "com.cipherlab.barcodebaselib.PASS_SCAN_DATA_CIPHER" (newer)
 *    Extra:   "BarcodeStr" or "SCAN_DATA"
 *
 *  Newland (NLS):
 *    Action:  "nlscan.action.SCANNER_RESULT" or "com.newland.action.SCAN_RESULT"
 *    Extra:   "SCAN_BARCODE1" (string) or "scan_result" (string)
 *
 *  Point Mobile:
 *    Action:  "com.android.server.scannerservice.broadcast"
 *    Extra:   "scan_data" or "barcodeData"
 *
 *  Chainway:
 *    Action:  "com.rscja.deviceapi.action.BARCODE" (some models)
 *             or the shared relay action
 *    Extra:   "value"
 *
 *  Bluebird:
 *    Action:  "kr.co.bluebird.android.bbapi.action.BARCODE_READ_DATA"
 *    Extra:   "EXTRA_BARCODE_DECODING_DATA" (byte[] — decoded to UTF-8 string)
 *
 * When a device is configured to use the relay action (io.getrelay.app.ACTION_SCAN),
 * IT administrators choose which extra key carries the barcode data. This plugin checks
 * multiple common extra key names in priority order.
 *
 * NOTE: Physical device compatibility claims are based on published vendor documentation.
 * Individual devices have NOT been physically tested during this development phase.
 * See deployment documentation for IT configuration steps per manufacturer.
 */
@CapacitorPlugin(name = "GenericIntentScanner")
public class GenericIntentScannerPlugin extends Plugin {

    private static final String TAG = "GenericIntentScanner";

    // Application-defined relay action — IT-configured cross-brand intent
    private static final String RELAY_ACTION = ZebraDataWedgePlugin.ACTION_SCAN_INTENT;

    // Urovo
    private static final String UROVO_ACTION_1    = "urovo.rcv.message";
    private static final String UROVO_ACTION_2    = "android.intent.action.DECODE_DATA";

    // Unitech
    private static final String UNITECH_ACTION    = "unitech.scanservice.data";

    // CipherLab
    private static final String CIPHERLAB_ACTION_1 = "com.cipherlab.barcodebaselib.PASS_KEYCODE_DATA_CIPHER";
    private static final String CIPHERLAB_ACTION_2 = "com.cipherlab.barcodebaselib.PASS_SCAN_DATA_CIPHER";

    // Newland / NLS
    private static final String NLS_ACTION_1      = "nlscan.action.SCANNER_RESULT";
    private static final String NLS_ACTION_2      = "com.newland.action.SCAN_RESULT";

    // Point Mobile
    private static final String PM_ACTION         = "com.android.server.scannerservice.broadcast";

    // Chainway
    private static final String CHAINWAY_ACTION   = "com.rscja.deviceapi.action.BARCODE";

    // Bluebird
    private static final String BLUEBIRD_ACTION   = "kr.co.bluebird.android.bbapi.action.BARCODE_READ_DATA";
    private static final String BLUEBIRD_EXTRA    = "EXTRA_BARCODE_DECODING_DATA";

    // Map from intent action → { brand, extra key(s) in priority order }
    // Extra keys listed in order of preference; first non-null/non-empty value wins.
    private static final Map<String, String[]> BRAND_MAP = new HashMap<>();
    static {
        BRAND_MAP.put(UROVO_ACTION_1,    new String[]{ "urovo.rcv.message", "barcode_string", "data" });
        BRAND_MAP.put(UROVO_ACTION_2,    new String[]{ "barcode_string", "data_string", "data" });
        BRAND_MAP.put(UNITECH_ACTION,    new String[]{ "text", "data", "barcode_string" });
        BRAND_MAP.put(CIPHERLAB_ACTION_1, new String[]{ "BarcodeStr", "SCAN_DATA", "data_string" });
        BRAND_MAP.put(CIPHERLAB_ACTION_2, new String[]{ "BarcodeStr", "SCAN_DATA", "data_string" });
        BRAND_MAP.put(NLS_ACTION_1,      new String[]{ "SCAN_BARCODE1", "scan_result", "data" });
        BRAND_MAP.put(NLS_ACTION_2,      new String[]{ "scan_result", "SCAN_BARCODE1", "data" });
        BRAND_MAP.put(PM_ACTION,         new String[]{ "scan_data", "barcodeData", "data_string" });
        BRAND_MAP.put(CHAINWAY_ACTION,   new String[]{ "value", "barcode_string", "data" });
        // Relay action — check all common extra keys; first non-null wins
        BRAND_MAP.put(RELAY_ACTION, new String[]{
            "com.symbol.datawedge.data_string",  // Zebra key (if Honeywell plugin not loaded)
            "com.honeywell.aidc.barcodedata",     // Honeywell key
            "DATA_STRING",
            "data_string",
            "barcode_string",
            "scan_data",
            "text",
            "value",
            "data",
        });
    }

    // Source labels per action
    private static final Map<String, String> SOURCE_MAP = new HashMap<>();
    static {
        SOURCE_MAP.put(UROVO_ACTION_1,    "UROVO_WEDGE");
        SOURCE_MAP.put(UROVO_ACTION_2,    "UROVO_WEDGE");
        SOURCE_MAP.put(UNITECH_ACTION,    "UNITECH_WEDGE");
        SOURCE_MAP.put(CIPHERLAB_ACTION_1, "CIPHERLAB_WEDGE");
        SOURCE_MAP.put(CIPHERLAB_ACTION_2, "CIPHERLAB_WEDGE");
        SOURCE_MAP.put(NLS_ACTION_1,      "NEWLAND_WEDGE");
        SOURCE_MAP.put(NLS_ACTION_2,      "NEWLAND_WEDGE");
        SOURCE_MAP.put(PM_ACTION,         "POINTMOBILE_WEDGE");
        SOURCE_MAP.put(CHAINWAY_ACTION,   "CHAINWAY_WEDGE");
        SOURCE_MAP.put(BLUEBIRD_ACTION,   "BLUEBIRD_WEDGE");
        SOURCE_MAP.put(RELAY_ACTION,      "GENERIC_WEDGE");
    }

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
        boolean known = lc.contains("urovo")  || lc.contains("unitech")   ||
                        lc.contains("cipher") || lc.contains("newland")   ||
                        lc.contains("nls")    || lc.contains("point mobile") ||
                        lc.contains("pm")     || lc.contains("chainway")  ||
                        lc.contains("bluebird");
        JSObject result = new JSObject();
        result.put("available",    known);
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
        // Register all known brand actions
        for (String action : BRAND_MAP.keySet()) {
            filter.addAction(action);
        }
        filter.addAction(BLUEBIRD_ACTION);  // byte[] extra — handled separately

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(scanReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(scanReceiver, filter);
            }
            registered = true;
            Log.d(TAG, "Generic scanner receiver registered for " + BRAND_MAP.size() + " actions");
        } catch (Exception e) {
            Log.e(TAG, "Failed to register generic receiver: " + e.getMessage());
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

        String action = intent.getAction();
        if (action == null) return;

        String dataString = null;
        String source     = SOURCE_MAP.containsKey(action) ? SOURCE_MAP.get(action) : "GENERIC_WEDGE";

        if (BLUEBIRD_ACTION.equals(action)) {
            // Bluebird delivers data as a byte array
            byte[] bytes = intent.getByteArrayExtra(BLUEBIRD_EXTRA);
            if (bytes != null && bytes.length > 0) {
                try {
                    dataString = new String(bytes, "UTF-8").trim();
                } catch (Exception e) {
                    dataString = new String(bytes).trim();
                }
            }
        } else {
            // All other brands: check the priority-ordered extra keys
            String[] extraKeys = BRAND_MAP.get(action);
            if (extraKeys != null) {
                for (String key : extraKeys) {
                    String v = intent.getStringExtra(key);
                    if (v != null && !v.isEmpty()) {
                        dataString = v;
                        break;
                    }
                }
            }
        }

        if (dataString == null || dataString.isEmpty()) {
            Log.w(TAG, "Received scan intent (" + action + ") with empty data — ignored");
            return;
        }

        Log.d(TAG, "Scan [" + source + "]: " + dataString);

        JSObject event = new JSObject();
        event.put("value",  dataString);
        event.put("source", source);

        notifyListeners("scan", event);
    }
}
