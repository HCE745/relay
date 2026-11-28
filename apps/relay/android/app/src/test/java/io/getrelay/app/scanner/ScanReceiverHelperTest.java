package io.getrelay.app.scanner;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import android.content.Context;
import android.content.Intent;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * ScanReceiverHelperTest — JVM tests for the scan broadcast validation utilities.
 *
 * Uses Robolectric so Android framework classes (Context, Intent) are available on
 * the JVM without a physical device or emulator.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class ScanReceiverHelperTest {

    // ── KNOWN_SCANNER_PACKAGES completeness ─────────────────────────────────────

    @Test
    public void zebraPackageIsInAllowlist() {
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.symbol.datawedge"));
    }

    @Test
    public void honeywellPackagesAreInAllowlist() {
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.honeywell.scanning.service"));
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.honeywell.aidc"));
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.honeywell.scanwedge"));
    }

    @Test
    public void datalogicPackagesAreInAllowlist() {
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.datalogic.decode"));
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.datalogic.scanservice"));
    }

    @Test
    public void phase4cPackagesAreInAllowlist() {
        // Urovo
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.urovo.scanservice"));
        // Unitech
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.unitech.scanservice"));
        // CipherLab
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.cipherlab.barcodebaselib"));
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.cipherlab.barcodeservice"));
        // Newland
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.newland.scanservice"));
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.nlscan.scanservice"));
        // Point Mobile
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.android.server.scannerservice"));
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.pointmobile.scanservice"));
        // Chainway
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.rscja.deviceapi"));
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("com.chainway.scanservice"));
        // Bluebird
        assertTrue(ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.contains("kr.co.bluebird.android.bbapi"));
    }

    @Test
    public void allowlistIsImmutable() {
        try {
            ScanReceiverHelper.KNOWN_SCANNER_PACKAGES.add("com.attacker.malware");
            fail("Expected UnsupportedOperationException for unmodifiable set");
        } catch (UnsupportedOperationException expected) {
            // correct
        }
    }

    // ── validateSender ────────────────────────────────────────────────────────────

    @Test
    public void validateSender_allowsKnownAction() {
        Context ctx = mock(Context.class);
        Intent intent = new Intent("io.getrelay.app.ACTION_SCAN");
        // Any valid action string should return true (server-side is real security boundary)
        boolean result = ScanReceiverHelper.validateSender(ctx, intent, "TEST");
        assertTrue("Known relay action should be allowed", result);
    }

    @Test
    public void validateSender_allowsVendorAction() {
        Context ctx = mock(Context.class);
        Intent intent = new Intent("com.symbol.datawedge.data_string");
        boolean result = ScanReceiverHelper.validateSender(ctx, intent, "TEST");
        assertTrue("Vendor-action broadcast should be allowed", result);
    }

    @Test
    public void validateSender_rejectsNullAction() {
        Context ctx = mock(Context.class);
        Intent intent = new Intent();  // null action
        boolean result = ScanReceiverHelper.validateSender(ctx, intent, "TEST");
        assertFalse("Intent with null action should be rejected", result);
    }

    // ── Relay action constant ─────────────────────────────────────────────────────

    @Test
    public void zebraActionScanConstant_isCorrect() {
        assertEquals("io.getrelay.app.ACTION_SCAN", ZebraDataWedgePlugin.ACTION_SCAN_INTENT);
    }
}
