import { spawn } from "node:child_process";

const processes = [];

function run(name, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env }
  });
  processes.push(child);
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });
}

function shutdown(code = 0) {
  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting Momentra API on http://localhost:4000");
run("api", process.execPath, ["server/src/index.js"], {
  PORT: process.env.PORT ?? "4000",
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:5173"
});

console.log("Starting Momentra web app on http://localhost:5173");
run("web", process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "--host", "0.0.0.0", "--port", "5173"], {
  VITE_API_URL: process.env.VITE_API_URL ?? "http://localhost:4000"
});
