import { describe, test, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	test('should render "All Years" button', () => {
		render(Page, { data: {
			monthSelections: [],
			yearSelections: [],
			categorySelections: [],
		}});
		expect(screen.getByRole('button', { name: 'Year Filter'})).toBeInTheDocument();
	});
});
