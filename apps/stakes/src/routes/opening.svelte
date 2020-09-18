<script context="module">
  import ky from '../ssr-ky.ts';
  export async function preload() {
    let data = await ky('api/entities?potential_positions=*').then((r) =>
      r.json()
    );
    return { initialOpening: data.potential_positions };
  }
</script>

<script lang="typescript">
  import debugMod from 'debug';
  import { getContext, onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { getStructureField } from '../positions';
  import { quoteLabel, QuotesStore } from '../quotes';
  import { analyzeSide, LatestTechnicals, optionInfoFromSymbol } from 'options-analysis';
  import endOfDay from 'date-fns/endOfDay';
  import shortid from 'shortid';
  import { faAngleDown, faAngleRight } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-awesome';
  import Select from 'svelte-select';
  import capitalize from 'lodash/capitalize';
  import each from 'lodash/each';
  import filter from 'lodash/filter';
  import get from 'lodash/get';
  import map from 'lodash/map';
  import flatMap from 'lodash/flatMap';
  import pick from 'lodash/pick';
  import uniq from 'lodash/uniq';
  import uniqBy from 'lodash/uniqBy';
  import toUpper from 'lodash/toUpper';
  import sortBy from 'lodash/sortBy';
  import orderBy from 'lodash/orderBy';
  import { barsStore, technicalsStore, TechnicalsStore } from '../technicals';
  import { BarTimeframe } from 'types';

  const debug = debugMod('opening');

  const maStorageKey = 'opening:ma_data';
  const chainStorageKey = 'opening:chain_data';
  const collapsedKey = 'opening:collapsed';
  const selectedKey = 'opening:selected';
  let collapsed = {};
  let ma = {};
  let chains = {};
  let selectedLegs = {};
  let mounted = false;

  onMount(() => {
    mounted = true;
    ma = JSON.parse(window.sessionStorage.getItem(maStorageKey)) || {};
    chains = JSON.parse(window.sessionStorage.getItem(chainStorageKey)) || {};
    collapsed = JSON.parse(window.localStorage.getItem(collapsedKey)) || {};
    selectedLegs = JSON.parse(window.localStorage.getItem(selectedKey)) || {};
    each(chains, (chain) => updateByLegChain(chain));

    let chainInterval = setInterval(getChains, 120000);
    return () => {
      clearInterval(chainInterval);
      for(let v of technicalsUnsub.values()) {
        v();
      }
    };
  });

  $: mounted && window.sessionStorage.setItem(maStorageKey, JSON.stringify(ma));
  $: mounted &&
    window.sessionStorage.setItem(chainStorageKey, JSON.stringify(chains));
  $: mounted &&
    window.localStorage.setItem(collapsedKey, JSON.stringify(collapsed));
  $: mounted &&
    window.localStorage.setItem(selectedKey, JSON.stringify(selectedLegs));

  export let initialOpening = {};

  let quotesStore : QuotesStore = getContext('quotes');
  let strategies = getContext('strategies');

  $: console.dir($quotesStore);

  $: strategyItems = orderBy(
    filter($strategies, (strategy) =>
      Boolean(get(strategy, ['structure', 'legs']))
    ).map((strategy) => {
      return {
        value: strategy.id,
        label: strategy.name,
      };
    }),
    ['sort', 'label'],
    ['desc', 'asc']
  );

  let potentialPositions = getContext('potential_positions');
  potentialPositions.update(
    (values) => {
      return {
        ...values,
        ...initialOpening,
      };
    },
    { sync: false, undo: false }
  );

  $: collapsed = pick(collapsed, Object.keys($potentialPositions));

  let positionSymbols = new Set();
  $: {
    let symbols = map($potentialPositions, (pos) => pos && pos.symbol).filter(Boolean);
    positionSymbols = new Set(symbols);

    if (mounted) {
      for(let s of symbols) {
        createTechnicalsStore(s);
      }
      getChains(true);
    }
  }

  function missingSymbolData(data) {
    let neededSymbols = [];
    for (let symbol of positionSymbols) {
      if (!data[symbol]) {
        neededSymbols.push(symbol);
      }
    }

    return neededSymbols;
  }

  let technicalsValues = new Map<string, LatestTechnicals>();
  let technicalsUnsub = new Map<string, () => void>();
  function createTechnicalsStore(symbol: string) {
    if(technicalsUnsub.has(symbol)) {
      return;
    }

    let tStore = technicalsStore(quotesStore, barsStore(symbol, BarTimeframe.day), symbol);
    let unsub = tStore.subscribe((latest) => {
      if(latest) {
        technicalsValues.set(symbol, latest);
      }
    });
    technicalsUnsub.set(symbol, unsub);
  }

  // Generate a direct lookup from symbol to contract info.
  let byLegChain = {};
  function updateByLegChain(symbolChain) {
    let buildByLegChain = {};
    each(['callExpDateMap', 'putExpDateMap'], (key) => {
      each(symbolChain[key] || {}, (strikes) => {
        each(strikes, (strike) => {
          each(strike, (contract) => {
            buildByLegChain[contract.symbol] = contract;
          });
        });
      });
    });

    byLegChain = {
      ...byLegChain,
      ...buildByLegChain,
    };
  }

  async function getChains(newOnly = false) {
    let symbols = newOnly
      ? missingSymbolData(chains)
      : Array.from(positionSymbols);
    if (!symbols.length) {
      return;
    }

    for (let symbol of symbols) {
      let symbolChain = await ky(`api/chain/${symbol}`, {
        method: 'POST',
        json: {},
      }).then((r) => r.json());

      updateByLegChain(symbolChain);

      chains = {
        ...chains,
        [symbol]: symbolChain,
      };
    }
  }

  function maValue(symbol: string, item, maData, quotes) {
    if (typeof item === 'string') {
      let value;
      if (item === 'stock_price') {
        let quoteData = quotes.get(symbol);
        return quoteData && (quoteData.mark || quoteData.lastPrice);
      } else {
        return get(maData, [symbol, item]);
      }
    } else {
      return item;
    }
  }

  function maValueText(symbol, item, maData, quotes) {
    if (item === 'stock_price') {
      return quoteLabel(quotes.get(symbol));
    }

    let value = maValue(symbol, item, maData);
    return typeof value === 'number' ? value.toFixed(2) : value;
  }

  const maValueLabels = {
    stock_price: 'Stock',
  };

  function maValueLabel(field) {
    return maValueLabels[field] || toUpper(field);
  }

  function maItemClass(symbol, condition, maData, quotes) {
    let left = maValue(symbol, condition.l, maData, quotes);
    let right = maValue(symbol, condition.r, maData, quotes);

    if (!left || !right) {
      return '';
    }

    let met = false;
    switch (condition.op) {
      case '>':
        met = left > right;
        break;

      case '>=':
        met = left >= right;
        break;

      case '<':
        met = left < right;
        break;

      case '<=':
        met = left <= right;
        break;
    }

    return met ? 'bg-green-200' : 'bg-red-200';
  }

  let allConditionFields = [
    'stock_price',
    'ma5',
    'ma10',
    'ma21',
    'ma50',
    'ma200',
    'rsi',
    'rsi14',
  ];
  function conditionFields(position) {
    let fields = new Set(
      flatMap(position.conditions || [], (condition) => {
        return [condition.l, condition.r].filter(
          (val) => typeof val === 'string'
        );
      })
    );

    return allConditionFields.filter((f) => fields.has(f));
  }

  $: mounted && quotesStore.registerInterest('opening', positionSymbols);
  onDestroy(() => quotesStore.unregisterInterest('opening'));

  function remove(id) {
    potentialPositions.update((values) => {
      delete values[id];
    });
  }

  function legDescKey(positionId, leg) {
    return `${positionId}-${leg.dte}-${leg.type}-${leg.delta}`;
  }

  let positionsWithStrategy = [];
  $: positionsWithStrategy = Object.values($potentialPositions)
    .filter(Boolean)
    .map((position) => {
      return {
        ...position,
        strategyInfo: $strategies[position.strategy],
      };
    });

  $: positionsWithData = sortBy(
    positionsWithStrategy.map((position) => {
      position.conditions =
        getStructureField(['conditions', 'opening'], position) || [];

      let chain = chains[position.symbol] || {};

      // Find the closest candidate contracts, but change the date around so that the
      // expiration date comes at top level. This gives lets us group the leg targets
      // for an expiration together which is a better UI experience.
      let expirations = {};

      let legStructure = getStructureField(['legs'], position) || [];
      for (let legDesc of legStructure) {
        // Look at both the weekly and the monthly expiration, since sometimes the weekly has
        // no liquidity but the monthly does.
        let dte = [legDesc.dte.toString(), legDesc.dte + 'M'];

        let strikeMap;
        let legType = toUpper(legDesc.type);
        if (legType === 'CALL') {
          strikeMap = chain.callExpDateMap;
        } else if (legType === 'PUT') {
          strikeMap = chain.putExpDateMap;
        }

        let matches = strikeMap
          ? analyzeSide(
              {
                dte,
                delta: [legDesc.delta],
              },
              strikeMap
            )
          : [];

        matches = uniqBy(matches, (m) => m.dte);

        let selectedKey = legDescKey(position.id, legDesc);
        if (!selectedLegs[selectedKey]) {
          selectLeg(
            position.id,
            legDesc,
            get(matches, [0, 'deltas', 0, 'contract', 'symbol'])
          );
        }

        for (let match of matches) {
          let matchData = {
            legDesc,
            ...match,
          };

          let matchesForExpiration = expirations[match.expiration];
          if (!matchesForExpiration) {
            expirations[match.expiration] = [matchData];
          } else {
            matchesForExpiration.push(matchData);
          }
        }
      }

      position.legTargets = sortBy(expirations, (e) => e[0].dte);

      // Create information about the position given the selected contracts.
      let bid = 0;
      let ask = 0;

      position.legStructure = legStructure.map((l) => {
        let symbol = selectedLegs[legDescKey(position.id, l)];
        let contract = byLegChain[symbol];

        if (contract) {
          bid += contract.bid * l.size;
          ask += contract.ask * l.size;
        }

        return {
          ...l,
          selected: contract,
        };
      });

      position.totals = {
        bid,
        ask,
      };

      debug('position data', position.symbol, position);

      return position;
    }),
    ['symbol', 'strategyInfo.name']
  );

  let newStrategy;
  let newSymbol = '';
  let symbolBox;
  function addNew() {
    if (newSymbol && newStrategy) {
      let symbols = uniq(
        newSymbol.split(/[, ]/g).map((s) => s.trim().toUpperCase())
      ).filter(Boolean);
      for (let symbol of symbols) {
        let strategy = newStrategy.value;
        let source = 'manual';
        let alreadyExists = find(
          $potentialPositions,
          (pos) =>
            pos.symbol === symbol &&
            pos.strategy === strategy &&
            pos.source === source
        );

        if (alreadyExists) {
          continue;
        }

        potentialPositions.update((values) => {
          let pos = {
            id: shortid.generate(),
            symbol,
            strategy,
            source,
            expires: endOfDay(new Date()),
            structure: null,
            notes: null,
            opened: false,
          };

          values[pos.id] = pos;
        });
      }

      newSymbol = '';
      setTimeout(() => (newStrategy = undefined), 0);
      symbolBox.focus();
    }
  }

  function matchDteText(match) {
    return match.requireMonthly ? `${match.dte}M` : match.dte;
  }

  function handleEnter({ key }) {
    if (key === 'Enter') {
      addNew();
    }
  }

  function optionMeetsLiquidityRequirements(option) {
    let spreadPercent = (option.ask - option.bid) / option.bid;
    let acceptablePercent =
      (option.ask > 1 && spreadPercent < 0.2) ||
      (option.ask < 1 && spreadPercent < 0.4);

    return (
      (option.totalVolume > 5 || option.openInterest > 5) && acceptablePercent
    );
  }

  function toggleCollapsed(id) {
    collapsed = {
      ...collapsed,
      [id]: !collapsed[id],
    };
  }

  function selectLeg(positionId, legDesc, symbol) {
    let validLegs = flatMap(positionsWithStrategy, (pos) => {
      return (getStructureField(['legs'], pos) || []).map((desc) =>
        legDescKey(pos.id, desc)
      );
    });

    selectedLegs = {
      ...pick(selectedLegs, validLegs),
      [legDescKey(positionId, legDesc)]: symbol,
    };
  }
</script>

<style lang="postcss">
  #condition-values > div:not(:first-child) {
    @apply border-l border-gray-700;
  }
