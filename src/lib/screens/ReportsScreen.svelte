<script lang="ts">
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import BudgetMultiSelect from '$lib/components/BudgetMultiSelect.svelte';
	import type { State } from '$lib/state.svelte';
	import { formatWholeDollarAmount } from '$lib/utils/formatting';
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Category } from '$lib/db';
	import type { Selection } from '$lib/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { untrack } from 'svelte';

	let s: State = getContext('state');

	function navigateToTransactions(year: number, month: number, categories: Category[]) {
		// Set filters and navigate to transactions screen
		if (s.filters) {
			// Set year filter
			s.filters.years.forEach((y) => {
				y.selected = y.value === year;
			});

			// Set month filter
			s.filters.months.forEach((m) => {
				m.selected = m.value === month;
			});

			// Set category filters
			s.filters.categories.forEach((c) => {
				c.selected = categories.some((cat) => cat.id === c.value.id);
			});

			// Clear search and account filters
			s.filters.searchTerm = '';
			s.filters.accounts.forEach((a) => {
				a.selected = true;
			});
		}

		goto(resolve('/'));
	}

	function navigateToTransactionsForYear(year: number, categories: Category[]) {
		// Set filters and navigate to transactions screen for entire year
		if (s.filters) {
			// Set year filter
			s.filters.years.forEach((y) => {
				y.selected = y.value === year;
			});

			// Select ALL months
			s.filters.months.forEach((m) => {
				m.selected = true;
			});

			// Set category filters
			s.filters.categories.forEach((c) => {
				c.selected = categories.some((cat) => cat.id === c.value.id);
			});

			// Clear search and account filters
			s.filters.searchTerm = '';
			s.filters.accounts.forEach((a) => {
				a.selected = true;
			});
		}

		goto(resolve('/'));
	}

	const currentYear = new Date().getFullYear();
	let selectedYear = $state<number>(currentYear);
	let viewMode = $state<'monthly' | 'yearly'>('yearly');
	let displayMode = $state<'timeframe' | 'budget'>('timeframe');
	let isLoadingBudgetData = $state(false);
	let isLoadingSingleBudget = $state(false);

	// Budget selections for multi-select (timeframe view)
	let budgetSelections = $state<Selection<string>[]>([]);

	// Single budget selection for budget view
	const ALL_BUDGETS_KEY = '__ALL_BUDGETS__';
	let selectedBudget = $state<string>(ALL_BUDGETS_KEY);

	// Store all available budget names for the dropdown (independent of loaded data)
	let allBudgetNames = $state<string[]>([]);

	// Flag to prevent circular updates between URL and state
	let hasInitializedFromUrl = $state(false);

	// Initialize filters from URL once data is loaded
	$effect(() => {
		if (hasInitializedFromUrl) return;

		const params = $page.url.searchParams;

		// Read year from URL
		const yearParam = params.get('year');
		if (yearParam) {
			const year = parseInt(yearParam, 10);
			if (!isNaN(year)) {
				selectedYear = year;
			}
		}

		// Read view mode from URL
		const viewModeParam = params.get('viewMode');
		if (viewModeParam === 'monthly' || viewModeParam === 'yearly') {
			viewMode = viewModeParam;
		}

		// Read display mode from URL
		const displayModeParam = params.get('displayMode');
		if (displayModeParam === 'timeframe' || displayModeParam === 'budget') {
			displayMode = displayModeParam;
		}

		// Read selected budget from URL (for budget view)
		const budgetParam = params.get('budget');
		if (budgetParam) {
			selectedBudget = budgetParam;
		}

		// Read budget selections from URL (for timeframe view)
		const budgetsParam = params.get('budgets');
		if (budgetsParam && budgetSelections.length > 0) {
			const selectedBudgetNames = new Set(budgetsParam.split(','));
			budgetSelections.forEach((b) => {
				b.selected = selectedBudgetNames.has(b.key);
			});
		}

		hasInitializedFromUrl = true;
	});

	// Sync filter changes to URL
	$effect(() => {
		if (!hasInitializedFromUrl) return;

		// Track dependencies
		const year = selectedYear;
		const view = viewMode;
		const display = displayMode;
		const budget = selectedBudget;
		const budgets = budgetSelections.map((b) => ({ key: b.key, selected: b.selected }));

		// Use untrack to read current URL without creating a dependency
		untrack(() => {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const params = new URLSearchParams($page.url.searchParams);

			// Update year parameter (only if not current year)
			if (year !== currentYear) {
				params.set('year', year.toString());
			} else {
				params.delete('year');
			}

			// Update view mode parameter (only if not default)
			if (view !== 'yearly') {
				params.set('viewMode', view);
			} else {
				params.delete('viewMode');
			}

			// Update display mode parameter (only if not default)
			if (display !== 'timeframe') {
				params.set('displayMode', display);
			} else {
				params.delete('displayMode');
			}

			// Update budget parameter (for budget view, only if not default)
			if (display === 'budget' && budget !== ALL_BUDGETS_KEY) {
				params.set('budget', budget);
			} else {
				params.delete('budget');
			}

			// Update budgets parameter (for timeframe view)
			if (display === 'timeframe') {
				const selectedBudgetNames = budgets.filter((b) => b.selected).map((b) => b.key);
				const allBudgetKeys = budgets.map((b) => b.key);
				if (selectedBudgetNames.length > 0 && selectedBudgetNames.length < allBudgetKeys.length) {
					params.set('budgets', selectedBudgetNames.join(','));
				} else {
					params.delete('budgets');
				}
			} else {
				params.delete('budgets');
			}

			// Update URL without triggering navigation
			const newUrl = `${$page.url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(newUrl, { replaceState: true, noScroll: true, keepFocus: true });
		});
	});

	// Year options for dropdown
	const yearOptions = $derived(s.budgetYears ?? []);

	// Calculate the latest month with transaction activity for the selected year
	const latestActiveMonth = $derived.by(() => {
		if (!s.budgetReportData) {
			return 12; // No data, use full year
		}

		// For Budget view, always calculate for current year using selected budget
		// For Timeframe view, calculate for selected year using all budgets
		const yearToCheck = displayMode === 'budget' ? currentYear : selectedYear;

		if (yearToCheck !== currentYear) {
			return 12; // For past years, use full year
		}

		// Find the latest month with any spending
		let maxMonth = 0;
		const monthlyData = s.budgetReportData.monthlySpendingByNameYearMonth;

		if (displayMode === 'budget' && selectedBudget) {
			// In Budget view, look at selected budget or all budgets if "All Budgets" is selected
			if (selectedBudget === ALL_BUDGETS_KEY) {
				// Look across all budgets for All Budgets option
				for (const budgetName in monthlyData) {
					const yearData = monthlyData[budgetName]?.[currentYear];
					if (yearData) {
						for (const month in yearData) {
							const monthNum = parseInt(month);
							if (yearData[monthNum] !== 0 && monthNum > maxMonth) {
								maxMonth = monthNum;
							}
						}
					}
				}
			} else {
				// Only look at the selected budget
				const yearData = monthlyData[selectedBudget]?.[currentYear];
				if (yearData) {
					for (const month in yearData) {
						const monthNum = parseInt(month);
						if (yearData[monthNum] !== 0 && monthNum > maxMonth) {
							maxMonth = monthNum;
						}
					}
				}
			}
		} else {
			// In Timeframe view, look across all budgets
			for (const budgetName in monthlyData) {
				const yearData = monthlyData[budgetName]?.[yearToCheck];
				if (yearData) {
					for (const month in yearData) {
						const monthNum = parseInt(month);
						if (yearData[monthNum] !== 0 && monthNum > maxMonth) {
							maxMonth = monthNum;
						}
					}
				}
			}
		}

		// If no transactions found, fall back to current month
		return maxMonth > 0 ? maxMonth : new Date().getMonth() + 1;
	});

	// Stable filtered data that doesn't update while loading
	interface BudgetChartData {
		name: string;
		values: Array<{
			year: number;
			budgetAmount: number;
			actualAmount: number;
			monthlyBudgetAmount: number;
			categories: Category[];
			monthlySpending: Array<{
				month: number;
				currentYear: number;
				previousYear: number;
			}>;
		}>;
	}

	// Budget view data (year-over-year for a single budget)
	interface BudgetViewData {
		budgetName: string;
		yearlyData: Array<{
			year: number;
			budgetAmount: number;
			actualAmount: number;
			categories: Category[];
		}>;
	}

	let stableFilteredData = $state<{
		budgetNames: string[];
		years: number[];
		data: BudgetChartData[];
	}>({
		budgetNames: [],
		years: [],
		data: []
	});
	let stableLatestActiveMonth = $state(12);

	let stableBudgetViewData = $state<BudgetViewData | null>(null);

	// Filtered data based on selections
	const filteredData = $derived.by(() => {
		const sourceData = s.budgetReportData;

		if (!sourceData || !sourceData.budgetNames || !sourceData.years) {
			return { budgetNames: [], years: [], data: [] };
		}

		const {
			budgetNames,
			years,
			budgetsByNameAndYear,
			actualSpendingByNameAndYear,
			monthlySpendingByNameYearMonth,
			previousYearSpendingByNameYearMonth
		} = sourceData;

		// Sort years in descending order
		const sortedYears = [...years].sort((a, b) => b - a);

		// Filter years (only one year at a time)
		const filteredYears = [selectedYear];

		// Filter budget names based on selections
		const selectedBudgets = budgetSelections.filter((s) => s.selected).map((s) => s.value);
		const filteredBudgetNames = selectedBudgets.length > 0 ? selectedBudgets : budgetNames;

		// Create chart data
		const data = filteredBudgetNames.map((budgetName) => ({
			name: budgetName,
			values: filteredYears.map((year) => {
				const baseBudgetAmount = budgetsByNameAndYear[budgetName]?.[year]?.amount || 0;

				// Calculate prorated budget amount for current year in yearly view
				let displayBudgetAmount = baseBudgetAmount;
				if (viewMode === 'yearly' && year === currentYear) {
					// Prorate based on how much of the year has passed (based on latest transaction)
					displayBudgetAmount = (baseBudgetAmount / 12) * latestActiveMonth;
				}

				return {
					year,
					budgetAmount: displayBudgetAmount,
					actualAmount: actualSpendingByNameAndYear[budgetName]?.[year] || 0,
					monthlyBudgetAmount: baseBudgetAmount / 12,
					categories: budgetsByNameAndYear[budgetName]?.[year]?.categories || [],
					monthlySpending: Array.from({ length: 12 }, (_, i) => ({
						month: i + 1,
						currentYear: monthlySpendingByNameYearMonth[budgetName]?.[year]?.[i + 1] || 0,
						previousYear: previousYearSpendingByNameYearMonth[budgetName]?.[year]?.[i + 1] || 0
					}))
				};
			})
		}));

		return { budgetNames: filteredBudgetNames, years: sortedYears, data };
	});

	// Budget view data - consolidate by budget name across all years
	const budgetViewData = $derived.by((): BudgetViewData | null => {
		const sourceData = s.budgetReportData;

		if (!sourceData || !selectedBudget) {
			return null;
		}

		const { years, budgetNames, budgetsByNameAndYear, actualSpendingByNameAndYear } = sourceData;

		// Sort years in ascending order and limit to last 5 years if needed
		// Get the 5 most recent years, but display them oldest to newest (left to right)
		const sortedYears = [...years]
			.sort((a, b) => b - a) // Sort descending to get most recent
			.slice(0, 5) // Take the 5 most recent
			.reverse(); // Reverse to ascending order for display (oldest to newest)

		// Check if "All Budgets" is selected
		const isAllBudgets = selectedBudget === ALL_BUDGETS_KEY;

		// Build year-over-year data
		const yearlyData = sortedYears.map((year) => {
			let baseBudgetAmount = 0;
			let actualAmount = 0;
			let allCategories: Category[] = [];

			if (isAllBudgets) {
				// Aggregate all budgets for this year
				budgetNames.forEach((budgetName) => {
					const budget = budgetsByNameAndYear[budgetName]?.[year];
					if (budget) {
						baseBudgetAmount += budget.amount || 0;
						allCategories.push(...(budget.categories || []));
					}
					actualAmount += actualSpendingByNameAndYear[budgetName]?.[year] || 0;
				});
				// Remove duplicate categories
				allCategories = Array.from(new Map(allCategories.map((cat) => [cat.id, cat])).values());
			} else {
				// Single budget
				baseBudgetAmount = budgetsByNameAndYear[selectedBudget]?.[year]?.amount || 0;
				actualAmount = actualSpendingByNameAndYear[selectedBudget]?.[year] || 0;
				allCategories = budgetsByNameAndYear[selectedBudget]?.[year]?.categories || [];
			}

			// Calculate prorated budget amount for current year
			let displayBudgetAmount = baseBudgetAmount;
			if (year === currentYear) {
				// Prorate based on how much of the year has passed (based on latest transaction)
				displayBudgetAmount = (baseBudgetAmount / 12) * latestActiveMonth;
			}

			return {
				year,
				budgetAmount: displayBudgetAmount,
				actualAmount,
				categories: allCategories
			};
		});

		return {
			budgetName: isAllBudgets ? 'All Budgets' : selectedBudget,
			yearlyData
		};
	});

	// Load budget years once when connected
	$effect(() => {
		if (!s.isConnected) return;
		s.loadBudgetYears();
	});

	// Auto-select the most recent year with data if current year has no budgets
	$effect(() => {
		if (!s.budgetYears || s.budgetYears.length === 0) return;

		// If the currently selected year is not in the list of years with budgets,
		// select the most recent year that has budgets
		if (!s.budgetYears.includes(selectedYear)) {
			const sortedYears = [...s.budgetYears].sort((a, b) => b - a);
			selectedYear = sortedYears[0]!;
		}
	});

	// Load budget data for timeframe view when selected year changes
	$effect(() => {
		if (!s.isConnected || displayMode !== 'timeframe') return;
		isLoadingBudgetData = true;
		s.loadBudgetReportData(selectedYear).finally(() => {
			isLoadingBudgetData = false;
		});
	});

	// Load single budget data for budget view when selected budget changes
	$effect(() => {
		if (!s.isConnected || displayMode !== 'budget' || !selectedBudget) return;
		isLoadingSingleBudget = true;
		// If "All Budgets" is selected, load all budget data without year filter
		// Otherwise, load only the selected budget's data
		if (selectedBudget === ALL_BUDGETS_KEY) {
			s.loadBudgetReportData(undefined).finally(() => {
				isLoadingSingleBudget = false;
			});
		} else {
			s.loadSingleBudgetReportData(selectedBudget).finally(() => {
				isLoadingSingleBudget = false;
			});
		}
	});

	// Update stable data only when not loading
	$effect(() => {
		if (displayMode === 'timeframe' && !isLoadingBudgetData && filteredData.data.length > 0) {
			stableFilteredData = filteredData;
			stableLatestActiveMonth = latestActiveMonth;
		} else if (displayMode === 'budget' && !isLoadingSingleBudget && budgetViewData) {
			stableBudgetViewData = budgetViewData;
			stableLatestActiveMonth = latestActiveMonth;
		}
	});

	// Initialize budget selections when data is loaded
	$effect(() => {
		if (s.budgetReportData && s.budgetReportData.budgetNames) {
			// Store all budget names for the dropdown (only update if we have more than one name)
			// This preserves the full list even when loading single budget data
			if (s.budgetReportData.budgetNames.length > 1 || allBudgetNames.length === 0) {
				allBudgetNames = s.budgetReportData.budgetNames;
			}

			// Only update if the budget names have changed
			const currentNames = new Set(budgetSelections.map((s) => s.value));
			const newNames = new Set(s.budgetReportData.budgetNames);

			if (
				currentNames.size !== newNames.size ||
				!s.budgetReportData.budgetNames.every((name) => currentNames.has(name))
			) {
				budgetSelections = s.budgetReportData.budgetNames.map((name) => ({
					value: name,
					key: name,
					selected: true
				}));
			}

			// Initialize single budget selection if not set (already defaults to ALL_BUDGETS_KEY)
			// No need to override the default
		}
	});
</script>

<title>Reports – Summer</title>

<div class="flex flex-row items-center gap-4">
	<NavigationButton />
	<h1 class="text-2xl font-bold">Budget Reports</h1>
</div>

<div class="flex min-h-0 flex-col overflow-y-auto">
	{#if s.budgetReportData?.budgetNames.length === 0}
		<div class="flex flex-col items-center justify-center p-8">
			<div class="text-lg text-gray-600">No budget data available</div>
			<div class="mt-2 text-sm text-gray-500">Create some budgets to see reports</div>
		</div>
	{:else}
		<div class="space-y-6 pb-8">
			<!-- Chart -->
			{#if (displayMode === 'budget' && stableBudgetViewData) || (displayMode === 'timeframe' && stableFilteredData?.data && stableFilteredData.data.length > 0) || isLoadingBudgetData || isLoadingSingleBudget}
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 transition-opacity dark:border-gray-600 dark:bg-gray-800 {isLoadingBudgetData ||
					isLoadingSingleBudget
						? 'pointer-events-none opacity-50'
						: ''}"
				>
					<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
						<h2 class="text-lg font-semibold">
							{displayMode === 'budget'
								? 'Budget View'
								: viewMode === 'monthly'
									? 'Monthly Spending'
									: 'Yearly Spending'}
						</h2>

						<div class="flex flex-wrap items-center gap-3">
							<!-- Display Mode Toggle -->
							<div class="flex items-center gap-2">
								<label
									for="display-mode-toggle"
									class="text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Display:
								</label>
								<div class="flex rounded-md border border-gray-300 dark:border-gray-600">
									<button
										type="button"
										id="display-mode-toggle"
										onclick={() => (displayMode = 'timeframe')}
										class="px-3 py-1.5 text-sm transition-colors {displayMode === 'timeframe'
											? 'bg-blue-500 text-white'
											: 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'} rounded-l-md"
									>
										Timeframe
									</button>
									<button
										type="button"
										onclick={() => (displayMode = 'budget')}
										class="px-3 py-1.5 text-sm transition-colors {displayMode === 'budget'
											? 'bg-blue-500 text-white'
											: 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'} rounded-r-md"
									>
										Budget
									</button>
								</div>
							</div>

							{#if displayMode === 'timeframe'}
								<!-- Timeframe View Controls -->
								<div class="flex items-center gap-2">
									<label
										for="view-mode-toggle"
										class="text-sm font-medium text-gray-700 dark:text-gray-300"
									>
										View:
									</label>
									<div class="flex rounded-md border border-gray-300 dark:border-gray-600">
										<button
											type="button"
											id="view-mode-toggle"
											onclick={() => (viewMode = 'yearly')}
											class="px-3 py-1.5 text-sm transition-colors {viewMode === 'yearly'
												? 'bg-blue-500 text-white'
												: 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'} rounded-l-md"
										>
											Yearly
										</button>
										<button
											type="button"
											onclick={() => (viewMode = 'monthly')}
											class="px-3 py-1.5 text-sm transition-colors {viewMode === 'monthly'
												? 'bg-blue-500 text-white'
												: 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'} rounded-r-md"
										>
											Monthly
										</button>
									</div>
								</div>

								<div class="flex items-center gap-2">
									<label
										for="year-filter"
										class="text-sm font-medium text-gray-700 dark:text-gray-300"
									>
										Year:
									</label>
									<select
										id="year-filter"
										bind:value={selectedYear}
										class="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
									>
										{#each [...yearOptions].sort((a, b) => b - a) as year (year)}
											<option value={year}>{year}</option>
										{/each}
									</select>
								</div>

								<div class="flex items-center gap-2">
									<label
										for="budget-filter"
										class="text-sm font-medium text-gray-700 dark:text-gray-300"
									>
										Budget:
									</label>
									<BudgetMultiSelect
										bind:selections={budgetSelections}
										aria-label="Budget filter"
									/>
								</div>
							{:else}
								<!-- Budget View Controls -->
								<div class="flex items-center gap-2">
									<label
										for="budget-select"
										class="text-sm font-medium text-gray-700 dark:text-gray-300"
									>
										Budget:
									</label>
									<select
										id="budget-select"
										bind:value={selectedBudget}
										class="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
									>
										<option value={ALL_BUDGETS_KEY}>All Budgets</option>
										{#each allBudgetNames as budgetName (budgetName)}
											<option value={budgetName}>{budgetName}</option>
										{/each}
									</select>
								</div>
							{/if}
						</div>
					</div>

					{#if displayMode === 'budget' && stableBudgetViewData}
						<!-- Budget View - Year over Year for a single budget -->
						{@const allValues = stableBudgetViewData.yearlyData.flatMap((y) => [
							y.actualAmount,
							y.budgetAmount
						])}
						{@const maxPositive = Math.max(0, ...allValues)}
						{@const maxNegative = Math.abs(Math.min(0, ...allValues))}
						{@const maxScale = Math.max(maxPositive, maxNegative)}
						{@const zeroLinePercent =
							maxScale > 0 ? (maxNegative / (maxPositive + maxNegative)) * 100 : 50}
						{@const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']}

						<div
							class="space-y-4 transition-opacity {isLoadingSingleBudget
								? 'pointer-events-none opacity-50'
								: ''}"
						>
							<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{stableBudgetViewData.budgetName} - Year over Year
							</h4>

							<div
								class="grid gap-4"
								style="grid-template-columns: repeat({stableBudgetViewData.yearlyData
									.length}, 1fr);"
							>
								{#each stableBudgetViewData.yearlyData as yearData (yearData.year)}
									{@const color = colors[0]}
									{@const budgetHeightPercent =
										maxScale > 0
											? (Math.abs(yearData.budgetAmount) / (maxPositive + maxNegative)) * 100
											: 0}
									{@const actualHeightPercent =
										maxScale > 0
											? (Math.abs(yearData.actualAmount) / (maxPositive + maxNegative)) * 100
											: 0}
									{@const percentOfBudget =
										yearData.budgetAmount !== 0
											? (Math.abs(yearData.actualAmount) / Math.abs(yearData.budgetAmount)) * 100
											: 0}
									{@const isOverBudget = percentOfBudget > 100}
									{@const yearProgressPercent =
										yearData.year === currentYear ? (stableLatestActiveMonth / 12) * 100 : 100}

									<div class="flex flex-col gap-1">
										<!-- Year label -->
										<div class="text-center text-xs font-medium text-gray-600 dark:text-gray-400">
											{yearData.year}
										</div>

										<!-- Bar container with zero line baseline -->
										<div class="relative h-48">
											<!-- Zero baseline -->
											<div
												class="absolute inset-x-0 border-t-2 border-gray-400 dark:border-gray-500"
												style="top: {zeroLinePercent}%;"
												title="Zero line"
											></div>

											<!-- Budget bar (left side) -->
											{#if budgetHeightPercent > 0}
												{#if yearData.year === currentYear}
													<!-- Current year: Outer bar (light gray) with inner fill (darker gray, year progress) -->
													<div
														class="absolute left-0 w-1/2 overflow-hidden rounded-t-sm bg-gray-300 dark:bg-gray-600"
														style="bottom: {100 -
															zeroLinePercent}%; height: {budgetHeightPercent}%;"
														title="Budget: {formatWholeDollarAmount(
															Math.abs(yearData.budgetAmount),
															{
																hideSign: true
															}
														)}"
													>
														<div
															class="absolute right-0 bottom-0 left-0 bg-gray-500 dark:bg-gray-400"
															style="height: {yearProgressPercent}%;"
															title={`${stableLatestActiveMonth} of 12 months (${yearProgressPercent.toFixed(0)}%) - based on latest transaction`}
														></div>
													</div>
												{:else}
													<!-- Previous years: Fully filled bar (lighter fill color) -->
													<div
														class="absolute left-0 w-1/2 rounded-t-sm bg-gray-500 dark:bg-gray-400"
														style="bottom: {100 -
															zeroLinePercent}%; height: {budgetHeightPercent}%;"
														title="Budget: {formatWholeDollarAmount(
															Math.abs(yearData.budgetAmount),
															{
																hideSign: true
															}
														)}"
													></div>
												{/if}
											{/if}

											<!-- Actual bar (right side) -->
											{#if actualHeightPercent > 0}
												<button
													type="button"
													aria-label="Year {yearData.year}: {formatWholeDollarAmount(
														Math.abs(yearData.actualAmount),
														{ hideSign: true }
													)}"
													class="absolute right-0 w-1/2 cursor-pointer transition-opacity hover:opacity-80 {yearData.actualAmount <
													0
														? 'rounded-t-sm'
														: 'rounded-b-sm'}"
													style="background-color: {yearData.actualAmount > 0
														? '#22c55e'
														: color}; {yearData.actualAmount < 0
														? `bottom: ${100 - zeroLinePercent}%; height: ${actualHeightPercent}%;`
														: `top: ${zeroLinePercent}%; height: ${actualHeightPercent}%;`}"
													title="Actual: {formatWholeDollarAmount(Math.abs(yearData.actualAmount), {
														hideSign: true
													})} {yearData.actualAmount > 0
														? '(income)'
														: '(expense)'} - Click to view transactions"
													onclick={() =>
														navigateToTransactionsForYear(yearData.year, yearData.categories)}
												></button>
											{/if}
										</div>

										<!-- Amount labels -->
										<div class="text-center">
											<div class="text-xs font-medium text-gray-600 dark:text-gray-400">
												{formatWholeDollarAmount(Math.abs(yearData.budgetAmount), {
													hideSign: true
												})}
											</div>
											<div class="text-xs font-medium" style="color: {color};">
												{formatWholeDollarAmount(Math.abs(yearData.actualAmount), {
													hideSign: true
												})}
											</div>
											<div class="text-xs {isOverBudget ? 'text-red-600' : 'text-green-600'}">
												{percentOfBudget.toFixed(0)}%
											</div>
										</div>
									</div>
								{/each}
							</div>

							<!-- Legend -->
							<div class="mt-6 space-y-2">
								<div class="flex gap-6 text-xs text-gray-600 dark:text-gray-400">
									<div class="flex items-center gap-2">
										<div
											class="relative h-4 w-4 overflow-hidden rounded bg-gray-300 dark:bg-gray-600"
										>
											<div
												class="absolute right-0 bottom-0 left-0 h-1/2 bg-gray-500 dark:bg-gray-400"
											></div>
										</div>
										<span>Budget (filled = year progress)</span>
									</div>
									<div class="flex items-center gap-2">
										<div class="h-4 w-4 rounded" style="background-color: {colors[0]}"></div>
										<span>Actual Spending</span>
									</div>
								</div>
							</div>
						</div>
					{:else if displayMode === 'budget' && !stableBudgetViewData}
						<!-- Budget View - Loading placeholder -->
						<div class="space-y-4">
							<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{selectedBudget === ALL_BUDGETS_KEY
									? 'All Budgets'
									: selectedBudget || 'Select a budget'} - Year over Year
							</h4>

							<div class="grid grid-cols-5 gap-4">
								{#each { length: 5 } as _, index (index)}
									<div class="flex flex-col gap-1">
										<!-- Year label placeholder -->
										<div class="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>

										<!-- Bar container -->
										<div class="relative h-48">
											<!-- Zero baseline -->
											<div
												class="absolute inset-x-0 border-t-2 border-gray-400 dark:border-gray-500"
												style="top: 50%;"
											></div>
										</div>

										<!-- Amount labels placeholder -->
										<div class="flex flex-col items-center gap-1">
											<div
												class="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
											></div>
											<div
												class="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
											></div>
											<div class="h-3 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else if displayMode === 'timeframe' && isLoadingBudgetData}
						<!-- Timeframe View - Loading placeholder -->
						{#if viewMode === 'yearly'}
							<div class="space-y-4">
								<div class="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
								<div class="grid grid-cols-3 gap-4">
									{#each { length: 3 } as _, index (index)}
										<div class="flex flex-col gap-1">
											<!-- Budget name placeholder -->
											<div
												class="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
											></div>

											<!-- Bar container -->
											<div class="relative h-48">
												<!-- Zero baseline -->
												<div
													class="absolute inset-x-0 border-t-2 border-gray-400 dark:border-gray-500"
													style="top: 50%;"
												></div>
											</div>

											<!-- Amount labels placeholder -->
											<div class="flex flex-col items-center gap-1">
												<div
													class="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
												></div>
												<div
													class="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
												></div>
												<div
													class="h-3 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
												></div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<!-- Monthly view loading placeholder -->
							<div class="space-y-8">
								{#each { length: 2 } as _, budgetIndex (budgetIndex)}
									<div class="space-y-4">
										<div class="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
										<div class="space-y-2">
											<div
												class="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
											></div>
											<!-- Monthly histogram placeholder -->
											<div class="grid grid-cols-12 gap-1">
												{#each { length: 12 } as _, monthIndex (monthIndex)}
													<div class="flex flex-col gap-1">
														<!-- Month label placeholder -->
														<div
															class="h-3 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
														></div>

														<!-- Bar container -->
														<div class="relative h-32">
															<!-- Zero baseline -->
															<div
																class="absolute inset-x-0 border-t-2 border-gray-400 dark:border-gray-500"
																style="top: 50%;"
															></div>
														</div>
													</div>
												{/each}
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{:else if displayMode === 'timeframe' && stableFilteredData.data.length > 0}
						<!-- Timeframe View -->
						{@const allValues =
							viewMode === 'monthly'
								? stableFilteredData.data.flatMap((d) =>
										d.values.flatMap((v) =>
											v.monthlySpending.flatMap((m) => [m.currentYear, m.previousYear])
										)
									)
								: stableFilteredData.data.flatMap((d) =>
										d.values.flatMap((v) => {
											const fullBudget =
												s.budgetReportData?.budgetsByNameAndYear[d.name]?.[v.year]?.amount || 0;
											return [v.actualAmount, fullBudget];
										})
									)}
						{@const maxPositive = Math.max(0, ...allValues)}
						{@const maxNegative = Math.abs(Math.min(0, ...allValues))}
						{@const maxScale = Math.max(maxPositive, maxNegative)}
						{@const zeroLinePercent =
							maxScale > 0 ? (maxNegative / (maxPositive + maxNegative)) * 100 : 50}
						{@const monthNames = [
							'Jan',
							'Feb',
							'Mar',
							'Apr',
							'May',
							'Jun',
							'Jul',
							'Aug',
							'Sep',
							'Oct',
							'Nov',
							'Dec'
						]}
						{@const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']}

						{#if viewMode === 'yearly'}
							<!-- Yearly view - all budgets in a single histogram -->
							<div class="space-y-4">
								<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
									{selectedYear}
								</h4>

								<div
									class="grid gap-4"
									style="grid-template-columns: repeat({stableFilteredData.data.length}, 1fr);"
								>
									{#each stableFilteredData.data as budgetData, budgetIndex (budgetData.name)}
										{@const color = colors[budgetIndex % colors.length]}
										{@const yearData = budgetData.values[0]!}
										{@const fullBudgetAmount =
											s.budgetReportData?.budgetsByNameAndYear[budgetData.name]?.[yearData.year]
												?.amount || 0}
										{@const budgetHeightPercent =
											maxScale > 0
												? (Math.abs(fullBudgetAmount) / (maxPositive + maxNegative)) * 100
												: 0}
										{@const actualHeightPercent =
											maxScale > 0
												? (Math.abs(yearData.actualAmount) / (maxPositive + maxNegative)) * 100
												: 0}
										{@const proratedBudgetAmount = yearData.budgetAmount}
										{@const percentOfBudget =
											proratedBudgetAmount !== 0
												? (Math.abs(yearData.actualAmount) / Math.abs(proratedBudgetAmount)) * 100
												: 0}
										{@const isOverBudget = percentOfBudget > 100}
										{@const yearProgressPercent =
											yearData.year === currentYear ? (stableLatestActiveMonth / 12) * 100 : 100}

										<div class="flex flex-col gap-1">
											<!-- Budget name -->
											<div class="text-center text-xs font-medium text-gray-600 dark:text-gray-400">
												{budgetData.name}
											</div>

											<!-- Bar container with zero line baseline -->
											<div class="relative h-48">
												<!-- Zero baseline -->
												<div
													class="absolute inset-x-0 border-t-2 border-gray-400 dark:border-gray-500"
													style="top: {zeroLinePercent}%;"
													title="Zero line"
												></div>

												<!-- Budget bar (left side) -->
												{#if budgetHeightPercent > 0}
													<!-- Outer bar (light gray, full budget) - rounded top when budget is less than max -->
													<div
														class="absolute left-0 w-1/2 overflow-hidden rounded-t-sm bg-gray-300 dark:bg-gray-600"
														style="bottom: {100 -
															zeroLinePercent}%; height: {budgetHeightPercent}%;"
														title="Budget: {formatWholeDollarAmount(Math.abs(fullBudgetAmount), {
															hideSign: true
														})}"
													>
														<!-- Inner fill (darker gray, year progress) -->
														<div
															class="absolute right-0 bottom-0 left-0 bg-gray-500 dark:bg-gray-400"
															style="height: {yearProgressPercent}%;"
															title={yearData.year === currentYear
																? `${stableLatestActiveMonth} of 12 months (${yearProgressPercent.toFixed(0)}%) - based on latest transaction`
																: 'Full year'}
														></div>
													</div>
												{/if}

												<!-- Actual bar (right side) -->
												{#if actualHeightPercent > 0}
													<button
														type="button"
														aria-label="Year {yearData.year}: {formatWholeDollarAmount(
															Math.abs(yearData.actualAmount),
															{ hideSign: true }
														)}"
														class="absolute right-0 w-1/2 cursor-pointer transition-opacity hover:opacity-80 {yearData.actualAmount <
														0
															? 'rounded-t-sm'
															: 'rounded-b-sm'}"
														style="background-color: {yearData.actualAmount > 0
															? '#22c55e'
															: color}; {yearData.actualAmount < 0
															? `bottom: ${100 - zeroLinePercent}%; height: ${actualHeightPercent}%;`
															: `top: ${zeroLinePercent}%; height: ${actualHeightPercent}%;`}"
														title="Actual: {formatWholeDollarAmount(
															Math.abs(yearData.actualAmount),
															{
																hideSign: true
															}
														)} {yearData.actualAmount > 0
															? '(income)'
															: '(expense)'} - Click to view transactions"
														onclick={() =>
															navigateToTransactionsForYear(yearData.year, yearData.categories)}
													></button>
												{/if}
											</div>

											<!-- Amount labels -->
											<div class="text-center">
												<div class="text-xs font-medium text-gray-600 dark:text-gray-400">
													{formatWholeDollarAmount(Math.abs(fullBudgetAmount), {
														hideSign: true
													})}
												</div>
												<div class="text-xs font-medium" style="color: {color};">
													{formatWholeDollarAmount(Math.abs(yearData.actualAmount), {
														hideSign: true
													})}
												</div>
												<div class="text-xs {isOverBudget ? 'text-red-600' : 'text-green-600'}">
													{percentOfBudget.toFixed(0)}%
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<!-- Monthly view -->
							<div class="space-y-8">
								{#each stableFilteredData.data as budgetData, budgetIndex (budgetData.name)}
									{@const color = colors[budgetIndex % colors.length]}
									<div class="space-y-4">
										<h3 class="text-base font-medium">{budgetData.name}</h3>

										{#each budgetData.values as yearData (yearData.year)}
											<div class="space-y-2">
												<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
													{yearData.year}
												</h4>
												<!-- Monthly histogram -->
												<div class="grid grid-cols-12 gap-1">
													{#each yearData.monthlySpending as monthData (monthData.month)}
														{@const currentHeightPercent =
															maxScale > 0
																? (Math.abs(monthData.currentYear) / (maxPositive + maxNegative)) *
																	100
																: 0}
														{@const previousHeightPercent =
															maxScale > 0
																? (Math.abs(monthData.previousYear) / (maxPositive + maxNegative)) *
																	100
																: 0}

														<div class="flex flex-col gap-1">
															<!-- Month label -->
															<div class="text-center text-xs text-gray-600 dark:text-gray-400">
																{monthNames[monthData.month - 1]}
															</div>

															<!-- Bar container with zero line baseline -->
															<div class="relative h-32">
																<!-- Zero baseline -->
																<div
																	class="absolute inset-x-0 border-t-2 border-gray-400 dark:border-gray-500"
																	style="top: {zeroLinePercent}%;"
																	title="Zero line"
																></div>

																<!-- Previous year bar (left side) -->
																{#if previousHeightPercent > 0}
																	<button
																		type="button"
																		aria-label="Previous year ({yearData.year -
																			1}) month {monthData.month}: {formatWholeDollarAmount(
																			monthData.previousYear,
																			{ hideSign: true }
																		)}"
																		class="absolute left-0 w-1/2 cursor-pointer transition-opacity hover:opacity-80 {monthData.previousYear <
																		0
																			? 'rounded-t-sm'
																			: 'rounded-b-sm'} {monthData.previousYear > 0
																			? 'bg-green-400 dark:bg-green-600'
																			: 'bg-gray-500 dark:bg-gray-400'}"
																		style={monthData.previousYear < 0
																			? `bottom: ${100 - zeroLinePercent}%; height: ${previousHeightPercent}%;`
																			: `top: ${zeroLinePercent}%; height: ${previousHeightPercent}%;`}
																		title="Previous year ({yearData.year -
																			1}): {formatWholeDollarAmount(monthData.previousYear, {
																			hideSign: true
																		})} {monthData.previousYear > 0
																			? '(income)'
																			: '(expense)'} - Click to view transactions"
																		onclick={() =>
																			navigateToTransactions(
																				yearData.year - 1,
																				monthData.month,
																				yearData.categories
																			)}
																	></button>
																{/if}

																<!-- Current year bar (right side) -->
																{#if currentHeightPercent > 0}
																	<button
																		type="button"
																		aria-label="Current year ({yearData.year}) month {monthData.month}: {formatWholeDollarAmount(
																			monthData.currentYear,
																			{ hideSign: true }
																		)}"
																		class="absolute right-0 w-1/2 cursor-pointer transition-opacity hover:opacity-80 {monthData.currentYear <
																		0
																			? 'rounded-t-sm'
																			: 'rounded-b-sm'}"
																		style="background-color: {monthData.currentYear > 0
																			? '#22c55e'
																			: color}; {monthData.currentYear < 0
																			? `bottom: ${100 - zeroLinePercent}%; height: ${currentHeightPercent}%;`
																			: `top: ${zeroLinePercent}%; height: ${currentHeightPercent}%;`}"
																		title="Current year ({yearData.year}): {formatWholeDollarAmount(
																			monthData.currentYear,
																			{ hideSign: true }
																		)} {monthData.currentYear > 0
																			? '(income)'
																			: '(expense)'} - Click to view transactions"
																		onclick={() =>
																			navigateToTransactions(
																				yearData.year,
																				monthData.month,
																				yearData.categories
																			)}
																	></button>
																{/if}

																<!-- Monthly budget line (visual reference only) -->
																{#if yearData.monthlyBudgetAmount !== 0}
																	{@const budgetLinePosition =
																		zeroLinePercent -
																		(Math.abs(yearData.monthlyBudgetAmount) /
																			(maxPositive + maxNegative)) *
																			100}
																	<div
																		class="absolute inset-x-0 z-20 border-t-2 border-dashed border-amber-500"
																		style="top: {budgetLinePosition}%;"
																		title="Monthly budget: {formatWholeDollarAmount(
																			Math.abs(yearData.monthlyBudgetAmount),
																			{ hideSign: true }
																		)}"
																	></div>
																{/if}
															</div>

															<!-- Amount labels -->
															<div class="text-center">
																{#if monthData.currentYear !== 0}
																	<div class="text-xs font-medium" style="color: {color};">
																		{monthData.currentYear > 0 ? '+' : ''}{formatWholeDollarAmount(
																			monthData.currentYear,
																			{ hideSign: true }
																		)}
																	</div>
																{/if}
																{#if monthData.previousYear !== 0}
																	<div class="text-xs text-gray-500">
																		{monthData.previousYear > 0 ? '+' : ''}{formatWholeDollarAmount(
																			monthData.previousYear,
																			{ hideSign: true }
																		)}
																	</div>
																{/if}
															</div>
														</div>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								{/each}
							</div>
						{/if}

						<!-- Legend -->
						<div class="mt-6 space-y-2">
							<div class="flex flex-wrap gap-4">
								{#each stableFilteredData.data as budgetData, i (budgetData.name)}
									{@const color = colors[i % colors.length]}
									<div class="flex items-center gap-2">
										<div class="h-4 w-4 rounded" style="background-color: {color}"></div>
										<span class="text-sm text-gray-700 dark:text-gray-300">{budgetData.name}</span>
									</div>
								{/each}
							</div>
							{#if viewMode === 'monthly'}
								<div class="flex gap-6 text-xs text-gray-600 dark:text-gray-400">
									<div class="flex items-center gap-2">
										<div class="h-4 w-4 rounded bg-gray-300 opacity-50"></div>
										<span>Previous Year</span>
									</div>
									<div class="flex items-center gap-2">
										<div class="h-0.5 w-6 border-t-2 border-dashed border-amber-500"></div>
										<span>Monthly Budget</span>
									</div>
								</div>
							{:else}
								<div class="flex gap-6 text-xs text-gray-600 dark:text-gray-400">
									<div class="flex items-center gap-2">
										<div
											class="relative h-4 w-4 overflow-hidden rounded bg-gray-300 dark:bg-gray-600"
										>
											<div
												class="absolute right-0 bottom-0 left-0 h-1/2 bg-gray-500 dark:bg-gray-400"
											></div>
										</div>
										<span>Budget (filled = year progress)</span>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Summary Table -->
		</div>
	{/if}
</div>
