<script>
  import Modal from './Modal.svelte';
  import { getContext } from 'svelte';

  export let legs;

  let budget = 1000;
  let size = 1;
  let price = 0;
  let auto = true;

  const quotes = getContext('quotes');

  $: legList = legs.map((leg) => {
    let quote = $quotes.get(leg.symbol) || {};

    return {
      ...leg,
      bid: quote.bid || 0,
      ask: quote.ask || 0,
    };
  });

  $: quotes.registerInterest(
    'orderEntry',
    legs.map((l) => l.symbol)
  );
  onDestroy(() => quotes.unregisterInterest('orderEntry'));

  $: total = legList.reduce(
    (acc, leg) => {
      acc.bid += leg.bid * leg.size;
      acc.ask += leg.ask * leg.size;
    },
    { bid: 0, ask: 0 }
  );

  $: autoPrice = (total.bid + total.ask) / 2;
  $: if (auto) {
    price = autoPrice;
  }

  $: totalOrderPrice = size * price;
</script>

<Modal>
  <span slot="header">Order Entry</span>

  <div class="flex flex-col space-y-4">
    <div class="flex flex-row space-x-2">
      <div>
        <label for="budget">Budget</label>
        <input id="budget" type="number" bind:value={budget} />
      </div>

      <span>{totalOrderPrice}</span>
    </div>

    <div class="flex flex-row space-x-2">
      <span>{total.bid.toFixed(0)} - {total.ask.toFixed(0)}</span>
      <div>
        <label for="price">Price</label>
        <input
          id="price"
          type="number"
          bind:value={price}
          on:keydown={() => (auto = false)} />
        <input id="auto" type="checkbox" bind:checked={auto} />
        <label for="auto">Auto</label>
      </div>

      <div>
        <label for="size">Size</label>
        <input id="size" type="number" min="0" bind:value={size} />
      </div>
    </div>

    <div class="flex flex-col space-y-2">
      {#each legs as leg (leg.symbol)}
        {leg.size}
        {leg.symbol}
        {leg.quote.bid}-{leg.quote.ask}
      {/each}
    </div>
  </div>
</Modal>
