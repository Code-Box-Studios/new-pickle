import { config } from "dotenv";
import { spawn } from "node:child_process";
import path from "node:path";

// Next loads .env.local; Prisma/Payload CLIs need the same precedence.
// Explicit process env wins, including the dedicated test database URLs.
config({ path: [".env.local", ".env"], quiet: true });
process.env.DIRECT_URL ||= process.env.DATABASE_URL;
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Provide a command to run");
const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, PATH: `${path.resolve("node_modules/.bin")}${path.delimiter}${process.env.PATH ?? ""}` },
  shell: process.platform === "win32",
});
child.on("error", () => { console.error(`Unable to start ${command}`); process.exitCode = 1; });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
