# Selling the full game

Aurora's World is free to start in the iPhone and iPad app. One Apple in-app purchase opens the full game. The
website stays fully open. This file says how it works and what to set up with Apple.

## What's free and what the full game adds

| | Free | Full game |
| --- | --- | --- |
| Places | Living Room, Sunny Beach (new players in the free game start in Living Room) | + Tea Table, Sailing Boat, Little City |
| Squishies in boxes and naps | Matte and shiny ones (30), Halloween Specials from Spooky Boxes | + every glitter, glow and gold one (36 more) |
| Hats | Everything except the hats friends find in the locked places | All of them |

What a kid already has is never taken away. A squishy that arrives as squishy mail from a friend is kept even if it's a
sparkly one. Change the split in `src/unlock.ts`: `FREE_PLACES` and `inFreeGame()`.

## Where it's sold

Only in the iPhone and iPad app, through Apple's in-app purchase. **The website sells nothing and locks nothing:** every
place and squishy stays open there. Previews of the website (Vercel preview builds) do show the locks, with a Test
unlock, only so the screens can be tried.

## How it works in the code

- `src/unlock.ts` holds the one check, `hasFull()`. Everything that locks asks it: the Places sheet, boxes, Spooky
  Boxes, baby naps and the Squishy Book.
- An unlock is kept under `squishycloset.unlock` on the device. The app's settings copy keeps it too, because it keeps
  every `squishycloset.*` key.
- `src/apple.ts` is the Apple purchase. It uses [cordova-plugin-purchase](https://purchase.cordova.fovea.cc), the
  plugin [Capacitor's own guide](https://capacitorjs.com/docs/guides/in-app-purchases) uses. It's free, with no service
  or account beyond Apple. `npm run ios:sync` adds it to the Xcode project (it's in `ios/App/CapApp-SPM/Package.swift`).
  It sells one **non-consumable** product, `com.trueaigaming.aurorasworld.fullgame` (`PRODUCT_ID`). Apple's own record
  on the device says who owns it, and Restore purchase asks Apple again. There's no server.
- With Ask to Buy, a parent may approve later on their own phone. The game opens up whenever Apple says yes, even after
  the app was closed.
- `src/payments.ts` picks the shop: Apple in the app, nothing on the web.
- Locked places, the Book's ✨ marks and **Settings → Grown-ups → Full game** (only shown where things are locked) lead
  to a grown-up check (a times question in words, answered by typing the number), then the full game screen. That
  screen shows Apple's price, Unlock, Restore purchase and the "one payment, no subscription, no ads" note. The price on the button comes from Apple in the buyer's own money ("Unlock for $2.99"). If Apple gives no price, the button reads "Unlock the full game" (and "Coming soon" if the store can't be reached), so no price is written into the game. Kids never
  see a price or a buy button before the check. That covers Apple's parental gate rule for the Kids category. There
  are no timers, no nagging and no "ask your parents" prompts.

## Nothing is locked yet

`SELLING_FROM` in `src/unlock.ts` is `null`, so app builds lock nothing. Merging this changes nothing for anyone.

## What you set up with Apple (before selling)

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) (paid yearly), and sign up for the
   [Small Business Program](https://developer.apple.com/app-store/small-business-program/) so Apple takes 15% instead
   of 30% (under $1M a year).
2. In [App Store Connect](https://appstoreconnect.apple.com), **Business**: accept the Paid Apps agreement and add your
   bank and tax details. Purchases don't work, even in testing, until this is done.
3. Create the app (bundle id from `capacitor.config.ts`, BUILD-IOS.md has the steps).
4. In the app, **Monetization → In-App Purchases → +**: type **Non-Consumable**, product id
   `com.trueaigaming.aurorasworld.fullgame` (or change `PRODUCT_ID` in `src/apple.ts` to match yours), a reference name
   like "Full game", the price **$2.99** (US; Apple fills in the matching price in other countries), and a display name and description, e.g. "Full Game: every place and every sparkly
   squishy". Add a review screenshot of the full game screen.
5. In Xcode, App target, **Signing & Capabilities → + Capability → In-App Purchase**.
6. Testing: in App Store Connect, **Users and Access → Sandbox** to make a test Apple Account. On the iPhone, sign in
   to it under Settings → Developer (or App Store) → Sandbox Account. TestFlight builds buy for free with your own
   account.
7. Set `SELLING_FROM` in `src/unlock.ts` to the moment the first selling build goes out, e.g. `Date.UTC(2026, 11, 1)`,
   then `npm run ios:sync` and build. Anyone who found a squishy before then (on the site, moved over with a move link)
   keeps the whole game. Never set it earlier than that build.
8. Submit the in-app purchase with the app version for review (it goes in the same submission the first time).

## Later

- Selling on the website would need a web payment (Stripe Checkout tied to the TrueAIGaming account is the simplest
  fit) and turning the locks on there. Not planned for now.
- If the app and site ever share one purchase, RevenueCat (`@revenuecat/purchases-capacitor`) could keep one owner
  list for both. It needs its own account.
