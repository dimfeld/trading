<script context="module">
  import ky from '../ssr-ky.ts';
  export async function preload() {
    let data = await ky('api/base_data').then((r) => r.json());
    return { baseData: data };
  }
</script>

<script>
  import Notifications from 'svelte-notifications';
  import Notification from '../components/Notification.svelte';
  import syncMachine from '../state_manager/sync/naiveClient.ts';
  import quotesStore from '../quotes';
  import { SvelteStore } from '../state_manager/stores.ts';
  import { onMount, setContext } from 'svelte';
  import { derived } from 'svelte/store';
  import { scale } from 'svelte/transition';
  import each from 'lodash/each';
  import flatMap from 'lodash/flatMap';
  import groupBy from 'lodash/groupBy';

  export let segment;
  export let baseData;

  let stores = {};
  for (let type of ['positions', 'strategies', 'tags', 'potential_positions']) {
    let store = new SvelteStore(type, false, baseData[type] || {});
    stores[type] = store;
    setContext(type, store);
  }

  let tradeDict = {};
  each(baseData.positions, (position) => {
    for (let trade of position.trades) {
      tradeDict[trade.id] = trade;
    }
  });

  stores.trades = new SvelteStore('trades', false, tradeDict);
  setContext('trades', stores.trades);

  let positionTrades = derived(stores.trades, (trades) =>
    groupBy(trades, (t) => t.position)
  );
  setContext('positionTrades', positionTrades);

  setContext('quotes', quotesStore());

  onMount(() => {
    let syncer = syncMachine({
      stores,
      sendUrl: 'api/entities',
      recvUrl: null,
    });

    each(stores, (store, type) => {
      store.sync = syncer;
    });

    syncer.start();
  });

  let navOpen = false;
</script>

<style lang="postcss">
  :global(html) {
    position: relative;
    background-color: white;
    margin: 0;
    box-sizing: border-box;
    line-height: 1.2;
    font-family: 'Inter', 'Open Sans', 'Helvetica', 'Verdana', sans-serif;
    font-size: 16px;
  }

  :global(button) {
    border-color: #dee2e6;
    background-color: rgba(0, 0, 0, 0.05);
    box-shadow: 0 1 0 0 rgba(255, 255, 255, 0.15);
    box-shadow: inset 0 1 0 1 rgba(0, 0, 0, 0.075);
    line-height: 1;
    @apply pt-1 pb-1 pl-2 pr-2
      flex-shrink-0
      border;
  }

  :global(input) {
    @apply border pl-1 pr-1;
    line-height: calc(1em + 12px);
    min-height: calc(1em + 12px);
  }

  :global(textarea) {
    @apply border p-1;
  }

  :global(.position-top-right) {
    z-index: 50;
  }

  :global(th) {
    @apply font-normal;
  }
</style>

<svelte:head>
  <link href="https://rsms.me/inter/inter.css" rel="stylesheet" />
</svelte:head>
<Notifications item={Notification}>
  <nav class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex px-2 lg:px-0">
          <div class="hidden lg:ml-6 lg:flex">
            <a
              href="/"
              class:border-green-500={!segment}
              class:focus:border-green-700={!segment}
              class:text-gray-900={!segment}
              class:border-transparent={segment}
              class:focus:border-gray-300={segment}
              class:focus:text-gray-700={segment}
              class:hover:text-gray-700={segment}
              class:hover:border-gray-300={segment}
              class:text-gray-500={segment}
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm
              font-medium leading-5 focus:outline-none transition duration-150
              ease-in-out">
              Current
            </a>
            <a
              class:border-green-500={segment === 'opening'}
              class:focus:border-green-700={segment === 'opening'}
              class:text-gray-900={segment === 'opening'}
              class:border-transparent={segment !== 'opening'}
              class:focus:border-gray-300={segment !== 'opening'}
              class:focus:text-gray-700={segment !== 'opening'}
              class:hover:text-gray-700={segment !== 'opening'}
              class:hover:border-gray-300={segment !== 'opening'}
              class:text-gray-500={segment !== 'opening'}
              href="/opening"
              class="ml-8 inline-flex items-center px-1 pt-1 border-b-2 text-sm
              font-medium leading-5 focus:outline-none transition duration-150
              ease-in-out">
              Opening
            </a>
          </div>
        </div>
        <div
          class="flex-1 flex items-center justify-center px-2 lg:ml-6
          lg:justify-end">
          <div class="max-w-lg w-full lg:max-w-xs">
            <label for="search" class="sr-only">Search</label>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center
                pointer-events-none">
                <svg
                  class="h-5 w-5 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89
                    3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0
                    012 8z"
                    clip-rule="evenodd" />
                </svg>
              </div>
              <input
                id="search"
                class="block w-full pl-10 pr-3 py-2 border border-gray-300
                rounded-md leading-5 bg-white placeholder-gray-500
                focus:outline-none focus:placeholder-gray-400
                focus:border-blue-300 focus:shadow-outline-blue sm:text-sm
                transition duration-150 ease-in-out"
                placeholder="Search" />
            </div>
          </div>
        </div>
        <div class="flex items-center lg:hidden">
          <button
            on:click={() => (navOpen = !navOpen)}
            class="inline-flex items-center justify-center p-2 rounded-md
            text-gray-400 hover:text-gray-500 hover:bg-gray-100
            focus:outline-none focus:bg-gray-100 focus:text-gray-500 transition
            duration-150 ease-in-out">
            <svg
              class="h-6 w-6"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 24 24">
              <path
                class:hidden={navOpen}
                class:inline-flex={!navOpen}
                class="inline-flex"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16" />
              <path
                class:hidden={!navOpen}
                class:inline-flex={navOpen}
                class="hidden"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div class:block={navOpen} class:hidden={!navOpen} class="hidden lg:hidden">
      <div class="pt-2 pb-3">
        <a
          href="/"
          on:click={() => (navOpen = false)}
          class:border-green-500={!segment}
          class:bg-green-50={!segment}
          class:text-green-700={!segment}
          class:focus-text-green-800={!segment}
          class:focus:bg-green-100={!segment}
          class:focus:border-green-700={!segment}
          class:text-gray-600={segment}
          class:hover:text-gray-800={segment}
          hover:bg-gray-50={segment}
          hover:border-gray-300={segment}
          focus:text-gray-800={segment}
          focus:bg-gray-50={segment}
          focus:border-gray-300={segment}
          class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium
          focus:outline-none transition duration-150 ease-in-out">
          Current
        </a>
        <a
          href="/opening"
          on:click={() => (navOpen = false)}
          class:border-green-500={segment === 'opening'}
          class:bg-green-50={segment === 'opening'}
          class:text-green-700={segment === 'opening'}
          class:focus-text-green-800={segment === 'opening'}
          class:focus:bg-green-100={segment === 'opening'}
          class:focus:border-green-700={segment === 'opening'}
          class:text-gray-600={segment !== 'opening'}
          class:hover:text-gray-800={segment !== 'opening'}
          hover:bg-gray-50={segment !== 'opening'}
          hover:border-gray-300={segment !== 'opening'}
          focus:text-gray-800={segment !== 'opening'}
          focus:bg-gray-50={segment !== 'opening'}
          focus:border-gray-300={segment !== 'opening'}
          class="mt-1 block pl-3 pr-4 py-2 border-l-4 border-transparent
          text-base font-medium focus:outline-none transition duration-150
          ease-in-out">
          Opening
        </a>
      </div>
    </div>
  </nav>

  <main class="flex flex-col w-full ml-auto mr-auto sm:w-11/12">
    <slot />
  </main>
</Notifications>
