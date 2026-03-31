<script>
  import { mdiLoading } from '@mdi/js';
  import { onMount } from 'svelte';

  import { t } from 'svelte-i18n';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import { getLocalSaveJson, updateSave } from '../../stores/saveManager';
  import { parseGoodLoadout } from '../../functions/goodLoadout';
  import { parseGoodMaterials } from '../../functions/goodMaterials';
  import { buildGoodExportFromSaveData, buildUniversalExportFromSaveData, UNIVERSAL_EXPORT_KEY } from '../../functions/goodExport';
  import { pushToast } from '../../stores/toast';

  let input;
  let files = null;
  let loading = false;
  export let immediate = false;

  async function exportData() {
    const localData = JSON.parse(await getLocalSaveJson());
    const universal = buildUniversalExportFromSaveData(localData);
    downloadData(JSON.stringify(universal), 'paimon-moe-local-data');
  }

  async function exportGoodData() {
    const localData = JSON.parse(await getLocalSaveJson());
    const goodData = buildGoodExportFromSaveData(localData);
    downloadData(JSON.stringify(goodData), 'paimon-moe-good-data');
  }

  function downloadData(data, name) {
    const fileLink = document.createElement('a');

    const filename = `${name}.json`;
    const dataStr = encodeURIComponent(data);

    fileLink.setAttribute('href', `data:text/json;charset=utf-8,${dataStr}`);
    fileLink.setAttribute('download', filename);
    document.body.appendChild(fileLink);
    fileLink.click();
  }

  async function importData() {
    if (!files || !files[0]) return;
    loading = true;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result);
        const data = { ...imported };

        const universal = imported?.[UNIVERSAL_EXPORT_KEY];
        if (universal && typeof universal === 'object') {
          const goodPayload = universal.good;

          const hasGoodInventory = data['good-inventory'] && typeof data['good-inventory'] === 'object';
          const hasMaterialInventory = data['material-inventory'] && typeof data['material-inventory'] === 'object';

          if (!hasGoodInventory && goodPayload && typeof goodPayload === 'object') {
            const parsedLoadout = parseGoodLoadout(goodPayload);
            if (parsedLoadout.ok) {
              data['good-inventory'] = parsedLoadout.data;
            }
          }

          if (!hasMaterialInventory && goodPayload && typeof goodPayload === 'object') {
            const parsedMaterials = parseGoodMaterials(goodPayload);
            if (parsedMaterials.ok) {
              data['material-inventory'] = parsedMaterials.entries;
            }
          }

          delete data[UNIVERSAL_EXPORT_KEY];
        }

        await localforage.clear();
        for (const key in data) {
          await updateSave(key, data[key], true);
        }
        pushToast($t('settings.importSuccess'));
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } catch (err) {
        pushToast($t('settings.importFailed'), 'error');
      } finally {
        loading = false;
      }
    };

    reader.onerror = () => {
      loading = false;
      pushToast($t('settings.importFailed'), 'error');
    };

    reader.readAsText(files[0]);
  }

  onMount(() => {
    if (immediate) exportData();
  });
</script>

<div class="bg-background rounded-xl p-4 mb-4">
  <p class="text-white font-bold">{$t('settings.export')}</p>
  <p class="text-gray-400 mb-2">{$t('settings.exportInfo')}</p>
  <div class="flex flex-wrap gap-2">
    <Button on:click={exportData}>{$t('settings.download')}</Button>
    <Button on:click={exportGoodData}>{$t('settings.downloadGood')}</Button>
  </div>
</div>
<div class="bg-background rounded-xl p-4">
  <p class="text-white font-bold">{$t('settings.import')}</p>
  <p class="text-red-400 mb-2">{$t('settings.importWarning')}</p>
  {#if !loading}
    <div class="flex">
      <Button className="mr-2 overflow-hidden whitespace-nowrap" on:click={() => input.click()}>
        {files !== null && files[0] ? files[0].name : $t('settings.selectFile')}
      </Button>
      {#if files !== null && files[0]}
        <Button on:click={importData}>{$t('settings.importContinue')}</Button>
      {/if}
    </div>
  {/if}
  {#if loading}<Icon path={mdiLoading} color="white" spin />{/if}
  <input bind:this={input} bind:files type="file" class="hidden" />
</div>
