import { dispatchWatcherWorkflow, type DispatcherEnv } from "./dispatcher.js";

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface Logger {
  info(message: string, details: Record<string, unknown>): void;
  error(message: string, details: Record<string, unknown>): void;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function createScheduler(
  fetchImpl: typeof fetch = fetch,
  logger: Logger = console,
) {
  return {
    async scheduled(event: ScheduledEvent, env: DispatcherEnv): Promise<void> {
      try {
        const result = await dispatchWatcherWorkflow(env, fetchImpl);
        logger.info("Watcher workflow dispatched", {
          cron: event.cron,
          requestId: result.requestId,
          status: result.status,
        });
      } catch (error) {
        logger.error("Watcher workflow dispatch failed", {
          cron: event.cron,
          error: errorMessage(error),
        });
        throw error;
      }
    },
  };
}

export default createScheduler();
