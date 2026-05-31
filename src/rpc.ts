export const DEFAULT_RPC_TIMEOUT_MS = 3_000;

export async function postJsonWithTimeout<T>(
  url: string,
  body: unknown,
  options: { timeoutMs?: number; errorPrefix?: string } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  const errorPrefix = options.errorPrefix ?? "RPC request";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${errorPrefix} failed: HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`${errorPrefix} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
