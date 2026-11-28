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
 * Using RECEIVER_NOT_EXPORTED silently prevents all vendor scanner service deliveries.
 * We use RECEIVER_EXPORTED; the security boundary is server-side credential validation.
 *
 * # Sender identity limitations for unordered broadcasts
 *
 * Android does NOT provide reliable caller-package information for UNORDERED broadcasts.
 * Context.getCallingPackage() returns null for broadcast delivery. The KNOWN_SCANNER_PACKAGES
 * allowlist is an advisory heuristic: it filters obviously wrong intents (e.g., unexpected
 * action strings) but CANNOT verify the sending package's identity for unordered broadcasts.
 *
 * The practical mitigations in this codebase are:
 *
 *   1. Application-defined intent action (io.getrelay.app.ACTION_SCAN): any sender must
 *      explicitly target this action — an incidental intent with this action from a rogue
 *      app requires that app to be installed and to send this exact string.
 *   2. Payload length limits: barcode strings are capped at MAX_BARCODE_LENGTH bytes.
 *      Oversized payloads are rejected before any processing.
 *   3. Server-side credential validation: scan payloads are NEVER used to bypass
 *      authentication. The extracted value is passed through the same server-side
 *      validation endpoint as all other credential inputs.
 *
 * The KNOWN_SCANNER_PACKAGES set is maintained for informational logging and future use
 * with ordered broadcasts (where getCallingPackage() is available), but it is NOT
 * currently an enforced security control for unordered scanner service broadcasts.
 *
 * # Note on signature permissions
 *
 * We declare io.getrelay.app.permission.SCAN_DELIVER (protectionLevel="signature") in
 * AndroidManifest.xml for IT-managed scanner configuration tools. We do NOT require it
 * on the scan receivers because vendor scanner services will not hold it.
 *
 * References:
 *   https://developer.android.com/guide/components/broadcasts#security-and-best-practices
 *   https://developer.android.com/reference/android/content/Context#RECEIVER_EXPORTED
 *   https://techdocs.zebra.com/datawedge/13-0/guide/api/intentoutput/
 */
public class ScanReceiverHelper {

    /**
     * Maximum accepted barcode string length in characters.
     * Payloads exceeding this limit are rejected before processing.
     * Most barcode symbologies produce ≤ 100 characters; this cap allows generous content
     * while preventing excessively large strings from reaching application logic.
     */
    public static final int MAX_BARCODE_LENGTH = 1024;

    /**
     * Known scanner service packages.
     * Advisory reference for logging and ordered-broadcast validation.
     * NOT an enforced security control for unordered broadcasts — see class Javadoc.
     */
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
     * Performs basic structural validation on an incoming broadcast intent.
     *
     * Rejects intents with no action. Logs the action for auditability.
     *
     * IMPORTANT: For unordered broadcasts (the delivery model used by all scanner vendor
     * services), Android does NOT expose the sender's package identity — getCallingPackage()
     * returns null. The KNOWN_SCANNER_PACKAGES set cannot be used to enforce an allowlist
     * here. The primary security boundary is server-side credential validation; scan payloads
     * are treated as untrusted input regardless of origin. Payload length is enforced
     * separately via validatePayloadLength().
     */
    public static boolean validateSender(Context context, Intent intent, String tag) {
        String action = intent.getAction();
        if (action == null) {
            Log.w(tag, "Received intent with null action — rejected");
            return false;
        }
        // Log the action for audit. Package identity is not available for unordered broadcasts.
        Log.d(tag, "Received scan broadcast action=" + action);
        return true;
    }

    /**
     * Validates that a barcode string payload is within acceptable length bounds.
     *
     * Returns true when the value is non-null and ≤ MAX_BARCODE_LENGTH characters.
     * Returns false for null or oversized payloads, which are rejected before processing.
     */
    public static boolean validatePayloadLength(String value, String tag) {
        if (value == null) {
            Log.w(tag, "Scan payload is null — rejected");
            return false;
        }
        if (value.length() > MAX_BARCODE_LENGTH) {
            Log.w(tag, "Scan payload exceeds maximum length (" + value.length()
                + " > " + MAX_BARCODE_LENGTH + ") — rejected");
            return false;
        }
        return true;
    }
}
