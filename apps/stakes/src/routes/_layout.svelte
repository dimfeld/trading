<script context="module" lang="typescript">
  import ky from '../ssr-ky';
  export async function preload() {
    let [positions, strategies, tags] = await Promise.all([
      ky('api/positions').then((r) => r.json()),
      ky('api/strategies').then((r) => r.json()),
      ky('api/tags').then((r) => r.json()),
    ]);
    return { positions, strategies, tags };
  }
</script>

<script lang="typescript">
  import {
    QueryClient,
    QueryClientProvider,
    persistWithLocalStorage,
  } from '@sveltestack/svelte-query';
  import Notifications from 'svelte-notifications';
  import Notification from '../components/Notification.svelte';
  import Main from './_Main.svelte';

  export let segment: string;
  export let positions: Record<string, Position>;
  export let strategies: Record<string, Strategy>;
  export let tags: Record<string, Tag>;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: ({ queryKey }) => ky.get('api/' + queryKey.join('/')).json(),
      },
    },
  });

  persistWithLocalStorage(queryClient);
</script>

<svelte:head>
  <link href="https://rsms.me/inter/inter.css" rel="stylesheet" />
</svelte:head>

<QueryClientProvider client={queryClient}>
  <Notifications item={Notification}>
    <Main {segment} {positions} {strategies} {tags}>
      <slot />
    </Main>
  </Notifications>
</QueryClientProvider>

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
