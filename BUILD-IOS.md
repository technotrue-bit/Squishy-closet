# Aurora's World on iPhone and iPad

The app is the same game the site plays, wrapped in a native iOS shell with [Capacitor](https://capacitorjs.com).
The game's files are built into the app (`dist/` is copied into `ios/App/App/public`), so it plays offline and never
loads the game from a web address. The site and its Vercel deploy are untouched: Vercel still runs `npm run build` and
serves `dist/`; the `ios/` folder is only used by Xcode.

## What the app adds

- Taps you can feel on squishes and buttons (iPhone Safari has no vibration at all).
- A second copy of the save in the app's own settings store, so a collection survives if iOS clears web storage.
- Full screen: no status bar, the home bar fades while playing, and a swipe up from the bottom edge goes to the game
  first so sliding the squishy tray doesn't leave the app.
- Sounds follow the ring/silent switch, mix with the kid's own music, and pause when the app goes to the background.
- Portrait and landscape on iPhone, all four ways on iPad. The corner buttons keep clear of the notch in landscape.
- Share and move links made in the app point to `https://trueaigaming.com/play.html?id=squishy-closet`.
- Placeholder icon and launch screen (the pink squishy bun). Replace them before submitting (see below).

The code for all of this is in `src/native.ts`, `capacitor.config.ts` and `ios/App/App/` (`AppDelegate.swift`,
`SceneDelegate.swift`, `Info.plist`). On the web, `inApp()` is false and none of it runs.

## Placeholders to settle before the first upload

| What | Now | Where to change it |
| --- | --- | --- |
| Bundle ID | `com.trueaigaming.aurorasworld` | `capacitor.config.ts` (`appId`) and Xcode, App target, Signing & Capabilities. Apple never lets it change once the app is registered. |
| App name on the home screen | Aurora's World | `capacitor.config.ts` (`appName`) and `CFBundleDisplayName` in `ios/App/App/Info.plist` |
| Version | 1.0 (build 1) | Xcode, App target, General. Raise the build number for every upload. |
| App icon | Placeholder bun | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` — one 1024×1024 PNG, no transparency |
| Launch screen | Placeholder bun on pink | `ios/App/App/Assets.xcassets/Splash.imageset/` — 2732×2732, art kept in the middle 1000px |

## Build on a Mac

You need a Mac with the latest Xcode from the Mac App Store, and Node 20 or newer.

```sh
git clone https://github.com/technotrue-bit/squishy-closet.git
cd squishy-closet
npm ci
npm run ios:sync   # builds the game and copies it into the iOS project
npm run ios:open   # opens the project in Xcode
```

Run `npm run ios:sync` again after every change to the game. Xcode reads the Capacitor plugins straight from
`node_modules`, so `npm ci` has to have run before Xcode opens the project.

In Xcode:

1. Select the **App** target, then **Signing & Capabilities**. Turn on *Automatically manage signing* and pick your
   Team (a free Apple ID works for your own iPhone; TestFlight needs the paid program).
2. Plug in your iPhone, choose it at the top of the window, and press **Run** (▶). The first time, the iPhone asks you
   to trust the developer in Settings, General, VPN & Device Management.

## Build in the cloud (no Mac)

Any service with macOS build machines can build it: Codemagic, Ionic Appflow, Bitrise, or GitHub Actions on a macOS
runner. Each needs the Apple Developer Program and an App Store Connect API key to sign and upload. The build steps are
the same as above (`npm ci`, `npm run ios:sync`), then `xcodebuild archive` on `ios/App/App.xcodeproj`, scheme `App`.
None of these is set up yet.

## Send it to TestFlight

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) (paid yearly).
2. In [App Store Connect](https://appstoreconnect.apple.com), **Apps**, **+**, **New App**: platform iOS, the name, the
   bundle ID from above, and a SKU (any short code, like `aurorasworld`).
3. In Xcode, choose **Any iOS Device (arm64)** at the top, then **Product**, **Archive**.
4. When the Organizer opens, **Distribute App**, **App Store Connect**, **Upload**. Keep the default options.
5. After a few minutes the build shows in App Store Connect under **TestFlight**. Add yourself under *Internal Testing*.
   Export compliance is already answered in `Info.plist` (the app uses no custom encryption).
6. Install the **TestFlight** app on your iPhone and open the invite.

## Before submitting to the App Store

- **Category.** Kids or Games, not chosen yet. Kids means: no third-party ads or analytics (there are none now), and a
  grown-up check in front of anything that leaves the app or buys something. The "Share link" and "Copy link" buttons
  for squishy mail and moving to a new phone open the share sheet, so in Kids they need that check too.
- **Payments.** The app has no Ko-fi or other outside payment link: the site's tip link sits on the site's play page
  around the game, which the app doesn't include. Any tip jar or extras in the app must use Apple's in-app purchases.
  `canBuy()` in `src/native.ts` is the stub to build on; it returns false today.
- **Accounts.** The app has no sign-in and nothing leaves the device. If it ever offers the site's accounts or cloud
  saves, it needs Sign in with Apple next to any other sign-in, and a way to delete the account inside the app.
- **Privacy.** A privacy policy URL, and the App Privacy answers in App Store Connect (today: no data collected).
- **Store page.** Age rating questions, a description, and screenshots for 6.9" iPhone and 13" iPad.
- **Opening links in the app.** Squishy mail and move links open the website today. Making them open the app needs
  Universal Links: an `apple-app-site-association` file on trueaigaming.com and the Associated Domains capability.
