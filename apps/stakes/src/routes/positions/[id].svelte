<script>
  import { stores } from '@sapper/app';
  import { getContext, onMount, onDestroy } from 'svelte';
  import { scale } from 'svelte/transition';
  import { cubicIn, cubicOut } from 'svelte/easing';
  import {
    positionInfo,
    optionInfoFromSymbol,
    dateFromOccExpiration,
  } from 'options-analysis';
  import { quoteLabel } from '../../quotes.ts';
  import { applyTrade } from '../../positions.ts';
  import differenceInCalendarDays from 'date-fns/differenceInCalendarDays';
  import format from 'date-fns/format';
  import { utcToZonedTime } from 'date-fns-tz';
  import sortBy from 'lodash/sortBy';

  const { page } = stores();
  let positionStore = getContext('positions');
  let tradeStore = getContext('trades');
  let strategyStore = getContext('strategies');
  let quotesStore = getContext('quotes');

  let mounted = false;
  onMount(() => (mounted = true));

  const positionId = $page.params.id;
  $: position = $positionStore[positionId];
  $: positionSymbols = [
    position.symbol,
    ...position.legs.map((leg) => leg.symbol),
  ];

  $: info = positionInfo(position, (symbol) => {
    let quote = $quotesStore.get(symbol);
    return quote && (quote.mark || quote.lastPrice);
  });

  const positionInterestKey = `position:${positionId}`;
  $: mounted &&
    quotesStore.registerInterest(positionInterestKey, positionSymbols);
  onDestroy(() => quotesStore.unregisterInterest(positionInterestKey));

  // Use same time zone as NYSE
  let currentTime = utcToZonedTime(new Date(), 'America/New_York');
  $: legs = sortBy(
    position.legs.map((leg) => {
      let legData = info.legData[leg.symbol];
      let symbolInfo = optionInfoFromSymbol(leg.symbol);
      let averagePrice =
        legData.totalBasis / legData.maxLegs / legData.multiplier;

      let isOption = Boolean(symbolInfo.expiration);

      let dte = -1;
      let expirationLabel = '';
      if (isOption) {
        let expiration = dateFromOccExpiration(symbolInfo.expiration);
        expirationLabel = format(expiration, 'MMM d yy');
        dte = differenceInCalendarDays(expiration, currentTime);
      }

      let currentQuote = $quotesStore.get(leg.symbol);
      let currentPrice = quoteLabel(currentQuote);

      return {
        ...leg,
        ...symbolInfo,
        currentPrice,
        info: legData,
        averagePrice,
        dte,
        expirationLabel,
      };
    }),
    ['dte', 'strike', 'call']
  );

  function toggleCloseDate() {
    let newCloseDate = position.close_date ? null : new Date().toISOString();
    positionStore.update((positions) => {
      positions[positionId].close_date = newCloseDate;
    });
  }

  function symbolLabel(symbol) {
    let leg = optionInfoFromSymbol(symbol);
    if (leg.expiration) {
      let expiration = dateFromOccExpiration(leg.expiration);
      let expirationLabel = format(expiration, 'MMM d yy');
      let callPut = leg.call ? 'Call' : 'Put';
      return `${expirationLabel} ${leg.strike} ${callPut}`;
    } else {
      return 'Shares';
    }
  }

  let exerciseDropdown = null;
  let exercisedNumContracts;
  function toggleExerciseDropdown(leg) {
    if (exerciseDropdown === leg.symbol) {
      exerciseDropdown = null;
    } else {
      exerciseDropdown = leg.symbol;
      exercisedNumContracts = Math.abs(leg.size);
    }
  }

  function applyExercise(leg) {
    // If it's long, then the multiplier is negative because we're removing it.
    let optionLongMultiplier = leg.size > 0 ? -1 : 1;
    let longOptionBuysMultiplier = leg.call ? -1 : 1;
    let stockShares =
      100 *
      optionLongMultiplier *
      longOptionBuysMultiplier *
      exercisedNumContracts;

    let tradeLegs = [
      { symbol: leg.underlying, size: stockShares, price: leg.strike },
      {
        symbol: leg.symbol,
        size: exercisedNumContracts * optionLongMultiplier,
        price: 0,
      },
    ];

    let result = applyTrade(position, tradeLegs);
    tradeStore.update((t) => {
      t[result.trade.id] = result.trade;
    });

    positionStore.update((positions) => {
      positions[result.position.id] = result.position;
    });
  }

  function clickOutside(node, cb) {
    let handler = ({ target }) => {
      if (!node.contains(target)) {
        cb();
      }
    };

    window.addEventListener('click', handler);
    return {
      destroy() {
        window.removeEventListener('click', handler);
      },
    };
  }
</script>

