import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "electron/main.ts",
    server: "server.ts"
  },
  format: ["esm"],
  target: "node18",
  outDir: "dist-electron",
  clean: true,
  external: ["electron", "better-sqlite3", "express"],
});
