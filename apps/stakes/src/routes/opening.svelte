<script lang="typescript">
  import debugMod from 'debug';
  import { onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { getStructureField } from '../positions';
  import { getQuotesStore } from '../quotes';
  import type { OptionLeg } from 'options-analysis';
  import { analyzeSide, optionInfoFromSymbol } from 'options-analysis';
  import endOfDay from 'date-fns/endOfDay';
  import { uid } from 'uid/secure';
  import { faAngleDown } from '@fortawesome/free-solid-svg-icons/faAngleDown';
  import { faAngleRight } from '@fortawesome/free-solid-svg-icons/faAngleRight';
  import Icon from 'svelte-awesome';
  import Select from 'svelte-select';
  import capitalize from 'lodash/capitalize';
  import each from 'lodash/each';
  import get from 'lodash/get';
  import flatMap from 'lodash/flatMap';
  import pick from 'just-pick';
  import uniq from 'lodash/uniq';
  import uniqBy from '@dimfeld/unique-by';
  import toUpper from 'lodash/toUpper';
  import sortBy from 'lodash/sortBy';
  import sorter from 'sorters';
  import type {
    TechnicalsMap,
    TechnicalsConditionOp,
    TechnicalsConditionValue,
    TechnicalsCondition,
  } from '../technicals';
  import {
    barsStore,
    technicalsStore,
    legacyMaKeyTranslator,
    maValue,
    maValueText,
    maValueLabel,
    maItemClass,
    conditionFields,
  } from '../technicals';
  import type { OptionChain } from 'types';
  import { BarTimeframe } from 'types';
  import { strategiesQuery } from '../strategies';
  import {
    potentialPositionsQuery,
    createPotentialPositionMutation,
    deletePotentialPositionMutation,
  } from '../potential_positions';
  import { chainQueries, chainQueryOptions } from '../chains';

  const debug = debugMod('opening');

  const maStorageKey = 'opening:ma_data';
  const chainStorageKey = 'opening:chain_data';
  const collapsedKey = 'opening:collapsed';
  const selectedKey = 'opening:selected';
  let collapsed: Record<string, boolean> = {};
  let selectedLegs = {};
  let mounted = false;

  onMount(() => {
    mounted = true;
    collapsed = JSON.parse(window.localStorage.getItem(collapsedKey) || '{}');
    selectedLegs = JSON.parse(window.localStorage.getItem(selectedKey) || '{}');
  });

  $: mounted &&
    window.localStorage.setItem(collapsedKey, JSON.stringify(collapsed));
  $: mounted &&
    window.localStorage.setItem(selectedKey, JSON.stringify(selectedLegs));

  let quotesStore = getQuotesStore();
  let strategiesQ = strategiesQuery();
  $: strategies = $strategiesQ.data ?? {};

  $: console.dir($quotesStore);

  $: strategyItems = Object.values(strategies)
    .filter((strategy) => Boolean(strategy.structure?.legs))
    .map((strategy) => {
      return {
        value: strategy.id,
        label: strategy.name,
      };
    })
    .sort(sorter({ value: 'sort', descending: true }, { value: 'label' }));

  let potentialPositionsQ = potentialPositionsQuery();
  $: potentialPositions = $potentialPositionsQ.data ?? {};

  $: collapsed = $potentialPositionsQ.isSuccess
    ? Object.keys(potentialPositions).reduce(
        (acc: Record<string, boolean>, key) => {
          // Only keep collapsed state for positions we still have
          acc[key] = collapsed[key];
          return acc;
        },
        {}
      )
    : collapsed ?? {};

  let positionSymbols = new Set<string>();
  $: {
    let symbols = Object.values(potentialPositions)
      .map((pos) => pos?.symbol)
      .filter(Boolean);
    positionSymbols = new Set(symbols);

    if (mounted) {
      for (let s of symbols) {
        createTechnicalsStore(s);
      }

      for (let [symbol, unsub] of technicalsUnsub.entries()) {
        if (!positionSymbols.has(symbol)) {
          unsub();
          technicalsUnsub.delete(symbol);
          technicalsValues.delete(symbol);
        }
      }
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

  let technicalsValues: TechnicalsMap = new Map();
  let technicalsUnsub = new Map<string, () => void>();
  function createTechnicalsStore(symbol: string) {
    if (technicalsUnsub.has(symbol)) {
      return;
    }

    let tStore = technicalsStore(
      quotesStore,
      barsStore(symbol, BarTimeframe.day),
      symbol
    );
    let unsub = tStore.subscribe((latest) => {
      if (latest) {
        console.log('Got latest technicals data', { symbol, latest });
        technicalsValues.set(symbol, latest);
        technicalsValues = technicalsValues;
      }
    });
    technicalsUnsub.set(symbol, unsub);
  }

  // Generate a direct lookup from symbol to contract info.
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

    return buildByLegChain;
  }

  let chainsQ = chainQueries(Array.from(positionSymbols));
  $: chainsQ.setQueries(chainQueryOptions(Array.from(positionSymbols)));
  $: chains = Object.fromEntries(
    $chainsQ
      .filter((q) => q.data)
      .map((q) => [(q.data as OptionChain).symbol, q.data as OptionChain])
  );

  $: byLegChain = Object.values(chains).reduce((acc, symbolChain) => {
    return {
      ...acc,
      ...updateByLegChain(symbolChain),
    };
  }, {});

  $: mounted && quotesStore.registerInterest('opening', positionSymbols);
  onDestroy(() => quotesStore.unregisterInterest('opening'));

  const deleteMutation = deletePotentialPositionMutation();
  function remove(id: string) {
    $deleteMutation.mutate(id);
  }

  function legDescKey(positionId: string, leg: OptionLeg) {
    return `${positionId}-${leg.dte}-${leg.type}-${leg.delta}`;
  }

  $: positionsWithStrategy = Object.values(potentialPositions)
    .filter(Boolean)
    .map((position) => {
      return {
        ...position,
        strategyInfo: strategies[position.strategy],
      };
    });

  $: positionsWithData = positionsWithStrategy
    .map((position) => {
      let conditions =
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

      let legTargets = Object.values(expirations).sort(sorter((e) => e[0].dte));

      // Create information about the position given the selected contracts.
      let bid = 0;
      let ask = 0;

      let positionLegStructure = legStructure.map((l) => {
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

      let totals = {
        bid,
        ask,
      };

      let result = {
        ...position,
        conditions,
        totals,
        legStructure: positionLegStructure,
        legTargets,
      };

      debug('position data', result.symbol, result);

      return result;
    })
    .sort('symbol', 'strategyInfo.name');

  let newStrategy;
  let newSymbol = '';
  let symbolBox;
  let createMutation = createPotentialPositionMutation();
  function addNew() {
    if (newSymbol && newStrategy) {
      let symbols = uniq(
        newSymbol.split(/[, ]/g).map((s) => s.trim().toUpperCase())
      ).filter(Boolean);
      for (let symbol of symbols) {
        let strategy = newStrategy.value;
        let source = 'manual';
        let alreadyExists = Object.values(potentialPositions).find(
          (pos) =>
            pos.symbol === symbol &&
            pos.strategy === strategy &&
            pos.source === source
        );

        if (alreadyExists) {
          continue;
        }

        let pos = {
          id: uid(),
          symbol,
          strategy,
          source,
          expires: endOfDay(new Date()),
          structure: null,
          notes: null,
          opened: false,
        };
        $createMutation.mutate(pos);
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

<div class="flex flex-row items-stretch mt-4 pb-4 space-x-2">
  <div>
    <label for="new-symbols" class="sr-only">New Symbols</label>
    <div class="relative rounded-md shadow-sm">
      <input
        id="new-symbols"
        class="form-input block w-full sm:text-sm sm:leading-5"
        placeholder="New Symbols"
        on:keyup={handleEnter}
        bind:value={newSymbol}
        bind:this={symbolBox}
      />
    </div>
  </div>

  <div class="flex-grow">
    <Select
      items={strategyItems}
      placeholder="Select a Strategy"
      bind:selectedValue={newStrategy}
      on:select={addNew}
    />
  </div>
  <button on:click={addNew}>Add</button>
</div>

{#each positionsWithData as position (position.id)}
  <div class="flex flex-row flex-grow py-4" in:slide|local>
    <div class="flex flex-col w-full space-y-2">
      <div class="flex flex-row w-full">
        {position.symbol}
        <span class="ml-2 text-gray-700">{position.strategyInfo.name}</span>

        <button class="ml-auto" on:click={() => remove(position.id)}>
          Remove
        </button>
      </div>
      <div class="flex flex-row space-x-4">
        {#each position.conditions as condition}
          <span
            class="rounded-lg py-1 px-3 {maItemClass(
              position.symbol,
              condition,
              technicalsValues,
              $quotesStore
            )}"
          >
            {maValueLabel(condition.l)}
            {condition.op}
            {maValueLabel(condition.r)}
          </span>
        {/each}
      </div>
      <div class="flex flex-row" id="condition-values">
        {#each conditionFields(position) as field}
          <div class="px-2">
            <span>{maValueLabel(field)}</span>
            <span class="text-gray-700">
              {maValueText(
                position.symbol,
                field,
                technicalsValues,
                $quotesStore
              ) || '...'}
            </span>
          </div>
        {/each}
      </div>

      <div class="mt-4">
        <div
          class="inline cursor-pointer"
          on:click={() => toggleCollapsed(position.id)}
        >
          Structure
          <Icon data={collapsed[position.id] ? faAngleRight : faAngleDown} />
        </div>
      </div>
      {#if !collapsed[position.id]}
        <div
          transition:slide|local
          class="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
        >
          <div class="flex flex-col w-full ml-2 space-y-4">
            {#each position.legTargets as dateLegs}
              <div class="flex flex-col w-full">
                <span>
                  {dateLegs[0].expiration} ({matchDteText(dateLegs[0])})
                </span>
                <div class="flex flex-col w-full px-2 space-y-2">
                  {#each dateLegs as match}
                    <div class="w-full">
                      <table class="w-full pl-2 lg:w-4/6">
                        <thead>
                          <th class="text-left">
                            {match.legDesc.size}
                            {match.legDesc.dte}DTE {match.legDesc.delta} Delta {capitalize(
                              match.legDesc.type
                            )}
                          </th>
                          <th class="w-1/6 text-right">D</th>
                          <th class="w-1/3 text-right sm:w-1/6">B/A</th>
                          <th class="w-1/6 text-right">OI</th>
                          <th class="w-1/6 text-right">V</th>
                        </thead>
                        <tbody>
                          {#each sortBy(get(match, ['deltas', 0, 'contracts'], []), 'strikePrice') as contract (contract.strikePrice)}
                            <tr
                              on:click={() =>
                                selectLeg(
                                  position.id,
                                  match.legDesc,
                                  contract.symbol
                                )}
                              class="cursor-pointer"
                              class:bg-gray-300={selectedLegs[
                                legDescKey(position.id, match.legDesc)
                              ] === contract.symbol}
                              class:hover:bg-gray-200={selectedLegs[
                                legDescKey(position.id, match.legDesc)
                              ] !== contract.symbol}
                              class:text-gray-500={!optionMeetsLiquidityRequirements(
                                contract
                              )}
                            >
                              <td>${contract.strikePrice}</td>
                              <td class="w-1/6 text-right">
                                {(Math.abs(contract.delta) * 100).toFixed(0)}
                              </td>
                              <td class="w-1/3 text-right sm:w-1/6">
                                {contract.bid.toFixed(2)} - {contract.ask.toFixed(
                                  2
                                )}
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
              space-y-2"
          >
            Position <span>
              {position.totals.bid.toFixed(2)} - {position.totals.ask.toFixed(
                2
              )}
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

<style lang="postcss">
  #condition-values > div:not(:first-child) {
    @apply border-l border-gray-700;
  }
</style>
