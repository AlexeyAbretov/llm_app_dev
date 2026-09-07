import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3020),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  GITHUB_TOKEN: z.string().default(""),
  GITHUB_REPO: z.string().default(""),
  CURSOR_API_KEY: z.string().default(""),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(env);
}
