/**
 * Generic per-path scheduling: debounces rapid triggers, and guarantees
 * only one run per path is in flight at a time. If a trigger arrives
 * mid-run, the path is marked dirty and re-scheduled once the current run
 * finishes, so the latest content still syncs without two runs racing.
 *
 * Deliberately knows nothing about uploads -- it just runs whatever
 * function it's given.
 */
export class UploadScheduler {
	private timers = new Map<string, ReturnType<typeof setTimeout>>();
	private inFlight = new Set<string>();
	private dirty = new Set<string>();

	constructor(
		private debounceMs: number,
		private run: (path: string) => Promise<void>
	) {}

	schedule(path: string): void {
		const existing = this.timers.get(path);
		if (existing) {
			clearTimeout(existing);
		}

		const timer = setTimeout(() => {
			this.timers.delete(path);
			this.execute(path);
		}, this.debounceMs);

		this.timers.set(path, timer);
	}

	/** Drops any pending or queued work for a path (e.g. it was deleted). */
	cancel(path: string): void {
		const existing = this.timers.get(path);
		if (existing) {
			clearTimeout(existing);
			this.timers.delete(path);
		}
		this.dirty.delete(path);
	}

	private async execute(path: string): Promise<void> {
		if (this.inFlight.has(path)) {
			this.dirty.add(path);
			return;
		}

		this.inFlight.add(path);
		try {
			await this.run(path);
		} catch (err) {
			console.error(`obsidian-sync: upload failed for ${path}`, err);
		} finally {
			this.inFlight.delete(path);
			if (this.dirty.delete(path)) {
				this.schedule(path);
			}
		}
	}
}