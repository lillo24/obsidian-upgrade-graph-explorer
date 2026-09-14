export interface OpenAiSessionCredentialState {
  readonly configured: boolean;
  readonly activeExecutionCount: number;
}

type ExecutionCancellation = (reason: string) => void;

/**
 * Owns the OpenAI API key for one app/WebView lifetime.
 *
 * The key deliberately has no serializable public representation. Provider
 * executions receive it through the narrow `readForExecution` method only.
 */
export class OpenAiSessionCredentials {
  readonly #listeners = new Set<() => void>();
  readonly #activeExecutions = new Set<ExecutionCancellation>();
  #apiKey: string | undefined;
  #state: OpenAiSessionCredentialState = {
    configured: false,
    activeExecutionCount: 0,
  };

  public readonly snapshot = (): OpenAiSessionCredentialState => this.#state;

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  public set(apiKey: string): void {
    const trimmed = apiKey.trim();
    if (trimmed.length === 0) {
      throw new Error('Enter a non-empty OpenAI API key.');
    }
    if (this.#apiKey !== undefined) {
      this.#cancelActive('OpenAI session API key was replaced.');
    }
    this.#apiKey = trimmed;
    this.#notify();
  }

  public clear(): void {
    this.#cancelActive('OpenAI session API key was cleared.');
    this.#apiKey = undefined;
    this.#notify();
  }

  /** Application adapter boundary; never expose this value in UI state. */
  public readForExecution(): string | undefined {
    return this.#apiKey;
  }

  /** Registers one isolated provider cancellation without retaining run data. */
  public registerExecution(cancel: ExecutionCancellation): () => void {
    this.#activeExecutions.add(cancel);
    this.#notify();
    return () => {
      if (this.#activeExecutions.delete(cancel)) this.#notify();
    };
  }

  #cancelActive(reason: string): void {
    for (const cancel of [...this.#activeExecutions]) cancel(reason);
  }

  #notify(): void {
    const next = {
      configured: this.#apiKey !== undefined,
      activeExecutionCount: this.#activeExecutions.size,
    };
    if (
      next.configured === this.#state.configured &&
      next.activeExecutionCount === this.#state.activeExecutionCount
    ) {
      return;
    }
    this.#state = next;
    this.#listeners.forEach((listener) => listener());
  }
}
