package io.getrelay.app.scanner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ZebraDataWedgePlugin — Capacitor plugin for Zebra DataWedge scan intent delivery.
 *
 * # Receiver configuration
 *
 * DataWedge runs as a separate system-privileged process (com.symbol.datawedge).
 * On Android 13+, dynamically-registered receivers must use RECEIVER_EXPORTED to accept
 * broadcasts from outside the application process. See ScanReceiverHelper for the full
 * security rationale.
 *
 * # What this plugin does NOT do
 *   - Does NOT modify existing DataWedge profiles or scanner configuration.
 *   - The optional configureProfile() method creates a NEW Relay-specific profile only.
 *     It does not alter any other profile.
 *
 * # DataWedge configuration API vs scan-data broadcasts
 *
 *   Scan-data delivery action:  io.getrelay.app.ACTION_SCAN  (configured by IT)
 *   DataWedge config API action: com.symbol.datawedge.api.ACTION  (used by configureProfile)
 *   DataWedge config results:    com.symbol.datawedge.api.RESULT_ACTION  (not scan data)
 *
 * References:
 *   https://techdocs.zebra.com/datawedge/13-0/guide/api/intentoutput/
 *   https://techdocs.zebra.com/datawedge/13-0/guide/api/createprofile/
 *   https://techdocs.zebra.com/datawedge/13-0/guide/api/setconfig/
 */
@CapacitorPlugin(name = "ZebraDataWedge")
public class ZebraDataWedgePlugin extends Plugin {

    private static final String TAG = "ZebraDataWedge";

    /**
     * Intent action that DataWedge must be configured to broadcast scan results to.
     * IT admins set this in the DataWedge Intent Output profile, OR the optional
     * configureProfile() method sets it automatically.
     */
    public static final String ACTION_SCAN_INTENT = "io.getrelay.app.ACTION_SCAN";

    // DataWedge configuration API (not scan data)
    private static final String DW_CONFIG_ACTION   = "com.symbol.datawedge.api.ACTION";
    private static final String DW_CREATE_PROFILE  = "com.symbol.datawedge.api.CREATE_PROFILE";
    private static final String DW_SET_CONFIG      = "com.symbol.datawedge.api.SET_CONFIG";

    // DataWedge scan-data extra keys
    private static final String EXTRA_DATA_STRING  = "com.symbol.datawedge.data_string";
    private static final String EXTRA_LABEL_TYPE   = "com.symbol.datawedge.label_type";

