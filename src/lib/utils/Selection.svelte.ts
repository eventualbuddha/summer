export function createSingleSelection<T>({
	options,
	search,
	onchange,
	onclose
}: {
	options: readonly T[];
	search?: (value: T) => string;
	onchange?: (value?: T) => void;
	onclose?: () => void;
}): {
	selectedIndex?: number;
	hoverIndex?: number;
} {
	let selectedIndex = $state<number>();
	let hoverIndex = $state<number>();
	let prefix = $state<string>();
	let prefixTimeout = $state<NodeJS.Timeout>();

	function focusNext() {
		if (hoverIndex === undefined) {
			hoverIndex = 0;
		} else if (hoverIndex < options.length - 1) {
			hoverIndex += 1;
		}
	}

	function focusPrevious() {
		if (hoverIndex === undefined) {
			hoverIndex = options.length - 1;
		} else if (hoverIndex > 0) {
			hoverIndex -= 1;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.ctrlKey) {
			switch (e.key) {
				case 'n': {
					e.preventDefault();
					focusNext();
					break;
				}

				case 'p': {
					e.preventDefault();
					focusPrevious();
					break;
				}
			}
			return;
		}

		switch (e.key) {
			case 'Enter': {
				e.preventDefault();
				if (typeof hoverIndex === 'number') {
					selectedIndex = hoverIndex;
					onchange?.(options[selectedIndex]);
					onclose?.();
				}
				return;
			}

			case 'Escape': {
				e.preventDefault();
				onclose?.();
				return;
			}

			case 'ArrowDown': {
				e.preventDefault();
				focusNext();
				return;
			}

			case 'ArrowUp': {
				e.preventDefault();
				focusPrevious();
				return;
			}
		}

		if (search && e.key.length === 1) {
			if (prefixTimeout) {
				clearTimeout(prefixTimeout);
			}

			prefix ??= '';
			prefix += e.key;
			prefixTimeout = setTimeout(() => {
				prefix = '';
			}, 500);
			const prefixLower = prefix.toLowerCase();

			const index = options.findIndex((option) =>
				search(option).toLowerCase().startsWith(prefixLower)
			);

			if (index !== -1) {
				hoverIndex = index;
			}
		}
	}

	$effect(() => {
		document.addEventListener('keydown', onkeydown);
		return () => {
			document.removeEventListener('keydown', onkeydown);
		};
	});

	return {
		get selectedIndex() {
			return selectedIndex;
		},

		set selectedIndex(value) {
			if (value !== undefined && value >= 0 && value < options.length) {
				selectedIndex = value;
			} else {
				selectedIndex = undefined;
			}
		},

		get hoverIndex() {
			return hoverIndex;
		},

		set hoverIndex(value) {
			if (value !== undefined && value >= 0 && value < options.length) {
				hoverIndex = value;
			} else {
				hoverIndex = undefined;
			}
		}
	};
}
