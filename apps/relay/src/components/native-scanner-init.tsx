"use client"

import { useEffect } from "react"
import { initNativeScannerBridge, cleanupNativeScannerBridge } from "@/lib/native-scanner-bridge"

export function NativeScannerInit() {
  useEffect(() => {
    void initNativeScannerBridge()
    return () => { cleanupNativeScannerBridge() }
  }, [])
  return null
}
