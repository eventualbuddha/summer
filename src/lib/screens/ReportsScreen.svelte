<script lang="ts">
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import type { State } from '$lib/state.svelte';
	import { formatWholeDollarAmount } from '$lib/utils/formatting';
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { BudgetReportData, Category } from '$lib/db';

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

		goto('/');
	}

	const currentYear = new Date().getFullYear();
	let selectedYear = $state<number>(currentYear);
	let selectedBudgetName = $state<string | 'all'>('all');

	// Demo mode detection
	const isDemoMode = $derived($page.url.searchParams.has('demo'));

	// Generate demo data
	function generateDemoData(): BudgetReportData {
		return {
			budgetNames: ['Food', 'Transportation', 'Entertainment'],
			years: [2024, 2025],
			budgetsByNameAndYear: {
				Food: {
					2024: { id: 'demo1', name: 'Food', year: 2024, amount: 60000, categories: [] },
					2025: { id: 'demo2', name: 'Food', year: 2025, amount: 72000, categories: [] }
				},
				Transportation: {
					2024: { id: 'demo3', name: 'Transportation', year: 2024, amount: 40000, categories: [] },
					2025: { id: 'demo4', name: 'Transportation', year: 2025, amount: 48000, categories: [] }
				},
				Entertainment: {
					2024: { id: 'demo5', name: 'Entertainment', year: 2024, amount: 30000, categories: [] },
					2025: { id: 'demo6', name: 'Entertainment', year: 2025, amount: 36000, categories: [] }
				}
			},
			actualSpendingByNameAndYear: {
				Food: { 2024: -58000, 2025: -65000 },
				Transportation: { 2024: -42000, 2025: -45000 },
				Entertainment: { 2024: -28000, 2025: -32000 }
			},
			monthlySpendingByNameYearMonth: {
				Food: {
					2024: {
						1: -5200,
						2: -4800,
						3: -5000,
						4: -4900,
						5: -5100,
						6: -4700,
						7: -4600,
						8: -5300,
						9: -4950,
						10: -5050,
						11: -4200,
						12: -4200
					},
					2025: {
						1: -5500,
						2: -5200,
						3: 8000,
						4: -5300,
						5: -5600,
						6: -5100,
						7: -5400,
						8: -5700,
						9: -5400,
						10: -5500,
						11: -5300,
						12: -5500
					}
				},
				Transportation: {
					2024: {
						1: -3500,
						2: -3400,
						3: -3600,
						4: -3550,
						5: -3450,
						6: -3500,
						7: -3480,
						8: -3520,
						9: -3490,
						10: -3510,
						11: -3400,
						12: -3600
					},
					2025: {
						1: -3800,
						2: -3700,
						3: -3900,
						4: -3750,
						5: -3650,
						6: -3700,
						7: -3680,
						8: -3820,
						9: -3790,
						10: -3810,
						11: -3700,
						12: -3900
					}
				},
				Entertainment: {
					2024: {
						1: -2400,
						2: -2300,
						3: -2500,
						4: -2350,
						5: -2250,
						6: -2400,
						7: -2380,
						8: -2420,
						9: -2290,
						10: -2310,
						11: -2200,
						12: -2200
					},
					2025: {
						1: -2700,
						2: -2600,
						3: -2800,
						4: -2650,
						5: -2550,
						6: -2700,
						7: -2680,
						8: -2720,
						9: -2690,
						10: -2710,
						11: -2600,
						12: -2800
					}
				}
			},
			previousYearSpendingByNameYearMonth: {
				Food: {
					2025: {
						1: -5200,
						2: -4800,
						3: -5000,
						4: -4900,
						5: -5100,
						6: -4700,
						7: -4600,
						8: -5300,
						9: -4950,
						10: -5050,
						11: -4200,
						12: -4200
					}
				},
				Transportation: {
					2025: {
						1: -3500,
						2: -3400,
						3: -3600,
						4: -3550,
						5: -3450,
						6: -3500,
						7: -3480,
						8: -3520,
						9: -3490,
						10: -3510,
						11: -3400,
						12: -3600
					}
				},
				Entertainment: {
					2025: {
						1: -2400,
						2: -2300,
						3: -2500,
						4: -2350,
						5: -2250,
						6: -2400,
						7: -2380,
						8: -2420,
						9: -2290,
						10: -2310,
						11: -2200,
						12: -2200
					}
				}
			}
		};
	}

	// Filtered data based on selections
	const filteredData = $derived.by(() => {
		const sourceData = isDemoMode ? generateDemoData() : s.budgetReportData;

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

		// Filter budget names
		const filteredBudgetNames = selectedBudgetName === 'all' ? budgetNames : [selectedBudgetName];

		// Create chart data
		const data = filteredBudgetNames.map((budgetName) => ({
			name: budgetName,
			values: filteredYears.map((year) => ({
				year,
				budgetAmount: budgetsByNameAndYear[budgetName]?.[year]?.amount || 0,
				actualAmount: actualSpendingByNameAndYear[budgetName]?.[year] || 0,
				monthlyBudgetAmount: (budgetsByNameAndYear[budgetName]?.[year]?.amount || 0) / 12,
				categories: budgetsByNameAndYear[budgetName]?.[year]?.categories || [],
				monthlySpending: Array.from({ length: 12 }, (_, i) => ({
					month: i + 1,
					currentYear: monthlySpendingByNameYearMonth[budgetName]?.[year]?.[i + 1] || 0,
					previousYear: previousYearSpendingByNameYearMonth[budgetName]?.[year]?.[i + 1] || 0
				}))
			}))
		}));

		return { budgetNames: filteredBudgetNames, years: sortedYears, data };
	});

	onMount(async () => {
		if (!isDemoMode) {
			await s.loadBudgetReportData();
		}
	});
