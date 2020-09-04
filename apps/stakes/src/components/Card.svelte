<script>
  export let shadow = true;
  export let width = '';
  export let extraClasses = '';
  export let showHeader = true;
  export let showFooter = true;
</script>

<style>
  .card {
    border-color: rgba(0, 0, 0, 0.5);
    @apply flex flex-col flex-shrink-0 flex-grow-0 border rounded-sm bg-white;
  }

  .card-shadow {
    box-shadow: 1px 2px 1px 1px rgba(0, 0, 0, 0.2);
  }

  .card > .header > :global(*) {
    border-color: rgb(179, 179, 179);
    background-color: rgba(212, 217, 234, 1);

    @apply flex flex-row flex-shrink-0 flex-grow-0 items-center
        border-b
        pt-1 pl-1 pr-1 w-full;
  }

  .card > .content {
    @apply flex flex-grow flex-col
        p-2;
  }

  .card > .footer > :global(*) {
    border-color: rgb(179, 179, 179);
    @apply flex flex-row flex-shrink-0 flex-grow-0 items-center
        border-t
        p-2 w-full;
  }
</style>

<div
  class="card {extraClasses}"
  class:card-shadow={shadow}
  style="width:{width};flex-basis:{width}">

  {#if showHeader}
    <div class="header">
      <slot name="header" />
    </div>
  {/if}

  <div class="content">
    <slot />
  </div>

  {#if showFooter}
    <div class="footer">
      <slot name="footer" />
    </div>
  {/if}
</div>
