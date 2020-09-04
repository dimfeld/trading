<script>
  export let items;
  export let selected = items[0].id;

  import { createEventDispatcher } from 'svelte';

  let dispatch = createEventDispatcher();

  function handleClick(id) {
    selected = id;
    dispatch('click', id);
  }
</script>

<span class="relative z-0 inline-flex shadow-sm">
  {#each items as item, index}
    <button
      type="button"
      on:click={() => handleClick(item.id)}
      class:bg-green-200={selected === item.id}
      class:-ml-px={index > 0}
      class:rounded-l-md={index === 0}
      class:rounded-r-md={index === items.length - 1}
      class="relative inline-flex items-center px-4 py-2 border border-gray-300
      bg-white text-sm leading-5 font-medium text-gray-700 hover:text-gray-500
      focus:z-10 focus:outline-none focus:border-blue-300
      focus:shadow-outline-blue active:bg-gray-100 active:text-gray-700
      transition ease-in-out duration-150">
      <slot {item} selected={selected === item.id}>{item.label}</slot>
    </button>
  {/each}
</span>
