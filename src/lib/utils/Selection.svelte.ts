export function createSingleSelection<T>({
	options,
	onchange,
	onclose
}: {
	options: readonly T[];
	onchange?: (value?: T) => void;
	onclose?: () => void;
}): {
	selectedIndex?: number;
	hoverIndex?: number;
} {
	let selectedIndex = $state<number>();
	let hoverIndex = $state<number>();

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
			case 'Enter':
			case ' ': {
				e.preventDefault();
				if (typeof hoverIndex === 'number') {
					selectedIndex = hoverIndex;
					onchange?.(options[selectedIndex]);
					onclose?.();
				}
				break;
			}

			case 'Escape': {
				e.preventDefault();
				onclose?.();
				break;
			}

			case 'ArrowDown': {
				e.preventDefault();
				focusNext();
				break;
			}

			case 'ArrowUp': {
				e.preventDefault();
				focusPrevious();
				break;
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
