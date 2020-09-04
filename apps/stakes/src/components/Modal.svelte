<script>
  import VwCenter from './VwCentered.svelte';
  import Card from './Card.svelte';
  import { createEventDispatcher } from 'svelte';

  export let width = '500px';
  export let dim = true;

  const dispatch = createEventDispatcher();

  let cardDiv;

  function handleKey({ key }) {
    if (key === 'Escape') {
      event.preventDefault();
      dispatch('escPressed');
    }
  }

  function outerClick({ target }) {
    if (!cardDiv.contains(target)) {
      event.preventDefault();
      dispatch('outerClick');
    }
  }
</script>

<svelte:window on:keyup={handleKey} />

<VwCenter {dim} on:click={outerClick}>
  <div bind:this={cardDiv}>
    <Card {width}>
      <div slot="header" class="flex flex-row w-full">
        <slot name="header" />
      </div>

      <slot />

      <div slot="footer" class="flex flex-row w-full">
        <slot name="footer" />
      </div>
    </Card>
  </div>
</VwCenter>
