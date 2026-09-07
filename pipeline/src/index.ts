import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { startPoller } from "./poller.js";

const config = loadConfig();

const app = Fastify({
  logger: {
    level: "info",
  },
});

app.get("/health", async () => ({ status: "ok" }));

const poller = startPoller(config, app.log);

const shutdown = async (): Promise<void> => {
  clearInterval(poller);
  await app.close();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

await app.listen({ port: config.PORT, host: "0.0.0.0" });
