# Publishing Dropout Copilot as Web + Store Apps

This project is PWA-ready. Follow these steps to ship to Play Store (Trusted Web Activity) and App Store (Capacitor wrapper).

## 1) Prereqs
- Live HTTPS site (Render/Vercel). Note the exact origin (e.g., `https://yourapp.onrender.com`).
- Node 18+ locally for build tooling.
- Android: JDK 17, Android SDK/CLI; Google Play Console account.
- iOS: Xcode + Apple Developer account.

## 2) Verify PWA quality
- Run Lighthouse → PWA; ensure “Installable” and “Offline capable” pass.
- Manifest served at `/manifest.json`, SW at `/service-worker.js`, icons OK.
- `start_url` and `scope` = `/`.

## 3) Android (Play Store) via Trusted Web Activity
1. Install Bubblewrap:
   ```bash
   npm i -g @bubblewrap/cli
   ```
2. Generate project:
   ```bash
   bubblewrap init --manifest=https://YOUR_ORIGIN/manifest.json
   ```
   - App id example: `com.yourorg.dropoutcopilot`
   - Name/short name from manifest.
3. Signing:
   ```bash
   keytool -genkey -v -keystore signing-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias twa
   bubblewrap build
   ```
4. Host Digital Asset Links:
   - Copy `frontend/public/.well-known/assetlinks.template.json` to `.well-known/assetlinks.json`.
   - Replace `package_name` and `sha256_cert_fingerprints` with your release key SHA256 (from `keytool -list -v -keystore signing-key.jks`).
   - Deploy so it’s served at `https://YOUR_ORIGIN/.well-known/assetlinks.json`.
5. Upload the generated `.aab` to Play Console (Internal testing → Closed → Production).

## 4) iOS (App Store) via Capacitor
1. Add Capacitor to this project (outside repo if you prefer):
   ```bash
   npm install --save-dev @capacitor/cli
   npm install @capacitor/core
   npx cap init "Dropout Copilot" "com.yourorg.dropoutcopilot"
   ```
2. Build web assets:
   ```bash
   npm run build
   npx cap add ios
   npx cap copy ios
   ```
3. Open `ios/App/App.xcworkspace` in Xcode:
   - Set signing team, bundle id, icons, splash.
   - In `Info.plist`, allow networking to your backend host (ATS exceptions only if needed).
4. Test on device/simulator; archive and upload via Transporter.

## 5) Optional: Android wrapper via Capacitor (instead of TWA)
Same as iOS but `npx cap add android`, then build/sign `.aab` with Android Studio.

## 6) Ongoing
- When you rotate signing keys, update assetlinks.json.
- Keep `start_url`/`scope` consistent with your origin if you move domains.
- Update service worker cache version on releases to avoid stale assets.

## File references
- Manifest: `frontend/public/manifest.json`
- Service worker: `frontend/public/service-worker.js`
- Asset Links template: `frontend/public/.well-known/assetlinks.template.json`
