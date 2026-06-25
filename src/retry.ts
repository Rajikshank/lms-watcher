type RetryOptions = {
  attempts?: number;
  delayMs?: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  label: string,
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 2_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      console.warn(`${label} failed on attempt ${attempt}/${attempts}: ${errorMessage(error)}. Retrying...`);
      await wait(delayMs);
    }
  }

  throw new Error(`${label} failed after ${attempts} attempts: ${errorMessage(lastError)}`);
}
