/** Keep the secondary click action in the same window as Sigma's captor. */
export const NODE_DOUBLE_CLICK_TIMEOUT_MS = 300;

/** Selection stays synchronous; only the confirmed single-click intent waits. */
export class NodeClickArbitrator {
  private pending: ReturnType<typeof setTimeout> | undefined;

  schedule(confirm: () => void): void {
    this.cancel();
    this.pending = setTimeout(() => {
      this.pending = undefined;
      confirm();
    }, NODE_DOUBLE_CLICK_TIMEOUT_MS);
  }

  cancel(): void {
    clearTimeout(this.pending);
    this.pending = undefined;
  }
}
