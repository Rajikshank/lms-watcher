import {
  GitHubDispatchError,
  dispatchWatcherWorkflow,
  type DispatcherEnv,
} from "./dispatcher.js";

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface Logger {
  info(message: string, details: Record<string, unknown>): void;
  warn(message: string, details: Record<string, unknown>): void;
  error(message: string, details: Record<string, unknown>): void;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const isRetryable = (error: unknown): boolean =>
  error instanceof GitHubDispatchError ? error.retryable : true;

export function createScheduler(
  fetchImpl: typeof fetch = fetch,
  logger: Logger = console,
  waitImpl: (delayMs: number) => Promise<void> = wait,
) {
  return {
    async scheduled(event: ScheduledEvent, env: DispatcherEnv): Promise<void> {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const result = await dispatchWatcherWorkflow(env, fetchImpl);
          logger.info("Watcher workflow dispatched", {
            attempt,
            cron: event.cron,
            requestId: result.requestId,
            status: result.status,
          });
          return;
        } catch (error) {
          const retryable = isRetryable(error);
          if (!retryable || attempt === 3) {
            logger.error("Watcher workflow dispatch failed", {
              attempt,
              cron: event.cron,
              error: errorMessage(error),
            });
            throw error;
          }

          const delayMs = attempt * 1_000;
          logger.warn("Watcher workflow dispatch failed; retrying", {
            attempt,
            cron: event.cron,
            delayMs,
            error: errorMessage(error),
          });
          await waitImpl(delayMs);
        }
      }
    },
  };
}

export default createScheduler();
