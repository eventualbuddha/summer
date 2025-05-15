export async function waitFor(
	fn: () => unknown,
	{ timeout = 4000 }: { timeout?: number } = {}
): Promise<void> {
	const end = Date.now() + timeout;
	let lastError: Error | undefined;

	while (end > Date.now()) {
		try {
			const result = await fn();

			if (result === true) {
				return;
			}

			if (result === false) {
				continue;
			}

			return;
		} catch (e) {
			lastError = e as Error;
		}
	}

	if (lastError) {
		throw new Error(`Timed out waiting for predicate. ${lastError}`);
	}

	throw new Error('Timed out waiting for predicate');
}
