<script>
  import get from 'lodash/get';
  import map from 'lodash/map';
  import flatMap from 'lodash/flatMap';
  import minBy from 'lodash/minBy';
  import orderBy from 'lodash/orderBy';
  import groupBy from 'lodash/groupBy';
  import values from 'lodash/values';
  import isNaN from 'lodash/isNaN';
  import differenceInCalendarDays from 'date-fns/differenceInCalendarDays';
  import { getContext } from 'svelte';
  import { positionInfo, optionInfoFromSymbol } from 'options-analysis';

  import { onDestroy, onMount } from 'svelte';
  import { goto } from '@sapper/app';
  import { faAngleUp } from '@fortawesome/free-solid-svg-icons/faAngleUp';
  import { faAngleDown } from '@fortawesome/free-solid-svg-icons/faAngleDown';
  import Select from 'svelte-select';
  import Icon from 'svelte-awesome';
  import ButtonRow from '../components/ButtonRow.svelte';
  import { quoteLabel } from '../quotes.ts';

  let positionStore = getContext('positions');
  let strategyStore = getContext('strategies');
  let quotesStore = getContext('quotes');

  $: allSymbols = new Set(
    flatMap($positionStore, (position) => {
      return [position.symbol, ...position.legs.map((leg) => leg.symbol)];
    })
  );

  $: mounted && quotesStore.registerInterest('allPositions', allSymbols);
  onDestroy(() => quotesStore.unregisterInterest('allPositions'));

  const positionsUiKey = 'positions:ui';
  let sortDirection = true;
  let defaultSortField = 'symbol';
  let sortField = defaultSortField;
  let sortButtonSelect = sortField;
  let selectedStrategies = undefined;
  let closingOnly = false;

  let mounted = false;
  onMount(() => {
    let initialUiSettings = JSON.parse(
      window.localStorage.getItem(positionsUiKey)
    );

    if (initialUiSettings) {
      closingOnly = initialUiSettings.closingOnly;
      sortDirection = initialUiSettings.sortDirection;
      sortField = initialUiSettings.sortField || defaultSortField;
      selectedStrategies = initialUiSettings.selectedStrategies;
      sortButtonSelect = sortField;
    }

    mounted = true;
  });

  $: {
    if (mounted) {
      window.localStorage.setItem(
        positionsUiKey,
        JSON.stringify({
          sortDirection,
          sortField,
          selectedStrategies,
          closingOnly,
        })
      );
    }
  }

  function toggleSort(field) {
    if (sortField === field) {
      if (sortDirection === true) {
        // Sort Descending
        sortDirection = false;
      } else {
        // Back to default sort
        sortDirection = true;
        sortField = defaultSortField;
      }
    } else {
      // Start sorting on this field.
      sortDirection = true;
      sortField = field;
    }

    sortButtonSelect = sortField;
  }

  let positionsWithData = [];
  $: {
    positionsWithData = values($positionStore)
      .filter((position) => !position.close_date)
      .map((position) => {
        let legs = position.legs.map((leg) => {
          return {
            ...leg,
            ...optionInfoFromSymbol(leg.symbol),
          };
        });

        let legsByExpiration = groupBy(
          legs,
          (leg) => leg.expiration || 'stock'
        );
        let legDescriptions = map(legsByExpiration, (legs, expiration) => {
          legs = orderBy(
            legs,
            [(leg) => leg.strike, (leg) => leg.call],
            ['asc', 'asc']
          );

          let label = legs
            .map((leg) => {
              if (leg.expiration) {
                let cp = leg.call ? 'C' : 'P';
                return `${leg.strike}${cp}`;
              } else {
                return `${leg.size} shares`;
              }
            })
            .join('/');

          return {
            label: expiration === 'stock' ? label : `${expiration} ${label}`,
            expiration,
          };
        });

        let legLabel = orderBy(legDescriptions, (d) => d.expiration, ['asc'])
          .map((d) => d.label)
          .join(', ');

        let info = positionInfo(position, (symbol) => {
          let quote = $quotesStore.get(symbol);
          return quote && (quote.mark || quote.lastPrice);
        });

        // if (position.symbol == 'SPX') {
        //   console.dir($quotesStore.get('SPX'));
        //   console.dir(position);
        //   console.dir(info);
        // }

        let nearestExpiration = minBy(legDescriptions, (leg) => leg.expiration);

        let output = {
          ...position,
          strategyInfo: $strategyStore[position.strategy],
          info,
          nearestExpiration: nearestExpiration.expiration,
          legs,
          legLabel,
        };

        return output;
      })
      .filter((position) => {
        if (closingOnly && !shouldClose(position)) {
          return false;
        }

        return true;
      });
  }

  let strategyItems = [];
  $: {
    strategyItems = [];

    let strategyTags = new Set();

    let singleStrategies = map($strategyStore, (strategy) => {
      for (let tag of strategy.tags || []) {
        strategyTags.add(tag);
      }

      return {
        value: strategy.id,
        label: strategy.name,
        isTag: false,
      };
    });

    let tags = Array.from(strategyTags).map((tag) => {
      return {
        value: tag,
        label: tag,
        isTag: true,
      };
    });

    strategyItems = [
      ...orderBy(tags, (s) => s.label, ['asc']),
      ...orderBy(singleStrategies, (s) => s.label, ['asc']),
    ];
  }

  let positions = [];
  $: {
    let selected = selectedStrategies || [];

    let selectedStrategiesSet = new Set();
    let strategyTagsSet = new Set();
    for (let strategy of selected) {
      if (strategy.isTag) {
        strategyTagsSet.add(strategy.value);
      } else {
        selectedStrategiesSet.add(strategy.value);
      }
    }

    positions = orderBy(
      positionsWithData.filter((pos) => {
        if (!selected.length) {
          return true;
        }

        let strategyTags = $strategyStore[pos.strategy].tags || [];
        return (
          selectedStrategiesSet.has(pos.strategy) ||
          strategyTags.some((tag) => strategyTagsSet.has(tag))
        );
      }),
      (a) => get(a, sortField),
      sortDirection ? 'asc' : 'desc'
    );
  }

  function formatPct(p) {
    return isNaN(p) ? '...' : `${p.toFixed(1)}%`;
  }

  function formatMoney(p) {
    if (isNaN(p)) return '...';

    let positive = p >= 0;
    let value = `$${Math.round(Math.abs(p))}`;
    return positive ? value : `(${value})`;
  }

  function formatCostBasis(p) {
    let type = p <= 0 ? 'CR' : 'DB';
    return `$${Math.round(Math.abs(p))} ${type}`;
  }

  function getStructureField(path, position) {
    return (
      get(position, ['strategyInfo', 'structure', ...path]) ||
      get(position, ['structure', ...path])
    );
  }

  const ClosePositionProfitTarget = Symbol('profitTarget');
  const ClosePositionStopLoss = Symbol('stopLoss');
  const ClosePositionOpenDuration = Symbol('openDuration');

  function shouldClose(position) {
    let profitTarget = getStructureField(
      ['conditions', 'closing', 'profit_target'],
      position
    );
    let stopLoss = getStructureField(
      ['conditions', 'closing', 'stop_loss'],
      position
    );
    if (profitTarget && position.info.totalPlPct > profitTarget) {
      return ClosePositionProfitTarget;
    } else if (stopLoss && position.info.totalPlPct < -stopLoss) {
      return ClosePositionStopLoss;
    }

    let closeAfter = getStructureField(
      ['conditions', 'closing', 'after_days'],
      position
    );
    if (
      closeAfter &&
      differenceInCalendarDays(new Date(), new Date(position.open_date)) >=
        closeAfter
    ) {
      return ClosePositionOpenDuration;
    }

    return null;
  }

  const indicatorClasses = {
    [ClosePositionProfitTarget]: 'bg-green-200 hover:bg-green-300',
    [ClosePositionStopLoss]: 'bg-red-200 hover:bg-red-300',
    [ClosePositionOpenDuration]: 'bg-yellow-200 hover:bg-yellow-300',
  };

  function indicatorClass(position) {
    let closeStatus = shouldClose(position);
    return indicatorClasses[closeStatus] || 'hover:bg-gray-200';
  }

  const sortItems = [
    { id: 'symbol', label: 'Symbol' },
    { id: 'info.totalPlPct', label: 'P/L%' },
    { id: 'nearestExpiration', label: 'DTE' },
  ];
