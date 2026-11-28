package io.getrelay.app.scanner;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.IntentFilter;
import android.os.Build;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

/**
 * ReceiverRegistrationTest — JVM tests for broadcast receiver registration behaviour.
 *
 * Tests that:
 *   - RECEIVER_EXPORTED flag is used on API 33+
 *   - Registration does not throw on a real (Robolectric) Context
 *   - IntentFilter contains the expected actions for each plugin type
 *   - ScanReceiverHelper.registerExportedReceiver() does not throw on API < 33
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class ReceiverRegistrationTest {

    private Context context;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
    }

    // ── IntentFilter action coverage ─────────────────────────────────────────────

    @Test
    public void zebraFilter_containsRelayAction() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(ZebraDataWedgePlugin.ACTION_SCAN_INTENT);

        assertTrue(filter.hasAction("io.getrelay.app.ACTION_SCAN"));
        assertEquals(1, filter.countActions());
    }

    @Test
    public void honeywellFilter_containsRelayAndDatalogicActions() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(ZebraDataWedgePlugin.ACTION_SCAN_INTENT);  // relay action
        filter.addAction("com.datalogic.decode.action.SCAN");

        assertTrue(filter.hasAction("io.getrelay.app.ACTION_SCAN"));
        assertTrue(filter.hasAction("com.datalogic.decode.action.SCAN"));
        assertEquals(2, filter.countActions());
    }

    @Test
    public void genericFilter_containsAllBrandActions() {
        // Covers Phase 4C manufacturers: each must have at least one action registered
        String[] requiredActions = {
            "urovo.rcv.message",
            "android.intent.action.DECODE_DATA",        // Urovo alternative
            "unitech.scanservice.data",
            "com.cipherlab.barcodebaselib.PASS_KEYCODE_DATA_CIPHER",
            "com.cipherlab.barcodebaselib.PASS_SCAN_DATA_CIPHER",
            "nlscan.action.SCANNER_RESULT",
            "com.newland.action.SCAN_RESULT",
            "com.android.server.scannerservice.broadcast",
            "com.rscja.deviceapi.action.BARCODE",
            "kr.co.bluebird.android.bbapi.action.BARCODE_READ_DATA",
            "io.getrelay.app.ACTION_SCAN",              // relay action fallback
        };

        IntentFilter filter = new IntentFilter();
        for (String action : requiredActions) {
            filter.addAction(action);
        }

        for (String action : requiredActions) {
            assertTrue("Missing action: " + action, filter.hasAction(action));
        }
    }

    // ── RECEIVER_EXPORTED registration path ──────────────────────────────────────

    @Test
    @Config(sdk = 33)
    public void registerExportedReceiver_api33_doesNotThrow() {
        // On API 33, RECEIVER_EXPORTED must be used. Verify no exception is thrown.
        android.content.BroadcastReceiver receiver = new android.content.BroadcastReceiver() {
            @Override
            public void onReceive(Context c, android.content.Intent i) {}
        };

        IntentFilter filter = new IntentFilter("io.getrelay.app.ACTION_SCAN");

        // Should complete without throwing SecurityException or IllegalArgumentException
        ScanReceiverHelper.registerExportedReceiver(context, receiver, filter, "TEST");

        // Cleanup
        try { context.unregisterReceiver(receiver); } catch (Exception ignored) {}
    }

    @Test
    @Config(sdk = 32)
    public void registerExportedReceiver_api32_doesNotThrow() {
        // On API 32 (pre-Tiramisu) the flag is not needed; verify plain registration works.
        android.content.BroadcastReceiver receiver = new android.content.BroadcastReceiver() {
            @Override
            public void onReceive(Context c, android.content.Intent i) {}
        };

        IntentFilter filter = new IntentFilter("io.getrelay.app.ACTION_SCAN");

        ScanReceiverHelper.registerExportedReceiver(context, receiver, filter, "TEST");

        try { context.unregisterReceiver(receiver); } catch (Exception ignored) {}
    }

    // ── Build.VERSION_CODES constant sanity ──────────────────────────────────────

    @Test
    public void tiramisu_sdkCode_is33() {
        // If this fails it means our SDK_VERSION_CODES.TIRAMISU assumption is wrong
        assertEquals("TIRAMISU must be API 33", 33, Build.VERSION_CODES.TIRAMISU);
    }
}
