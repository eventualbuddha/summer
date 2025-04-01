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
		{ alignment, maxGap }: { alignment: 'left' | 'right' | 'either'; maxGap?: number }
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
		{ alignment, maxGap }: { alignment: 'left' | 'right' | 'either'; maxGap?: number }
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
}

export type Finder = ((text: PageText) => boolean) | string | RegExp;

function predicateForFinder(finder: Finder): (text: PageText) => boolean {
	if (typeof finder === 'string') {
		return (text: PageText) => text.str === finder;
	} else if (finder instanceof RegExp) {
		return (text: PageText) => finder.test(text.str);
	} else {
		return finder;
	}
}
