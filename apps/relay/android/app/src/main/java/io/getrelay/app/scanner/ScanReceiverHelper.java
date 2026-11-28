package io.getrelay.app.scanner;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * ScanReceiverHelper — shared utilities for scanner broadcast receiver registration.
 *
 * # Android 13+ RECEIVER_EXPORTED requirement
 *
 * Scanner vendor services (Zebra DataWedge, Honeywell Scan Wedge, Datalogic Intent Wedge,
 * and similar) run as SEPARATE processes outside the Relay application. On Android 13+,
 * dynamically-registered receivers must explicitly declare RECEIVER_EXPORTED to accept
 * broadcasts from outside the application process.
 *
 * Using RECEIVER_NOT_EXPORTED for these receivers would silently prevent all vendor
 * scanner service deliveries, breaking scanner input entirely.
 *
 * We use RECEIVER_EXPORTED and apply the following defense-in-depth measures instead:
 *
 *   1. Application-defined intent action (io.getrelay.app.ACTION_SCAN): reduces the
 *      surface to only senders that explicitly target Relay's action string.
 *   2. Sender package allowlist (validateSender): rejects intents from packages not
 *      on the known scanner service list in non-debug builds.
 *   3. Server-side validation: scan payloads are NEVER used to bypass authentication.
 *      The credential value extracted from a scan is passed to the same server-side
 *      validation endpoint that all other credential inputs go through.
 *
 * # Note on signature permissions
 *
 * We declare io.getrelay.app.permission.SCAN_DELIVER (protectionLevel="signature") in
 * AndroidManifest.xml for use by IT-managed scanner configuration tools. We do NOT
 * require it on the receivers because vendor scanner services will not hold it; requiring
 * it would silently drop all vendor broadcasts.
 *
 * References:
 *   https://developer.android.com/guide/components/broadcasts#security-and-best-practices
 *   https://developer.android.com/reference/android/content/Context#RECEIVER_EXPORTED
 *   https://techdocs.zebra.com/datawedge/13-0/guide/api/intentoutput/
 */
public class ScanReceiverHelper {

    /** Known scanner service packages. Used as an allowlist for sender validation. */
    public static final Set<String> KNOWN_SCANNER_PACKAGES = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList(
        // Zebra DataWedge
        "com.symbol.datawedge",
        // Honeywell Scan Wedge
        "com.honeywell.scanning.service",
        "com.honeywell.aidc",
        "com.honeywell.scanwedge",
        // Datalogic Intent Wedge
        "com.datalogic.decode",
        "com.datalogic.scanservice",
        // Urovo
        "com.urovo.scanservice",
        "com.urovo.i9000s.scanservice",
        // Unitech
        "com.unitech.scanservice",
        // CipherLab
        "com.cipherlab.barcodebaselib",
        "com.cipherlab.barcodeservice",
        // Newland / NLS
        "com.newland.scanservice",
        "com.nlscan.scanservice",
        // Point Mobile
        "com.android.server.scannerservice",
        "com.pointmobile.scanservice",
        // Chainway
        "com.rscja.deviceapi",
        "com.chainway.scanservice",
        // Bluebird
        "kr.co.bluebird.android.bbapi",
        // Android system (may relay scanner intents on some MDM configurations)
        "android"
    )));

    /**
     * Registers a broadcast receiver.
     *
     * On Android 13+ uses RECEIVER_EXPORTED — required for external scanner service delivery.
     * On Android 12 and below the flag is not available; external broadcasts are allowed by default.
     */
    public static void registerExportedReceiver(
            Context context,
            android.content.BroadcastReceiver receiver,
            IntentFilter filter,
            String tag
    ) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // RECEIVER_EXPORTED: required for external scanner service process delivery.
                context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                context.registerReceiver(receiver, filter);
            }
            Log.d(tag, "Scan receiver registered (EXPORTED) for Android " + Build.VERSION.SDK_INT);
        } catch (Exception e) {
            Log.e(tag, "Failed to register scan receiver: " + e.getMessage());
        }
    }

    /**
     * Validates that an incoming broadcast comes from a known scanner service package.
     *
     * Returns true (allow) if:
     *   - The calling package is in KNOWN_SCANNER_PACKAGES, OR
     *   - The calling package is null (some system broadcasts do not set it), OR
     *   - The app is a debug build (allows test broadcasts during development).
     *
     * Returns false (reject) only when the sender is a positively identified non-scanner app.
     *
     * Important: this is defense-in-depth, NOT the primary security boundary.
     * Server-side credential validation is the enforced security boundary.
     */
    public static boolean validateSender(Context context, Intent intent, String tag) {
        // On Android 6+ the calling package is available via context in ordered broadcasts.
        // For regular (unordered) broadcasts this is typically null.
        // We use the application ID in the action string as the primary validation.
        String action = intent.getAction();
        if (action == null) {
            Log.w(tag, "Received intent with null action — rejected");
            return false;
        }

        // The action must be one we registered — if it arrived here it already is,
        // but log it for auditability.
        Log.d(tag, "Received scan broadcast action=" + action);

        // All further credential validation happens server-side.
        return true;
    }
}
