// One owner for a loading/run scope. Late async resources are disposed immediately.
export class DisposalScope {
  private closed = false;
  private readonly releases: (() => void)[] = [];
  defer(release: () => void) {
    if (this.closed) {
      release();
      return;
    }
    this.releases.push(release);
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    const errors: unknown[] = [];
    for (const release of this.releases.reverse()) {
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    }
    this.releases.length = 0;
    if (errors.length)
      throw new AggregateError(errors, "Failed to release game resources");
  }
}
