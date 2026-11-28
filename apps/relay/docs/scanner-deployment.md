# Relay Scanner Deployment — IT Administrator Guide

This document describes how to configure industrial scanners to work with the Relay Android application. No physical scanner hardware was purchased during development; this guide is based on published vendor documentation.

---

## Overview

The Relay Android app receives scan data via **broadcast intents**. The scanner's intent wedge software must be configured to send scan results to the Relay app using one of two methods:

1. **Application-defined action** (recommended, works across all brands): `io.getrelay.app.ACTION_SCAN`
2. **Vendor-native action**: Each manufacturer has a default action; Relay also listens for those automatically.

The app does not modify scanner configuration. All scanner setup is performed by IT administrators using the scanner's configuration tool or MDM.

---

## Zebra DataWedge

**Devices**: TC52/TC57, TC72/TC77, MC33/MC93, EC30/EC50/EC55, PS20, ZD-series (printers), ZT-series

**Configuration tool**: DataWedge application (pre-installed on all Zebra devices)

### Steps

1. Open the **DataWedge** app on the device.
2. Tap the profile that applies to the Relay app (or create a new one for `io.getrelay.app`).
3. Under **Intent Output**, enable **Enabled**.
4. Set:
   - **Intent action**: `io.getrelay.app.ACTION_SCAN`
   - **Intent category**: *(leave blank)*
   - **Intent delivery**: **Broadcast intent**
5. Under **Associated Apps**, add `io.getrelay.app` if not already present.
6. Save the profile.

**Important**: Do not modify profiles belonging to other applications. Create a separate profile for Relay.

**Note on command-result intents**: The action `com.symbol.datawedge.api.RESULT_ACTION` carries DataWedge API command results, not scan data. The Relay app does not listen for or process this action.

**MDM configuration**: DataWedge profiles can be deployed via Zebra's OEMConfig or StageNow.

---

## Honeywell Scan Wedge

**Devices**: Dolphin CT60/CT40, CN80/CN75, EDA50/EDA52/EDA71, Thor VM1A/VM3A, ScanPal EDA series

**Configuration tool**: Honeywell Scan Wedge (Settings → Scan Wedge) or Honeywell Enterprise Browser

### Steps

1. On the device, go to **Settings → Honeywell Settings → Scan Wedge**.
2. Enable **Scan Wedge**.
3. Under **Intent Wedge**, set:
   - **Action name**: `io.getrelay.app.ACTION_SCAN`
   - **Category name**: *(leave blank)*
   - **Data extra name**: `com.honeywell.aidc.barcodedata`
   - **Type extra name**: `com.honeywell.aidc.labeltype`
   - **Broadcast intent**: enabled
4. Apply.

**Fallback**: Some older Honeywell firmware versions use `DATA_STRING` as the extra key name. Relay checks both automatically.

**MDM configuration**: Honeywell Scan Wedge settings can be deployed via Honeywell's OEMConfig or MDM managed configuration.

---

## Datalogic Intent Wedge

**Devices**: Memor 10/20/35, Skorpio X5, Falcon X4, Joya Touch

**Configuration tool**: ScanConfig (pre-installed) or Datalogic Settings

### Steps

1. Open **ScanConfig** or **Settings → Datalogic Settings → Scan Engine → Intent Wedge**.
2. Enable **Intent Wedge**.
3. The default action is `com.datalogic.decode.action.SCAN` — Relay listens for this automatically. No additional configuration is needed for the default action.
4. If using a custom action, set it to `io.getrelay.app.ACTION_SCAN` and set the barcode extra key to `com.datalogic.decode.intentwedge.barcode_string`.

**MDM configuration**: Deploy via Datalogic's OEMConfig.

---

## Urovo

**Devices**: DT40, i3200, i6200S, i6300, RT40, RT45

**Configuration tool**: ScanService or device Settings

### Steps

1. Open **Settings → ScanService** or the installed scanner configuration app.
2. Enable **Intent Output** and set:
   - **Action**: `io.getrelay.app.ACTION_SCAN`
   - **Data extra**: `barcode_string` or `urovo.rcv.message` (device-dependent — Relay checks both)
   - **Mode**: Broadcast

Alternatively, Urovo devices configured in keyboard-wedge mode will work automatically without any intent configuration.

---

## Unitech

**Devices**: HT330, EA320, EA502G, MT735, PA760, PA768

**Configuration tool**: ScanService in device Settings

### Steps

1. Open **Settings → ScanService → Intent Output**.
2. Enable and set:
   - **Action**: `io.getrelay.app.ACTION_SCAN`
   - **Extra key**: `text`
   - **Type**: Broadcast

