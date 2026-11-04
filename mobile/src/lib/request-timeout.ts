export interface TimedAbortSignal {
  signal: AbortSignal;
  didTimeout(): boolean;
  dispose(): void;
}

/** Create an abort signal with a timeout and optional parent cancellation. */
export function createTimedAbortSignal(timeoutMs: number, parent?: AbortSignal): TimedAbortSignal {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parent?.reason);

  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}
