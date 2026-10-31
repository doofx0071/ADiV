# AdiV Android app

This native Expo app shares the existing Convex backend and records with the AdiV web app. The web app remains available. The Android app is network-required and has no sign-in, matching the current single-bike setup.

## Local development

1. Keep `EXPO_PUBLIC_CONVEX_URL` in `mobile/.env.local`. It is copied from the root web app's `NEXT_PUBLIC_CONVEX_URL` and ignored by Git.
2. From this directory, run `bun run start` and scan the QR code with an Android development build. Because AdiV uses native notifications and photo selection, Expo Go is not the target runtime.
3. To build a development APK, run `bunx eas-cli build --platform android --profile development`.

## Previewing the mobile UI from VS Code

- The workspace recommends the Expo Tools extension. It adds Expo config IntelliSense and lets its debugger connect to a simulator or phone; it does not render the live app screen inside the editor.
- For live UI iteration, install the development APK once, start Metro with `bunx expo start --dev-client` from this directory, and open the project on the Android device from the displayed QR code. UI and JavaScript changes then reload without rebuilding the APK.
- The development APK and normal preview APK are separate from Expo Go. A new native build is needed only when changing native dependencies or native configuration.

## Internal preview APK

Run `bun run apk:preview` or `bunx eas-cli build --platform android --profile preview`. EAS internal distribution produces an APK for sideloading. Configure `EXPO_PUBLIC_CONVEX_URL` in the EAS build environment before building from the cloud. EAS project linking and Android signing are handled by the EAS CLI on first use.

## Implemented feature areas

- Dashboard, odometer updates, and quick logging for rides, fuel, service, and expenses
- Editable maintenance intervals with source notes, confirmed history, and guarded deletion
- Mixed history with edit and delete controls following the existing Convex mutation limits
- Six-month insights and expense/service category summaries
- Achievements, maintenance photo gallery, JSON backup, and per-domain CSV exports
- Device-local daily maintenance reminder and light/dark/system appearance preference