</style>

<div class="flex flex-row items-stretch mt-4 pb-4 spacing-2">

  <div>
    <label for="new-symbols" class="sr-only">New Symbols</label>
    <div class="relative rounded-md shadow-sm">
      <input
        id="new-symbols"
        class="form-input block w-full sm:text-sm sm:leading-5"
        placeholder="New Symbols"
        on:keyup={handleEnter}
        bind:value={newSymbol}
        bind:this={symbolBox} />
    </div>
  </div>

  <div class="flex-grow">
    <Select
      items={strategyItems}
      placeholder="Select a Strategy"
      bind:selectedValue={newStrategy}
      on:select={addNew} />
  </div>
  <button on:click={addNew}>Add</button>
</div>

{#each positionsWithData as position (position.id)}
  <div class="flex flex-row flex-grow py-4" in:slide|local>
    <div class="flex flex-col w-full spacing-2">
      <div class="flex flex-row w-full">
        {position.symbol}
        <span class="ml-2 text-gray-700">{position.strategyInfo.name}</span>

        <button class="ml-auto" on:click={() => remove(position.id)}>
          Remove
        </button>

      </div>
      <div class="flex flex-row spacing-4">
        {#each position.conditions as condition}
          <span
            class="rounded-lg py-1 px-3 {maItemClass(position.symbol, condition, ma, $quotesStore)}">
            {maValueLabel(condition.l)} {condition.op}
            {maValueLabel(condition.r)}
          </span>
        {/each}
      </div>
      <div class="flex flex-row" id="condition-values">
        {#each conditionFields(position) as field}
          <div class="px-2">
            <span>{maValueLabel(field)}</span>
            <span class="text-gray-700">
              {maValueText(position.symbol, field, ma, $quotesStore) || '...'}
            </span>
          </div>
        {/each}
      </div>

      <div class="mt-4">
        <div
          class="inline cursor-pointer"
          on:click={() => toggleCollapsed(position.id)}>
          Structure
          <Icon data={collapsed[position.id] ? faAngleRight : faAngleDown} />
        </div>
      </div>
      {#if !collapsed[position.id]}
        <div transition:slide|local class="flex flex-col sm:flex-row spacing-4">
          <div class="flex flex-col w-full ml-2 spacing-4">
            {#each position.legTargets as dateLegs}
              <div class="flex flex-col w-full">
                <span>
                  {dateLegs[0].expiration} ({matchDteText(dateLegs[0])})
                </span>
                <div class="flex flex-col w-full px-2 spacing-2">
                  {#each dateLegs as match}
                    <div class="w-full">

                      <table class="w-full pl-2 lg:w-4/6">
                        <thead>
                          <th class="text-left">
                            {match.legDesc.size} {match.legDesc.dte}DTE {match.legDesc.delta}
                            Delta {capitalize(match.legDesc.type)}
                          </th>
                          <th class="w-1/6 text-right">D</th>
                          <th class="w-1/3 text-right sm:w-1/6">B/A</th>
                          <th class="w-1/6 text-right">OI</th>
                          <th class="w-1/6 text-right">V</th>
                        </thead>
                        <tbody>
                          {#each sortBy(get(match, ['deltas', 0, 'contracts'], []), 'strikePrice') as contract (contract.strikePrice)}
                            <tr
                              on:click={() => selectLeg(position.id, match.legDesc, contract.symbol)}
                              class="cursor-pointer"
                              class:bg-gray-300={selectedLegs[legDescKey(position.id, match.legDesc)] === contract.symbol}
                              class:hover:bg-gray-200={selectedLegs[legDescKey(position.id, match.legDesc)] !== contract.symbol}
                              class:text-gray-500={!optionMeetsLiquidityRequirements(contract)}>
                              <td>${contract.strikePrice}</td>
                              <td class="w-1/6 text-right">
                                {(Math.abs(contract.delta) * 100).toFixed(0)}
                              </td>
                              <td class="w-1/3 text-right sm:w-1/6">
                                {contract.bid.toFixed(2)} - {contract.ask.toFixed(2)}
                              </td>
                              <td class="w-1/6 text-right">
                                {contract.openInterest}
                              </td>
                              <td class="w-1/6 text-right">
                                {contract.totalVolume}
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
          <div
            class="flex flex-col pl-2 border-l-0 border-gray-700 sm:border-l
            spacing-2">
            Position
            <span>
              {position.totals.bid.toFixed(2)} - {position.totals.ask.toFixed(2)}
            </span>
            {#each position.legStructure as leg}
              <span>
                {#if leg.selected}{leg.selected.symbol}{/if}
              </span>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{:else}No positions waiting to open{/each}