<div class="flex flex-col m-2 spacing-1">
  <a href="/">&lt; Back</a>

  <p>{position.symbol}</p>

  <div class="flex flex-col sm:flex-row">

    <div class="flex flex-col">
      <table style="max-width:800px">
        <thead>
          <th class="p-1 pr-2 text-left">Leg</th>
          <th class="p-1 pr-2 text-right">Size</th>
          <th class="p-1 pr-2 text-left">DTE</th>
          <th class="p-1 pr-2 text-right">Current</th>
          <th class="pr-2 text-right p1">Trade Price</th>
          <th />
        </thead>
        <tbody>
          {#each legs as leg (leg.symbol)}
            <tr>
              <td class="p-1 pr-2">{symbolLabel(leg.symbol)}</td>
              <td class="p-1 pr-2 text-right">{leg.size}</td>
              <td class="p-1 pr-2">{leg.dte >= 0 ? leg.dte : ''}</td>
              <td class="p-1 pr-2 text-right w-48">{leg.currentPrice}</td>
              <td class="p-1 pr-2 text-right">{leg.averagePrice.toFixed(2)}</td>
              <td>
                {#if leg.expiration}
                  <div
                    use:clickOutside={() => {
                      if (exerciseDropdown === leg.symbol) {
                        exerciseDropdown = null;
                      }
                    }}
                    class="relative inline-block text-left">
                    <div>
                      <span class="rounded-md shadow-sm">
                        <button
                          on:click={() => toggleExerciseDropdown(leg)}
                          type="button"
                          class="inline-flex justify-center w-full rounded-md
                          border border-gray-300 px-4 py-2 bg-white text-sm
                          leading-5 font-medium text-gray-700
                          hover:text-gray-500 focus:outline-none
                          focus:border-blue-300 focus:shadow-outline-blue
                          active:bg-gray-50 active:text-gray-800 transition
                          ease-in-out duration-150">
                          {leg.size < 0 ? 'Assigned' : 'Exercised'}
                          <svg
                            class="-mr-1 ml-2 h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20">
                            <path
                              fill-rule="evenodd"
                              d="M5.293 7.293a1 1 0 011.414 0L10
                              10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0
                              01-1.414 0l-4-4a1 1 0 010-1.414z"
                              clip-rule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    </div>
                    {#if exerciseDropdown === leg.symbol}
                      <div
                        in:scale={{ duration: 100, start: 0.95, easing: cubicOut }}
                        out:scale={{ duration: 75, start: 0.95, easing: cubicIn }}
                        style="width:max-content"
                        class="origin-top-right absolute right-0 mt-2 rounded-md
                        shadow-lg z-20">
                        <div class="rounded-md bg-white shadow-xs p-2">

                          <div class="px-4 py-5 sm:p-6">
                            <h3
                              class="text-lg leading-6 font-medium text-gray-900">
                              Number of Contracts
                            </h3>
                            <div class="mt-5 sm:flex sm:items-center">
                              <div class="max-w-xs w-full">
                                <label for="numContracts" class="sr-only">
                                  Number of Contracts
                                </label>
                                <div class="relative rounded-md shadow-sm">
                                  <input
                                    id="numContracts"
                                    type="number"
                                    step="1"
                                    class="form-input block w-full sm:text-sm
                                    sm:leading-5"
                                    bind:value={exercisedNumContracts} />
                                </div>
                              </div>
                              <span
                                class="mt-3 w-full inline-flex rounded-md
                                shadow-sm sm:mt-0 sm:ml-3 sm:w-auto">
                                <button
                                  type="button"
                                  on:click={() => applyExercise(leg)}
                                  class="w-full inline-flex items-center
                                  justify-center px-4 py-2 border
                                  border-transparent font-medium rounded-md
                                  text-white bg-indigo-600 hover:bg-indigo-500
                                  focus:outline-none focus:border-indigo-700
                                  focus:shadow-outline-indigo
                                  active:bg-indigo-700 transition ease-in-out
                                  duration-150 sm:w-auto sm:text-sm sm:leading-5">
                                  Apply
                                </button>
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      <div class="mt-4">
        Trades
        <table class="w-full">
          <thead>
            <th class="text-left p-1 pr-2 ">Leg</th>
            <th class="text-right p-1 pr-2 ">Size</th>
            <th class="text-right p-1 pr-2 ">Price</th>
            <th class="text-left p-1 pr-2 ">Date</th>
          </thead>
          <tbody>
            {#each position.trades as trade (trade.id)}
              {#each trade.legs as leg (leg.symbol)}
                <tr>
                  <td class="p-1 pr-2">{symbolLabel(leg.symbol)}</td>
                  <td class="p-1 pr-2 text-right">{leg.size}</td>
                  <td class="p-1 pr-2 text-right">{leg.price}</td>
                  <td class="p-1 pr-2">
                    {format(new Date(trade.traded), 'yyyy-MM-dd')}
                  </td>
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex flex-col mt-2 sm:ml-8 sm:mt-0 spacing-2">
      <button on:click={toggleCloseDate}>
        Mark {position.close_date ? 'Open' : 'Closed'}
      </button>
      <button>Submit Closing Position</button>
    </div>

  </div>

</div>