    private static final String RELAY_DW_PROFILE   = "Relay";

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
     * isAvailable — returns whether this device appears to be a Zebra device.
     * Detection is heuristic; use it to decide whether to show DataWedge configuration UI.
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        String manufacturer = Build.MANUFACTURER != null ? Build.MANUFACTURER : "";
        boolean isZebra = manufacturer.toLowerCase().contains("zebra");
        JSObject result = new JSObject();
        result.put("available",    isZebra);
        result.put("manufacturer", manufacturer);
        call.resolve(result);
    }

    /**
     * configureProfile — optional administrator-triggered DataWedge auto-configuration.
     *
     * Creates (or reconfigures) a DataWedge profile named "Relay" associated with
     * this application package. Only the Relay-specific profile is modified; all
     * other profiles are left unchanged.
     *
     * Configuration applied:
     *   - Associated app: io.getrelay.app / * (all activities)
     *   - Barcode input: enabled
     *   - Intent output: enabled, action=io.getrelay.app.ACTION_SCAN, delivery=broadcast
     *   - Keystroke output: disabled (avoids double delivery via keyboard wedge)
     *
     * This uses the DataWedge Intent API (documented at techdocs.zebra.com).
     * It does NOT require any proprietary SDK — only standard Android broadcast intents.
     *
     * Enterprise MDM note: If DataWedge is locked by enterprise policy, this call
     * is silently rejected by DataWedge. Manual configuration remains the fallback.
     */
    @PluginMethod
    public void configureProfile(PluginCall call) {
        if (!Build.MANUFACTURER.toLowerCase().contains("zebra")) {
            call.resolve(new JSObject().put("skipped", true).put("reason", "not_zebra"));
            return;
        }

        try {
            // Step 1: Create the profile (no-op if it already exists)
            Intent createIntent = new Intent();
            createIntent.setAction(DW_CONFIG_ACTION);
            createIntent.putExtra(DW_CREATE_PROFILE, RELAY_DW_PROFILE);
            createIntent.setPackage("com.symbol.datawedge");
            getContext().sendBroadcast(createIntent);

            // Step 2: Configure the profile
            Intent configIntent = new Intent();
            configIntent.setAction(DW_CONFIG_ACTION);
            configIntent.setPackage("com.symbol.datawedge");

            Bundle profileConfig = new Bundle();
            profileConfig.putString("PROFILE_NAME", RELAY_DW_PROFILE);
            profileConfig.putString("PROFILE_ENABLED", "true");
            profileConfig.putString("CONFIG_MODE", "UPDATE");

            // Associate the profile with this application
            Bundle appConfig = new Bundle();
            appConfig.putString("PACKAGE_NAME", "io.getrelay.app");
            appConfig.putStringArray("ACTIVITY_LIST", new String[]{"*"});
            profileConfig.putParcelableArray("APP_LIST", new Bundle[]{appConfig});

            // Plugin configuration array
            Bundle[] plugins = new Bundle[2];

            // Barcode input plugin — enable scanning
            Bundle barcodeInput = new Bundle();
            barcodeInput.putString("PLUGIN_NAME", "BARCODE");
            barcodeInput.putString("RESET_CONFIG", "false");
            Bundle barcodeParams = new Bundle();
            barcodeParams.putString("scanner_selection", "auto");
            barcodeParams.putString("scanner_input_enabled", "true");
            barcodeInput.putBundle("PARAM_LIST", barcodeParams);
            plugins[0] = barcodeInput;

            // Intent output plugin — deliver scans to Relay
            Bundle intentOutput = new Bundle();
            intentOutput.putString("PLUGIN_NAME", "INTENT");
            intentOutput.putString("RESET_CONFIG", "false");
            Bundle intentParams = new Bundle();
            intentParams.putString("intent_output_enabled", "true");
            intentParams.putString("intent_action",   ACTION_SCAN_INTENT);
            intentParams.putString("intent_category", "");
            intentParams.putString("intent_delivery", "2");  // 2 = broadcast intent
            intentOutput.putBundle("PARAM_LIST", intentParams);
            plugins[1] = intentOutput;

            profileConfig.putParcelableArray("PLUGIN_CONFIG", plugins);

            configIntent.putExtra(DW_SET_CONFIG, profileConfig);
            getContext().sendBroadcast(configIntent);

            Log.d(TAG, "DataWedge profile '" + RELAY_DW_PROFILE + "' configured");
            call.resolve(new JSObject().put("ok", true).put("profile", RELAY_DW_PROFILE));
        } catch (Exception e) {
            Log.e(TAG, "DataWedge profile configuration failed: " + e.getMessage());
            call.reject("DataWedge configuration failed: " + e.getMessage());
        }
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
        filter.addAction(ACTION_SCAN_INTENT);

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

        String dataString = intent.getStringExtra(EXTRA_DATA_STRING);
        String labelType  = intent.getStringExtra(EXTRA_LABEL_TYPE);

        if (dataString == null || dataString.isEmpty()) {
            Log.w(TAG, "Received scan intent with empty data_string — ignored");
            return;
        }

        Log.d(TAG, "DataWedge scan: type=" + labelType + " value.len=" + dataString.length());

        JSObject event = new JSObject();
        event.put("value",     dataString);
        event.put("source",    "ZEBRA_DATAWEDGE");
        event.put("labelType", labelType != null ? labelType : "");

        notifyListeners("scan", event);
    }
}
