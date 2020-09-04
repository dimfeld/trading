<script>
  import { fade } from 'svelte/transition';
  export let dim = false;
</script>

<style>
  .vw-cover {
    position: fixed;
    display: flex;
    z-index: 1000;
    margin: 0 !important;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    flex-direction: column;
  }

  .dim-bg {
    background-color: rgba(0, 0, 0, 0.4);
  }

  .vw-center-element {
    margin-top: auto !important;
    margin-bottom: auto !important;
    align-self: center;
    position: relative;
  }
</style>

<div
  on:click
  class="vw-cover"
  class:dim-bg={dim}
  transition:fade={{ duration: 200 }}>
  <div on:click class="vw-center-element">
    <slot />
  </div>
</div>
