# Succulent Zen

Succulent Zen is a small iOS-ready Capacitor game built with React and Vite.

## iOS Production Settings

- App Store Connect app name: `succulent-zen`
- Installed app name: `Succulent Zen`
- Bundle ID: `com.michalskurnik.succulentzen`
- Apple Developer Team: `Michal Skurnik`
- Team ID: `625D5JMD26`
- Version: `1.0.0`
- Current iOS build string: `5`

## Local Build

```sh
npm install
npm run build
npx cap sync ios
npx cap open ios
```

## App Store Notes

- The iOS app uses Google AdMob rewarded ads.
- `Info.plist` includes the AdMob app ID, the App Tracking Transparency purpose string, the SKAdNetwork identifiers recommended by Google, and `ITSAppUsesNonExemptEncryption = NO`.
- The current uploaded App Store build is `1.0.0 (5)`.
- App Store Connect privacy labels, age rating, screenshots, category, support URL, privacy policy URL, and review notes still need to be completed in App Store Connect for each submission.

Do not commit or share private signing keys, App Store Connect API keys, `.p8` files, provisioning profiles, or local build archives.
