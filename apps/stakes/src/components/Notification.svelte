<script>
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { getNotificationsContext } from 'svelte-notifications';

  export let notification;

  const { removeNotification } = getNotificationsContext();
  const close = () => removeNotification(notification.id);

  let removeAfter =
    notification.removeAfter === 0 ? 0 : notification.removeAfter || 4000;
  if (removeAfter) {
    let timeout = setTimeout(close, removeAfter);
    onDestroy(() => clearTimeout(timeout));
  }

  const theme = notification.type || 'success';
  const buttons = notification.buttons || [];
</script>

<style lang="postcss">
  .error {
    @apply bg-red-400 text-black;
  }

  .warning {
    @apply bg-yellow-400 text-black;
  }

  .success {
    @apply bg-green-400 text-black;
  }
</style>

<div
  class="{theme} flex flex-col spacing-2 w-full rounded-lg z-50 pl-4 pr-4 pt-2
  pb-2 mt-3 mr-16 shadow-md"
  transition:slide
  on:click={close}>
  <span>{notification.text}</span>
  {#if buttons.length}
    <div class="flex flex-row justify-end spacing-2">
      {#each buttons as button}
        <button on:click={button.handler}>{button.text}</button>
      {/each}
    </div>
  {/if}

</div>
