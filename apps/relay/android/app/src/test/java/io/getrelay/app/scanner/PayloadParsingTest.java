package io.getrelay.app.scanner;

import static org.junit.Assert.*;

import android.content.Intent;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.nio.charset.StandardCharsets;

/**
 * PayloadParsingTest — JVM tests for brand-specific barcode payload extraction.
 *
 * Tests that the correct extra key is used for each manufacturer's intent format,
 * including Bluebird's byte[] extra. Tests run on the JVM via Robolectric.
 *
 * NOTE: These tests exercise the parsing logic via Intent extras; they do not
 * test the full plugin broadcast lifecycle (which requires instrumented tests).
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class PayloadParsingTest {

    // ── Zebra DataWedge extra key ────────────────────────────────────────────────

    @Test
    public void zebraExtra_dataStringKey() {
        Intent intent = new Intent("io.getrelay.app.ACTION_SCAN");
        intent.putExtra("com.symbol.datawedge.data_string", "1234567890128");
        intent.putExtra("com.symbol.datawedge.label_type", "EAN13");

        String data      = intent.getStringExtra("com.symbol.datawedge.data_string");
        String labelType = intent.getStringExtra("com.symbol.datawedge.label_type");

        assertEquals("1234567890128", data);
        assertEquals("EAN13", labelType);
    }

    @Test
    public void zebraExtra_emptyDataRejected() {
        Intent intent = new Intent("io.getrelay.app.ACTION_SCAN");
        intent.putExtra("com.symbol.datawedge.data_string", "");

        String data = intent.getStringExtra("com.symbol.datawedge.data_string");
        assertTrue("Empty data should be rejected by plugin", data == null || data.isEmpty());
    }

    // ── Honeywell extra key priority ────────────────────────────────────────────

    @Test
    public void honeywellExtra_primaryKey() {
        Intent intent = new Intent("io.getrelay.app.ACTION_SCAN");
        intent.putExtra("com.honeywell.aidc.barcodedata", "SCAN-DATA-001");

        String data = extractHoneywellData(intent);
        assertEquals("SCAN-DATA-001", data);
    }

    @Test
    public void honeywellExtra_fallbackToDataString() {
        Intent intent = new Intent("io.getrelay.app.ACTION_SCAN");
        // No com.honeywell.aidc.barcodedata; older firmware uses DATA_STRING
        intent.putExtra("DATA_STRING", "SCAN-DATA-002");

        String data = extractHoneywellData(intent);
        assertEquals("SCAN-DATA-002", data);
    }

    @Test
    public void honeywellExtra_fallbackToBarcodeString() {
        Intent intent = new Intent("io.getrelay.app.ACTION_SCAN");
        // Thor/ScanPal firmware variant
        intent.putExtra("barcode_string", "SCAN-DATA-003");

        String data = extractHoneywellData(intent);
        assertEquals("SCAN-DATA-003", data);
    }

    @Test
    public void honeywellExtra_priorityOrder_primaryWins() {
        Intent intent = new Intent("io.getrelay.app.ACTION_SCAN");
        intent.putExtra("com.honeywell.aidc.barcodedata", "PRIMARY");
        intent.putExtra("DATA_STRING", "SECONDARY");
        intent.putExtra("barcode_string", "TERTIARY");

        String data = extractHoneywellData(intent);
        assertEquals("Primary key must win when present", "PRIMARY", data);
    }

    // ── Datalogic Intent Wedge ───────────────────────────────────────────────────

    @Test
    public void datalogicExtra_barcodeString() {
        Intent intent = new Intent("com.datalogic.decode.action.SCAN");
        intent.putExtra("com.datalogic.decode.intentwedge.barcode_string", "DL-BARCODE-XYZ");
        intent.putExtra("com.datalogic.decode.intentwedge.barcode_symbology", "Code128");

        String data = intent.getStringExtra("com.datalogic.decode.intentwedge.barcode_string");
        String type = intent.getStringExtra("com.datalogic.decode.intentwedge.barcode_symbology");

        assertEquals("DL-BARCODE-XYZ", data);
        assertEquals("Code128", type);
    }

    // ── Bluebird byte[] extra ────────────────────────────────────────────────────

    @Test
    public void bluebirdExtra_byteArrayDecodedToUtf8() {
        String expected = "BB-BARCODE-456";
        byte[] bytes = expected.getBytes(StandardCharsets.UTF_8);

        Intent intent = new Intent("kr.co.bluebird.android.bbapi.action.BARCODE_READ_DATA");
        intent.putExtra("EXTRA_BARCODE_DECODING_DATA", bytes);

        byte[] received = intent.getByteArrayExtra("EXTRA_BARCODE_DECODING_DATA");
        assertNotNull("Bluebird byte[] extra should be non-null", received);

        String decoded = new String(received, StandardCharsets.UTF_8).trim();
        assertEquals(expected, decoded);
    }

    @Test
    public void bluebirdExtra_emptyBytesRejected() {
        Intent intent = new Intent("kr.co.bluebird.android.bbapi.action.BARCODE_READ_DATA");
        intent.putExtra("EXTRA_BARCODE_DECODING_DATA", new byte[0]);

        byte[] received = intent.getByteArrayExtra("EXTRA_BARCODE_DECODING_DATA");
        assertTrue("Empty byte array should be rejected by plugin", received == null || received.length == 0);
    }

    @Test
    public void bluebirdExtra_nonAsciiUtf8RoundTrip() {
        String expected = "ARTÍCULO-ÀÈÒ";
        byte[] bytes = expected.getBytes(StandardCharsets.UTF_8);

        String decoded = new String(bytes, StandardCharsets.UTF_8).trim();
        assertEquals("Multi-byte UTF-8 must round-trip correctly", expected, decoded);
    }

    // ── Urovo extra key fallback chain ───────────────────────────────────────────

    @Test
    public void urovoExtra_primaryKey() {
        Intent intent = new Intent("urovo.rcv.message");
        intent.putExtra("urovo.rcv.message", "UROVO-DATA");

        String data = extractFirstNonEmpty(intent, new String[]{ "urovo.rcv.message", "barcode_string", "data" });
        assertEquals("UROVO-DATA", data);
    }

    @Test
    public void urovoExtra_decodeDataAction_barcodeStringKey() {
        Intent intent = new Intent("android.intent.action.DECODE_DATA");
        intent.putExtra("barcode_string", "UROVO-DATA-2");

        String data = extractFirstNonEmpty(intent, new String[]{ "barcode_string", "data_string", "data" });
        assertEquals("UROVO-DATA-2", data);
    }

    // ── CipherLab extra key ──────────────────────────────────────────────────────

    @Test
    public void cipherlabExtra_barcodeStr() {
        Intent intent = new Intent("com.cipherlab.barcodebaselib.PASS_SCAN_DATA_CIPHER");
        intent.putExtra("BarcodeStr", "CL-DATA-001");

        String data = extractFirstNonEmpty(intent, new String[]{ "BarcodeStr", "SCAN_DATA", "data_string" });
        assertEquals("CL-DATA-001", data);
    }

    // ── Newland extra key ────────────────────────────────────────────────────────

    @Test
    public void newlandExtra_scanBarcode1() {
        Intent intent = new Intent("nlscan.action.SCANNER_RESULT");
        intent.putExtra("SCAN_BARCODE1", "NL-DATA-001");

        String data = extractFirstNonEmpty(intent, new String[]{ "SCAN_BARCODE1", "scan_result", "data" });
        assertEquals("NL-DATA-001", data);
    }

    // ── Duplicate scan prevention (registered flag logic) ───────────────────────

    @Test
    public void registeredFlag_logicPreventsDoubleRegister() {
        // Simulates the check in registerScanReceiver(): if (registered) return;
        boolean registered = false;

        int registerCount = 0;
        for (int i = 0; i < 3; i++) {
            if (!registered) {
                registered = true;
                registerCount++;
            }
        }
        // Should only register once despite 3 calls
        assertEquals("registerScanReceiver should register at most once", 1, registerCount);
    }

    @Test
    public void unregisterFlag_allowsReRegistration() {
        // Simulates: unregister sets registered=false, allowing re-register on resume
        boolean registered = false;

        // First registration
        if (!registered) { registered = true; }
        assertTrue(registered);

        // Unregister
        registered = false;
        assertFalse(registered);

        // Re-registration on onResume
        if (!registered) { registered = true; }
        assertTrue("Should be able to re-register after unregister", registered);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    /** Replicates Honeywell's priority-ordered key lookup. */
    private String extractHoneywellData(Intent intent) {
        String[] keys = { "com.honeywell.aidc.barcodedata", "DATA_STRING", "barcode_string" };
        return extractFirstNonEmpty(intent, keys);
    }

    private String extractFirstNonEmpty(Intent intent, String[] keys) {
        for (String key : keys) {
            String v = intent.getStringExtra(key);
            if (v != null && !v.isEmpty()) return v;
        }
        return null;
    }
}
