import { expect, test } from 'vitest';
import { Fetcher } from './Fetcher';

test('basic', async () => {
	const fetcher = new Fetcher(
		() =>
			new Promise<number>((resolve) => {
				setTimeout(() => resolve(99), 1);
			})
	);

	expect(await fetcher.fetch()).toEqual(99);
});

test('keeps only the most recent', async () => {
	let ret = 0;

	const fetcher = new Fetcher(
		() =>
			new Promise<number>((resolve) => {
				setTimeout(() => {
					ret += 1;
					resolve(ret);
				}, 1);
			})
	);

	const promise1 = fetcher.fetch();
	const promise2 = fetcher.fetch();

	// neither has run yet
	expect(ret).toEqual(0);

	// wait for the first one to resolve, which should be the second
	expect(await Promise.race([promise1, promise2])).toEqual(2);

	// both have run their course
	expect(ret).toEqual(2);
});

test('abort signal', async () => {
	let aborted = 0;

	const fetcher = new Fetcher<[], void>(async (abortSignal) => {
		abortSignal.addEventListener('abort', () => {
			aborted += 1;
		});
	});

	const promise1 = fetcher.fetch();
	expect(aborted).toEqual(0);
	await promise1;
	expect(aborted).toEqual(0);

	const promise2 = fetcher.fetch();
	const promise3 = fetcher.fetch();
	expect(aborted).toEqual(1);
	await Promise.race([promise2, promise3]);
});
