import { lazy, range } from '@nfnitloop/better-iterators';
import { z } from 'zod';
import { StatementNavigator } from './navigation';
import { Page, PageSchema, PageText } from './page';

/**
 * A parsed PDF statement.
 */
export class Statement {
	readonly pages: readonly Page[];
	#navigator?: StatementNavigator;

	constructor(pages: readonly Page[]) {
		this.pages = pages;
	}

	get navigator(): StatementNavigator {
		return (this.#navigator ??= new StatementNavigator(this));
	}

	/**
	 * Parses a PDF document, but does not parse financial information.
	 * Uses dynamic imports to load PDF.js only when needed.
	 */
	static async fromPDF(data: Uint8Array | BufferSource): Promise<Statement> {
		// Dynamic import to avoid bundling PDF.js in the main bundle
		const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');

		GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
		const pdf = await getDocument(data).promise;

		async function* getAllPageText(page: Awaited<ReturnType<typeof pdf.getPage>>): AsyncGenerator<PageText> {
			const textContent = await page.getTextContent();
			for (const item of textContent.items) {
				if ('str' in item) {
					yield new PageText(
						item.str,
						item.transform[4]!,
						item.transform[5]!,
						item.width,
						item.height,
						item.fontName
					);
				}
			}
		}

		return new Statement(
			await range({ from: 1, to: pdf.numPages, inclusive: true })
				.toAsync()
				.map(
					async (pageNumber) =>
						new Page(
							pageNumber,
							await lazy(getAllPageText(await pdf.getPage(pageNumber))).toArray()
						)
				)
				.toArray()
		);
	}
}

export const StatementSchema = z.array(PageSchema).transform((pages) => new Statement(pages));