</script>

<title>Reports – Summer</title>

<div class="flex flex-row items-center gap-4">
	<NavigationButton />
	<h1 class="text-2xl font-bold">Budget Reports</h1>
</div>

<div class="flex min-h-0 flex-col overflow-y-auto">
	{#if !isDemoMode && !s.budgetReportData}
		<div class="flex flex-col items-center justify-center p-8">
			<div class="text-lg">Loading budget data...</div>
		</div>
	{:else}
		{@const displayData = isDemoMode ? generateDemoData() : s.budgetReportData}
		{#if displayData && displayData.budgetNames.length === 0}
			<div class="flex flex-col items-center justify-center p-8">
				<div class="text-lg text-gray-600">No budget data available</div>
				<div class="mt-2 text-sm text-gray-500">Create some budgets to see reports</div>
			</div>
		{:else if displayData}
			<div class="space-y-6 pb-8">
				<!-- Chart -->
				{#if filteredData?.data && filteredData.data.length > 0 && filteredData?.years && filteredData.years.length > 0}
					<div
						class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-600 dark:bg-gray-800"
					>
						<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
							<h2 class="text-lg font-semibold">Monthly Spending</h2>

							<div class="flex flex-wrap items-center gap-3">
								{#if isDemoMode}
									<div
										class="flex items-center rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-900 dark:text-blue-200"
									>
										Demo Mode
									</div>
								{/if}

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
										{#each [...displayData.years].sort((a, b) => b - a) as year (year)}
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
									<select
										id="budget-filter"
										bind:value={selectedBudgetName}
										class="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
									>
										<option value="all">All Budgets</option>
										{#each displayData.budgetNames as budgetName (budgetName)}
											<option value={budgetName}>{budgetName}</option>
										{/each}
									</select>
								</div>
							</div>
						</div>

						{#if filteredData.data.length > 0}
							{@const allValues = filteredData.data.flatMap((d) =>
								d.values.flatMap((v) =>
									v.monthlySpending.flatMap((m) => [m.currentYear, m.previousYear])
								)
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

							<div class="space-y-8">
								{#each filteredData.data as budgetData, budgetIndex (budgetData.name)}
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

							<!-- Legend -->
							<div class="mt-6 space-y-2">
								<div class="flex flex-wrap gap-4">
									{#each filteredData.data as budgetData, i (budgetData.name)}
										{@const color = colors[i % colors.length]}
										<div class="flex items-center gap-2">
											<div class="h-4 w-4 rounded" style="background-color: {color}"></div>
											<span class="text-sm text-gray-700 dark:text-gray-300">{budgetData.name}</span
											>
										</div>
									{/each}
								</div>
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
							</div>
						{/if}
					</div>
				{:else}
					<div
						class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-600 dark:bg-gray-800"
					>
						<div class="text-center text-gray-600 dark:text-gray-400">
							No data available for the selected filters
						</div>
					</div>
				{/if}

				<!-- Summary Table -->
			</div>
		{/if}
	{/if}
</div>