</script>

<svelte:head>
  <title>Stakes - Positions</title>
</svelte:head>

<div class="flex flex-col spacing-2 mt-4">
  <div class="flex flex-col sm:inline spacing-2">
    <div class="flex flex-col justify-start sm:flex-row">
      <div
        class="flex flex-row items-center justify-center w-full pl-2 sm:w-auto
          sm:justify-start sm:p-0">
        <div class="hidden mr-2 sm:inline">Sort:</div>
        <ButtonRow
          items={sortItems}
          buttonWidth="100px"
          on:click={(e) => toggleSort(e.detail)}
          bind:selected={sortButtonSelect}
          let:item
          let:selected>
          <span class="flex flex-row">
            {item.label}
            <span class="ml-2 w-4 flex-none">
              {#if selected}
                <Icon data={sortDirection ? faAngleUp : faAngleDown} />
              {/if}
            </span>
          </span>
        </ButtonRow>
      </div>

      <div
        class="flex flex-row items-center flex-grow pl-2 mt-4 spacing-2 sm:mt-0
          sm:ml-4">
        <input type="checkbox" bind:checked={closingOnly} id="closing_only" />
        <label class="flex-grow" for="closing_only">Closing Only</label>
      </div>
    </div>

    <div class="pl-2 pr-2 sm:p-0">
      <Select
        items={strategyItems}
        groupBy={(item) => (item.isTag ? 'Tags' : 'Strategies')}
        isMulti={true}
        placeholder="Filter by Strategies"
        bind:selectedValue={selectedStrategies} />
    </div>
  </div>

  <div class="bg-white shadow overflow-hidden sm:rounded-md">
    <ul>
      {#each positions as position (position.id)}
        <li>
          <a
            href="positions/{position.id}"
            class="block hover:bg-gray-50 focus:outline-none focus:bg-gray-50
              transition duration-150 ease-in-out {indicatorClass(position)}">
            <div class="px-4 py-2 sm:py-4 sm:px-6">
              <div
                class="flex flex-col sm:flex-row items-start sm:items-center
                  sm:items-baseline sm:justify-between">
                <div
                  class="text-sm leading-5 font-medium text-indigo-600 truncate">
                  {position.symbol}
                  <span class="ml-2 text-gray-700">
                    ${quoteLabel($quotesStore.get(position.symbol)) || '...'}
                  </span>
                  <span
                    class="ml-auto text-right text-gray-700 sm:pl-2 sm:ml-2
                      sm:border-l sm:border-gray-700 sm:text-left">
                    {#if position.strategyInfo.short_name}
                      <span class="hidden sm:inline">
                        {position.strategyInfo.name}
                      </span>
                      <span class="inline sm:hidden">
                        {position.strategyInfo.short_name}
                      </span>
                    {:else}{position.strategyInfo.name}{/if}
                  </span>
                </div>
                <div class="sm:ml-2 flex-shrink-0 flex">
                  <span class="inline-flex text-sm leading-5 font-medium">
                    {position.legLabel}
                  </span>
                </div>
              </div>
              <div class="sm:mt-2 sm:flex sm:justify-between">
                <div class="sm:flex">
                  <div class="sm:mr-6 inline text-sm leading-5 text-gray-500">
                    <span class="hidden sm:inline">Total</span>
                    <strong
                      class:text-green-900={position.info.totalPlPct > 1}
                      class:text-red-900={position.info.totalPlPct < -1}>
                      {formatMoney(position.info.totalRealized + position.info.unrealized)}
                      = {formatPct(position.info.totalPlPct)}
                    </strong> from {formatCostBasis(position.info.totalBasis)}
                  </div>
                </div>
                <div
                  class="mt-2 items-center text-sm leading-5 text-gray-500
                    hidden sm:flex sm:mt-0">
                  <span class="inline">
                    Open <strong
                      class:text-green-900={position.info.openPlPct > 1}
                      class:text-red-900={position.info.openPlPct < -1}>
                      {formatMoney(position.info.unrealized)} = {formatPct(position.info.openPlPct)}
                    </strong> from {formatCostBasis(position.info.openBasis)}
                  </span>
                </div>
              </div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</div>
