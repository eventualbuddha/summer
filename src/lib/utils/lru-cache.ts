export class LruCache<K, V> {
	private readonly map = new Map<K, V>();

	constructor(private readonly maxSize: number) {}

	get(key: K): V | undefined {
		const value = this.map.get(key);
		if (value === undefined) return undefined;

		// Refresh key to mark it as most recently used
		this.map.delete(key);
		this.map.set(key, value);
		return value;
	}

	set(key: K, value: V): void {
		if (this.map.has(key)) {
			this.map.delete(key);
		}
		this.map.set(key, value);

		if (this.map.size > this.maxSize) {
			const firstKey = this.map.keys().next().value as K | undefined;
			if (firstKey !== undefined) {
				this.map.delete(firstKey);
			}
		}
	}

	get size(): number {
		return this.map.size;
	}

	clear(): void {
		this.map.clear();
	}
}
