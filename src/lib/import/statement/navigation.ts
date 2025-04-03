import type { Page, PageText } from './page';

/**
 * Finds text within the page.
 */
export class PageTextNavigator {
	readonly #page: Page;

	constructor(page: Page) {
		this.#page = page;
	}

	/**
	 * Finds text using `finder`, which can be a string, regular expression,
	 * or a custom predicate function.
	 *
	 * @example
	 *
	 * ```ts
	 * const helloLabel = page.navigator.find('Hello');
	 * const accountLabel = page.navigator.find(/Account: \d+/);
	 * ```
	 */
	find(finder: Finder): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const text = this.#page.texts.find(predicate);
		if (!text) return undefined;
		const index = this.#page.texts.indexOf(text);
		return new PageTextLocation(text, index, this);
	}
}

interface FindTableOptions {
	labelAlignment: Alignment;
	valueAlignment: Alignment;
	maxGap?: number;
}

type N<Count extends number, T> = Count extends 0
	? []
	: Count extends 1
		? [T]
		: Count extends 2
			? [T, T]
			: Count extends 3
				? [T, T, T]
				: Count extends 4
					? [T, T, T, T]
					: Count extends 5
						? [T, T, T, T, T]
						: Count extends 6
							? [T, T, T, T, T, T]
							: Count extends 7
								? [T, T, T, T, T, T, T]
								: Count extends 8
									? [T, T, T, T, T, T, T, T]
									: Count extends 9
										? [T, T, T, T, T, T, T, T, T]
										: Count extends 10
											? [T, T, T, T, T, T, T, T, T, T]
											: Count extends 11
												? [T, T, T, T, T, T, T, T, T, T, T]
												: T[];

/**
 * Finds nearby text elements.
 */
export class PageTextLocation {
	readonly #text: PageText;
	readonly #index: number;
	readonly #navigator: PageTextNavigator;

	constructor(text: PageText, index: number, navigator: PageTextNavigator) {
		this.#text = text;
		this.#index = index;
		this.#navigator = navigator;
	}

	get text(): PageText {
		return this.#text;
	}

	get index(): number {
		return this.#index;
	}

	/**
	 * Finds a text element to the right of the current text element.
	 */
	findRight(finder: Finder): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const minX = this.#text.x + this.#text.width;
		return this.#navigator.find(
			(text) => text.x >= minX && predicate(text) && text.isHorizontallyAlignedWith(this.#text)
		);
	}

	/**
	 * Finds a text element to the left of the current text element.
	 */
	findLeft(finder: Finder): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const maxX = this.#text.x;
		return this.#navigator.find(
			(text) => text.x <= maxX && predicate(text) && text.isHorizontallyAlignedWith(this.#text)
		);
	}

	/**
	 * Finds a text element aligned below the current text element.
	 */
	findDown(
		finder: Finder,
		{ alignment, maxGap }: { alignment: Alignment; maxGap?: number }
	): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const maxY = this.#text.y;
		return this.#navigator.find(
			(text) =>
				text.y + text.height <= maxY &&
				predicate(text) &&
				text.isVerticallyAlignedWith(this.#text, { alignment, maxGap })
		);
	}

	/**
	 * Finds a text element aligned above the current text element.
	 */
	findUp(
		finder: Finder,
		{ alignment, maxGap }: { alignment: Alignment; maxGap?: number }
	): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const minY = this.#text.y + this.#text.height;
		return this.#navigator.find(
			(text) =>
				text.y >= minY &&
				predicate(text) &&
				text.isVerticallyAlignedWith(this.#text, { alignment, maxGap })
		);
	}

	findTable(labels: [], values: [], options: FindTableOptions): [] | undefined;
	findTable(
		labels: [Finder],
		values: [Finder],
		options: FindTableOptions
	): [[PageTextLocation, PageTextLocation]] | undefined;
	findTable(
		labels: N<2, Finder>,
		values: N<2, Finder>,
		options: FindTableOptions
	): N<2, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<3, Finder>,
		values: N<3, Finder>,
		options: FindTableOptions
	): N<3, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<4, Finder>,
		values: N<4, Finder>,
		options: FindTableOptions
	): N<4, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<5, Finder>,
		values: N<5, Finder>,
		options: FindTableOptions
	): N<5, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<6, Finder>,
		values: N<6, Finder>,
		options: FindTableOptions
	): N<6, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<7, Finder>,
		values: N<7, Finder>,
		options: FindTableOptions
	): N<7, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<8, Finder>,
		values: N<8, Finder>,
		options: FindTableOptions
	): N<8, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<9, Finder>,
		values: N<9, Finder>,
		options: FindTableOptions
	): N<9, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<10, Finder>,
		values: N<10, Finder>,
		options: FindTableOptions
	): N<10, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<11, Finder>,
		values: N<11, Finder>,
		options: FindTableOptions
	): N<11, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: readonly Finder[],
		values: readonly Finder[],
		{ labelAlignment, valueAlignment, maxGap }: FindTableOptions
	): Array<[PageTextLocation, PageTextLocation]> | undefined {
		if (labels.length !== values.length) {
			throw new Error('labels and values finders must have the same length');
		}

		const entries: Array<[PageTextLocation, PageTextLocation]> = [];
		let lastLabel: PageTextLocation | undefined;
		let lastValue: PageTextLocation | undefined;

		for (let row = 0; row < labels.length; row += 1) {
			const labelFinder = labels[row]!;
			const valueFinder = values[row]!;

			let thisLabel: PageTextLocation | undefined;
			let thisValue: PageTextLocation | undefined;

			if (row === 0) {
				const labelPredicate = predicateForFinder(labelFinder);

				if (!labelPredicate(this.text)) {
					// `this` is supposed to be the first label, but it doesn't match.
					return undefined;
				}

				// eslint-disable-next-line @typescript-eslint/no-this-alias
				thisLabel = this;
				thisValue = thisLabel?.findRight(valueFinder);
			} else {
				thisLabel = lastLabel?.findDown(labelFinder, { alignment: labelAlignment, maxGap });
				thisValue = lastValue?.findDown(valueFinder, { alignment: valueAlignment, maxGap });
			}

			if (!thisLabel || !thisValue) {
				return undefined;
			}

			entries.push([thisLabel, thisValue]);
			lastLabel = thisLabel;
			lastValue = thisValue;
		}

		return entries;
	}
}

export type Finder = ((text: PageText) => boolean) | string | RegExp;
export type Alignment = 'left' | 'right' | 'either';

function predicateForFinder(finder: Finder): (text: PageText) => boolean {
	if (typeof finder === 'string') {
		return (text: PageText) => text.str === finder;
	} else if (finder instanceof RegExp) {
		return (text: PageText) => finder.test(text.str);
	} else {
		return finder;
	}
}
