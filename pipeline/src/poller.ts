import type { FastifyBaseLogger } from "fastify";
import type { Config } from "./config.js";
import { jobLog } from "./log.js";

export function startPoller(config: Config, logger: FastifyBaseLogger): NodeJS.Timeout {
  const tick = (): void => {
    jobLog(logger, {}, "poll tick");
  };

  tick();
  return setInterval(tick, config.POLL_INTERVAL_MS);
}
