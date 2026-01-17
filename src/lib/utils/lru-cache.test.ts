import { describe, test, expect } from 'bun:test';
import { LruCache } from './lru-cache';

describe('LruCache', () => {
	test('stores and retrieves values', () => {
		const cache = new LruCache<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		expect(cache.get('a')).toBe(1);
		expect(cache.get('b')).toBe(2);
		expect(cache.get('c')).toBe(3);
	});

	test('returns undefined for missing keys', () => {
		const cache = new LruCache<string, number>(3);
		expect(cache.get('nonexistent')).toBeUndefined();
	});

	test('evicts least recently used item when max size exceeded', () => {
		const cache = new LruCache<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Add fourth item, should evict 'a' (least recently used)
		cache.set('d', 4);

		expect(cache.get('a')).toBeUndefined();
		expect(cache.get('b')).toBe(2);
		expect(cache.get('c')).toBe(3);
		expect(cache.get('d')).toBe(4);
	});

	test('get refreshes item as most recently used', () => {
		const cache = new LruCache<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Access 'a', making it most recently used
		cache.get('a');

		// Add fourth item, should evict 'b' (now least recently used)
		cache.set('d', 4);

		expect(cache.get('a')).toBe(1); // Still present
		expect(cache.get('b')).toBeUndefined(); // Evicted
		expect(cache.get('c')).toBe(3);
		expect(cache.get('d')).toBe(4);
	});

	test('set updates existing key without eviction', () => {
		const cache = new LruCache<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Update existing key
		cache.set('a', 10);

		expect(cache.get('a')).toBe(10);
		expect(cache.size).toBe(3);
	});

	test('set refreshes existing key as most recently used', () => {
		const cache = new LruCache<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Update 'a', making it most recently used
		cache.set('a', 10);

		// Add fourth item, should evict 'b'
		cache.set('d', 4);

		expect(cache.get('a')).toBe(10); // Still present
		expect(cache.get('b')).toBeUndefined(); // Evicted
		expect(cache.get('c')).toBe(3);
		expect(cache.get('d')).toBe(4);
	});

	test('tracks size correctly', () => {
		const cache = new LruCache<string, number>(5);

		expect(cache.size).toBe(0);

		cache.set('a', 1);
		expect(cache.size).toBe(1);

		cache.set('b', 2);
		cache.set('c', 3);
		expect(cache.size).toBe(3);

		cache.set('a', 10); // Update existing
		expect(cache.size).toBe(3);

		cache.set('d', 4);
		cache.set('e', 5);
		expect(cache.size).toBe(5);

		cache.set('f', 6); // Exceeds max, evicts one
		expect(cache.size).toBe(5);
	});

	test('clear removes all entries', () => {
		const cache = new LruCache<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		cache.clear();

		expect(cache.size).toBe(0);
		expect(cache.get('a')).toBeUndefined();
		expect(cache.get('b')).toBeUndefined();
		expect(cache.get('c')).toBeUndefined();
	});

	test('handles max size of 1', () => {
		const cache = new LruCache<string, number>(1);
		cache.set('a', 1);

		expect(cache.get('a')).toBe(1);

		cache.set('b', 2);

		expect(cache.get('a')).toBeUndefined();
		expect(cache.get('b')).toBe(2);
	});

	test('works with complex object values', () => {
		const cache = new LruCache<string, { data: string }>(2);

		const obj1 = { data: 'first' };
		const obj2 = { data: 'second' };

		cache.set('key1', obj1);
		cache.set('key2', obj2);

		expect(cache.get('key1')).toEqual({ data: 'first' });
		expect(cache.get('key2')).toEqual({ data: 'second' });
	});

	test('maintains correct order after multiple operations', () => {
		const cache = new LruCache<string, number>(3);

		// Fill cache: a, b, c
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Access b and a, making order: c, b, a (least to most recent)
		cache.get('b');
		cache.get('a');

		// Add d, should evict c
		cache.set('d', 4);

		expect(cache.get('c')).toBeUndefined();
		expect(cache.get('b')).toBe(2);
		expect(cache.get('a')).toBe(1);
		expect(cache.get('d')).toBe(4);
	});
});
