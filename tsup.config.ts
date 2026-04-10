import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { main: "electron/main.ts" },
    format: ["cjs"],
    target: "node18",
    outDir: "dist-electron",
    clean: false,
    external: ["electron"],
    dts: false,
    outExtension: () => ({ js: ".cjs" }),
  },
  {
    entry: { server: "server.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist-electron",
    clean: true,
    external: ["better-sqlite3", "express"],
    dts: false,
  },
]);
