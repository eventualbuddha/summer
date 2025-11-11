/**
 * Simple iterator utilities to replace @nfnitloop/better-iterators
 * This avoids dependency on JSR packages that cause firewall issues.
 */

interface RangeOptions {
	from: number;
	to: number;
	inclusive?: boolean;
}

class SyncIteratorWrapper<T> {
	constructor(private iterable: Iterable<T>) {}

	toAsync(): AsyncIteratorWrapper<T> {
		return new AsyncIteratorWrapper(this.iterable);
	}

	toArray(): T[] {
		return Array.from(this.iterable);
	}
}

class AsyncIteratorWrapper<T> {
	constructor(private iterable: Iterable<T> | AsyncIterable<T>) {}

	map<U>(fn: (value: T) => Promise<U>): AsyncIteratorWrapper<U> {
		const iterable = this.iterable;
		async function* mappedIterator() {
			for await (const value of iterable as AsyncIterable<T>) {
				yield await fn(value);
			}
		}
		return new AsyncIteratorWrapper(mappedIterator());
	}

	async toArray(): Promise<T[]> {
		const results: T[] = [];
		for await (const value of this.iterable as AsyncIterable<T>) {
			results.push(value);
		}
		return results;
	}
}

/**
 * Creates a range iterator from `from` to `to`.
 */
export function range(options: RangeOptions): SyncIteratorWrapper<number> {
	const { from, to, inclusive = false } = options;
	const end = inclusive ? to + 1 : to;

	function* generateRange() {
		for (let i = from; i < end; i++) {
			yield i;
		}
	}

	return new SyncIteratorWrapper(generateRange());
}

/**
 * Wraps an async iterable for lazy iteration.
 */
export function lazy<T>(iterable: AsyncIterable<T>): AsyncIteratorWrapper<T> {
	return new AsyncIteratorWrapper(iterable);
}
