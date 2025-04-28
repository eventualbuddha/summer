import { NEVER_PROMISE } from './promises';

/**
 * Fetch using the provided async function, but only return the most recent
 * result. The provided fetch function is given an `AbortSignal` to detect when
 * it should consider its request to be outdated.
 */
export class Fetcher<Args extends unknown[], Return> {
	#fetch: (...args: [...Args, AbortSignal]) => Promise<Return>;
	#lastAbortController: AbortController | undefined;

	constructor(fetch: (...args: [...Args, abortSignal: AbortSignal]) => Promise<Return>) {
		this.#fetch = fetch;
	}

	/**
	 * Fetch data using the provided fetcher. This will only resolve if it was
	 * the latest fetch when the inner fetch function resolved.
	 */
	async fetch(...args: Args): Promise<Return> {
		// signal that the last fetch should be aborted
		this.#lastAbortController?.abort();

		// schedule this fetch
		const abortController = new AbortController();
		this.#lastAbortController = abortController;
		const ret = await this.#fetch(...args, abortController.signal);

		if (this.#lastAbortController === abortController) {
			this.#lastAbortController = undefined;
		}

		if (abortController.signal.aborted) {
			// never return from an `await` on this fetch
			return NEVER_PROMISE;
		}

		return ret;
	}
}
