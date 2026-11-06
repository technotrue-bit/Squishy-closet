declare const process: { env: Record<string, string | undefined> };

import { defineConfig } from "vite";

// Squishy Closet dev server. Port 5183 so it never collides with Flag Catch (5181).
// Preview builds lock the full game from the moment they were built, with a test unlock (see src/unlock.ts). Only
// Vercel previews and the dev server: a production deploy or an app build (`npm run ios:sync`) never gets it.
export default defineConfig(({ command }) => ({
  define: {
    __TEST_BUILD__: JSON.stringify(command === "serve" || process.env.VERCEL_ENV === "preview"),
    __BUILT_AT__: JSON.stringify(Date.now()),
  },
  base: "./",
  server: { host: true, port: 5183, strictPort: true },
  preview: { host: true, port: 5183, strictPort: true },
}));