Relay also listens for `unitech.scanservice.data` automatically.

---

## CipherLab

**Devices**: RK25, RS35, RS51, RS56, RS36, 9700

**Configuration tool**: CipherLab BarcodeBase app or Settings

### Steps

1. Open **BarcodeBase** (or Settings → Scanner → Intent Output).
2. Enable **Intent Output** and set:
   - **Action**: `io.getrelay.app.ACTION_SCAN`
   - **Extra key (data)**: `BarcodeStr` or `SCAN_DATA`
   - **Delivery**: Broadcast

Relay also listens for `com.cipherlab.barcodebaselib.PASS_SCAN_DATA_CIPHER` automatically.

---

## Newland (NLS)

**Devices**: N5, N7, N10, MT90, MT65, NFT10

**Configuration tool**: ScanService or Settings → Scanner Configuration

### Steps

1. Open **Settings → Scanner Configuration → Intent Output**.
2. Enable and set:
   - **Action**: `io.getrelay.app.ACTION_SCAN` or leave at the default `nlscan.action.SCANNER_RESULT`
   - **Extra key**: `SCAN_BARCODE1` (default) or `scan_result`
   - **Type**: Broadcast

Relay listens for both Newland default actions automatically.

---

## Point Mobile

**Devices**: PM30, PM45, PM67, PM85, PM90, PM200

**Configuration tool**: ScanService in Settings

### Steps

1. Open **Settings → ScanService**.
2. Enable **Intent Output** with:
   - **Action**: `com.android.server.scannerservice.broadcast` (Relay listens for this automatically)
   - Or set a custom action: `io.getrelay.app.ACTION_SCAN`
   - **Extra key**: `scan_data` or `barcodeData`

---

## Chainway

**Devices**: C66, C72, C80, C3000, N6, N7

**Configuration tool**: Device Settings or the HF/UHF scanning app

### Steps

Chainway devices configured for intent output use `com.rscja.deviceapi.action.BARCODE` by default — Relay listens for this automatically.

For a custom action, set to `io.getrelay.app.ACTION_SCAN` with extra key `value`.

---

## Bluebird

**Devices**: EF501, EF521, EF551, EF401, EF400

**Configuration tool**: Device Settings → Scanner Settings → Intent Output

### Steps

Bluebird delivers scan data as a byte array via `kr.co.bluebird.android.bbapi.action.BARCODE_READ_DATA` — Relay listens for this automatically.

For a custom intent, set action to `io.getrelay.app.ACTION_SCAN` with the barcode string in one of the standard extra keys (`barcode_string`, `data`).

---

## Keyboard Wedge Fallback

If your scanner is configured in **keyboard-wedge mode** (emulates keyboard input), the Relay app automatically detects scan events using timing-based detection:

- Characters arriving in bursts < 30 ms apart are treated as scanner input
- Entry terminated by Enter or carriage-return is emitted as a scan
- Configure any prefix/suffix in the Relay app settings if your scanner sends them

**Limitation**: Timing-based detection can mis-fire on fast typists or under CPU load. For reliable operation, intent-based delivery (above) is strongly preferred for production deployments.

For even more reliability, use the **Focused Scanner Field** in the Relay badge enrollment UI — a dedicated input that the scanner fills directly, bypassing timing heuristics entirely.

---

## Camera Scanning

The Relay app supports camera-based scanning of QR codes and barcodes (Code 128, Code 39, Data Matrix, PDF417, UPC-A/E, EAN-8/13, ITF) on any Android device with a camera. No scanner hardware is required. This is the fallback mode for devices without a built-in scanner.

---

## Android Requirements

- **Minimum Android version**: 7.0 (API 24)
- **Target Android version**: 16 (API 36)
- **Camera permission**: required for camera scanning; optional if using hardware scanner
- **GMS (Google Play Services)**: not required — the app functions on AOSP and GMS-less devices
- **MDM compatibility**: Relay has no MDM SDK dependency; all configuration is via standard Android intent mechanisms

---

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| Scans not received | Intent wedge not enabled | Enable intent output in scanner settings |
| Scans received twice | Both native plugin and keyboard-wedge fired | Disable keyboard-wedge on the device scanner config |
| Wrong data received | Extra key mismatch | Match the extra key name to the brand's default (see above) |
| No scan on first use | Broadcast receiver not yet registered | Ensure app has fully loaded before scanning |
| Scans stop after suspend | Activity lifecycle | Restart the app; receiver is re-registered on resume |
