import { defineConfig } from "vite";

// Squishy Closet dev server. Port 5183 so it never collides with Flag Catch (5181).
export default defineConfig({
  base: "./",
  server: { host: true, port: 5183, strictPort: true },
  preview: { host: true, port: 5183, strictPort: true },
});
