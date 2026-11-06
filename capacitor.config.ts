import type { CapacitorConfig } from "@capacitor/cli";

// The iPhone and iPad app. It plays the same game the site does, built into the app (dist/) so it works offline.
// It never loads the game from a web address. See BUILD-IOS.md.
const config: CapacitorConfig = {
  // Placeholder: change before registering the app with Apple. Apple never lets it change once the app is listed.
  appId: "com.trueaigaming.aurorasworld",
  appName: "Aurora's World",
  webDir: "dist",
  backgroundColor: "#ffc6df",
  ios: {
    // The game fits itself around the notch and home bar with the CSS safe-area insets.
    contentInset: "never",
    backgroundColor: "#ffc6df",
    // No pull-to-bounce, no link previews on a long press: it should feel like a game, not a web page.
    scrollEnabled: false,
    allowsLinkPreview: false,
  },
};

export default config;
