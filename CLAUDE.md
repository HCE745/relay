@AGENTS.md

## Android / Capacitor

After every `npm run build` (or any change to web assets), run:

```
npx cap sync android
```

This copies the latest web output and plugin configuration into the Android project so the native build stays in sync with web changes. Skipping this step means the Android app may run stale code.
