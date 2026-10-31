# Selling the full game

Aurora's World is free to start. One purchase opens the full game. This file is how it works today and the choices for
hooking up real payment.

## What's free and what the full game adds

| | Free | Full game |
| --- | --- | --- |
| Places | Tea Table, Sunny Beach | + Sailing Boat, Living Room, Little City |
| Squishies in boxes and naps | Matte and shiny ones (30), Halloween Specials from Spooky Boxes | + every glitter, glow and gold one (36 more) |
| Hats | Everything except the hats friends find in the locked places | All of them |

What a kid already has is never taken away. A squishy that arrives as squishy mail from a friend is kept even if it's a
sparkly one. Change the split in `src/unlock.ts`: `FREE_PLACES` and `inFreeGame()`.

## How it works in the code

- `src/unlock.ts` holds the one check, `hasFull()`. Everything that locks asks it: the Places sheet, boxes, Spooky
  Boxes, baby naps and the Squishy Book.
- An unlock is kept under `squishycloset.unlock` on the device. The site's save copy and the app's settings copy keep it
  too, because they keep every `squishycloset.*` key.
- `src/payments.ts` is where a real payment plugs in. It has one `Shop` shape (`ready`, `price`, `buy`, `restore`) and
  two empty slots, `apple` and `web`. Both say "not ready" today.
- Locked places, the Book's ✨ marks and **Settings → Grown-ups → Full game** lead to a grown-up check (a times question
  in words, answered by typing the number), then the full game screen. That screen has Unlock, Restore purchase and the
  "one payment, no subscription, no ads" note. Kids never see a price or a buy button before the check. There are no
  timers, no nagging and no "ask your parents" prompts.

## Nothing is locked live yet

`SELLING_FROM` in `src/unlock.ts` is `null`, so the live site and app builds lock nothing. Merging this changes nothing
for players.

**Preview builds** (Vercel previews and `npm run dev`) lock from the moment they were built. That way the locks and the
full game screen can be tried. The screen also has a **Test unlock** button there, and "Lock it again" to go back. A
test unlock never counts outside a preview build.

**To start selling:**

1. Hook up a payment (below) and fill in `apple` or `web` in `src/payments.ts`.
2. Set `SELLING_FROM` to the moment that build ships, e.g. `Date.UTC(2026, 11, 1)`. Never set it earlier than the
   release. Anyone who found a squishy before `SELLING_FROM` is an early friend and keeps the whole game. This is worked
   out from when their squishies were found, so it also follows a move to a new phone.

## Hooking up payment: the choices

### In the iPhone and iPad app: Apple in-app purchase (required)

Apple requires its own in-app purchase for unlocking content in an iOS app. Make one **non-consumable** product in App
Store Connect, e.g. `com.trueaigaming.aurorasworld.fullgame` (matches the placeholder bundle id). This needs the paid
Apple Developer Program and the Paid Apps agreement, banking and tax set up there. Apple's
[Small Business Program](https://developer.apple.com/app-store/small-business-program/) takes 15% instead of 30% under
$1M a year, but you have to sign up for it.

Two ways to talk to StoreKit from this Capacitor app:

- **cordova-plugin-purchase** ([docs](https://purchase.cordova.fovea.cc), the plugin
  [Capacitor's own guide](https://capacitorjs.com/docs/guides/in-app-purchases) uses). Free and open source. Works on
  the device alone, which is fine for one non-consumable. Server receipt checks are optional, through Fovea's paid
  validator.
- **RevenueCat** (`@revenuecat/purchases-capacitor`). A hosted service that checks receipts and tracks who owns what.
  Free until about $2,500 of tracked revenue a month, then a small cut (check their pricing page). Its advantage: one
  "full game" owner list across the app and the web, if the site also sells through it.

Either fills the same three calls: `price()` from the product, `buy()` starts Apple's sheet (Apple asks for Face ID or
the password itself), `restore()` asks Apple for past purchases. In the Kids category, Apple's parental gate rule is
already covered by the grown-up check.

### On the website: a web payment

The game on trueaigaming.com runs inside the play page, which already has TrueAIGaming accounts (13 and up, so a
grown-up's account). Options, simplest first:

- **Stripe Checkout tied to the TrueAIGaming account (recommended).** The play page, not the game, opens Stripe's
  hosted checkout. A webhook marks the grown-up's account as owning the full game. The play page then tells the game
  through the same message channel the save copy already uses, and the game writes `how: "web"`. Restore on the web
  means signing in on the play page. This needs work in the trueaigaming repo (a checkout endpoint, a webhook, one new
  message). Stripe's standard card fee in the US is a few percent per sale (check current rates). You'd handle sales tax
  yourself, or turn on Stripe Tax.
- **A merchant of record (Lemon Squeezy, Paddle).** They sell for you and handle sales tax and VAT worldwide for a
  higher cut. Same wiring as Stripe, or a license code the grown-up pastes in.
- **RevenueCat web purchases.** Only worth it if the app uses RevenueCat too, so one purchase can count in both places.

Avoid Ko-fi or a hand-sent code for this: nothing in the game could check it, and the full game would leak.

### Things to settle

- The price. One price for the app and the site is simplest. Apple sets app prices by tiers.
- Whether one purchase should count in both the app and on the site (needs accounts or RevenueCat on both).
- Kids or Games category for the app (BUILD-IOS.md).
