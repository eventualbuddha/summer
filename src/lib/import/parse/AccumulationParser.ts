import type { Result } from '@badrap/result';
import type { Page } from '../statement/page';

/**
 * Accumulates a parsed value by passing each previous result to the
 * next parser call.
 */
export class AccumulationParser<Accumulator, E extends Error, Byproduct = never, Context = void> {
	#previous?: Accumulator;

	constructor(
		private readonly parser: (
			page: Page,
			previous?: Accumulator,
			context?: Context
		) => Generator<Result<Byproduct, E>, Accumulator>,
		initial?: Accumulator
	) {
		this.#previous = initial;
	}

	/**
	 * Parses `page` and yields the result.
	 *
	 * If parsing succeeds, the result is stored and passed to future
	 * parser calls.
	 */
	*parsePage(page: Page, context?: Context): Generator<Result<Byproduct, E>> {
		this.#previous = yield* this.parser(page, this.#previous, context);
	}

	/**
	 * Returns the parsed value, if any.
	 */
	get parsed(): Accumulator | undefined {
		return this.#previous;
	}
}
