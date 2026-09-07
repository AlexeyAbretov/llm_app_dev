import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { JobStore } from "./jobs.js";
import { startPoller } from "./poller.js";

const config = loadConfig();
const store = new JobStore(config.DATA_DIR);

const app = Fastify({
  logger: {
    level: "info",
  },
});

app.get("/health", async () => ({ status: "ok" }));

const poller = startPoller(config, app.log, store);

const shutdown = async (): Promise<void> => {
  poller.stop();
  await app.close();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

await app.listen({ port: config.PORT, host: "0.0.0.0" });
