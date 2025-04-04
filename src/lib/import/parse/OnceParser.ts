import type { Result } from '@badrap/result';
import type { Page } from '../statement/page';

/**
 * Parses pages until one succeeds, then stops parsing future pages.
 */
export class OnceParser<T, E extends Error> {
	#parsed?: T;

	constructor(private readonly parser: (page: Page) => Result<T, E>) {}

	/**
	 * Parses `page` and yields the result.
	 *
	 * If parsing succeeds, the result is stored and future calls will yield
	 * nothing. If parsing fails, the error is yielded.
	 */
	*parsePage(page: Page): Generator<Result<T, E>> {
		if (this.#parsed) {
			return;
		}

		const result = this.parser(page);
		if (result.isOk) {
			this.#parsed = result.value;
		}

		yield result;
	}

	/**
	 * Returns the parsed result, if any.
	 */
	get parsed(): T | undefined {
		return this.#parsed;
	}
}
