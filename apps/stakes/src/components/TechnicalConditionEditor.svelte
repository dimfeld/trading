<script lang="typescript">
  import { maValueLabel } from '../technicals';
  import { DataPoint, TechnicalCondition } from 'options-analysis';

  export let item: TechnicalCondition;

  const numberOptions = new Set([DataPoint.Rsi14, DataPoint.Rsi20]);

  const options = Object.values(DataPoint).map((point) => {
    return { id: point, label: maValueLabel(point) };
  });
</script>

<div class="flex justify-between">
  <select bind:value={item.l}>
    {#each options as { id, label }}
      <option value={id}>{label}</option>
    {/each}
  </select>

  <select bind:value={item.op}>
    <option value=">">&gt;</option>
    <option value="<">&lt;</option>
    <option value=">=">&gt;=</option>
    <option value="<=">&lt;=</option>
  </select>

  {#if typeof item.l === 'string' && numberOptions.has(item.l)}
    <input type="number" value={item.r} />
  {:else}
    <select bind:value={item.l}>
      {#each options as { id, label }}
        <option value={id}>{label}</option>
      {/each}
    </select>
  {/if}
</div>
