// Public directory reads are safe to retry. Always bound the whole request,
// including JSON decoding, and distinguish superseded searches from timeouts.
export async function directoryRequest<T>(
  url: string,
  init: RequestInit,
  validate: (value: unknown) => T,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 1;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (init.signal?.aborted) cancel();
    else init.signal?.addEventListener("abort", cancel, { once: true });
    const signal = controller.signal;
    const timer = setTimeout(cancel, options.timeoutMs ?? 15000);
    let retryable = false;
    let onAbort: (() => void) | undefined;
    try {
      // The race also bounds decoding and fetch implementations which ignore signals.
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () =>
          reject(new Error("The request took too long. Please try again."));
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });
      return await Promise.race([
        (async () => {
          let response: Response;
          try {
            response = await fetch(url, { ...init, signal });
          } catch (error) {
            retryable = !signal.aborted;
            throw error;
          }
          retryable = [502, 503, 504].includes(response.status);
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(
              body?.error ||
                "Results are temporarily unavailable. Please try again.",
            );
          }
          try {
            return validate(await response.json());
          } catch {
            throw new Error("Results could not be read. Please try again.");
          }
        })(),
        aborted,
      ]);
    } catch (error) {
      if (signal.aborted || !retryable || attempt >= retries) throw error;
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", cancel);
      if (onAbort) signal.removeEventListener("abort", onAbort);
    }
    // Keep retries bounded and stop immediately when the search changes.
    if (init.signal?.aborted) throw new Error("Search cancelled");
  }
}
