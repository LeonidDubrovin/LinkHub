import { execSync } from "child_process";

delete process.env.ELECTRON_RUN_AS_NODE;
process.env.START_SERVER = "false";

execSync("electron .", { stdio: "inherit" });
