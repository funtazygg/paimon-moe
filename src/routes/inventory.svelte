<script>
  import { tick } from 'svelte';
  import { t } from 'svelte-i18n';
  import { mdiDatabaseImport, mdiLoading, mdiPin, mdiPinOutline, mdiPlus, mdiViewGrid, mdiViewList } from '@mdi/js';
  import Button from '../components/Button.svelte';
  import Icon from '../components/Icon.svelte';
  import Input from '../components/Input.svelte';
  import artifactData from '../data/artifacts/en.json';
  import { characters } from '../data/characters';
  import { itemList } from '../data/itemList';
  import { weaponList } from '../data/weaponList';
  import { formatStat } from '../helper';
  import { parseGoodLoadout } from '../functions/goodLoadout';
  import { parseGoodMaterials } from '../functions/goodMaterials';
  import { goodInventory, setGoodInventory } from '../stores/goodInventory';
  import { pushToast } from '../stores/toast';
  import { todos } from '../stores/todo';
  import {
    adjustMaterialAmount,
    materialInventory,
    setMaterialInventory,
    setMaterialAmount,
    setMaterialPinned,
  } from '../stores/materialInventory';

  const hiddenIds = new Set(['unknown', 'none', 'any_weapon_1', 'any_weapon_2', 'any_weapon_3']);
  const allMaterialIds = Object.keys(itemList).filter((id) => !hiddenIds.has(id));

  let activeTab = 'materials';
  let input;
  let files = null;
  let importLoading = false;
  let search = '';
  let importResult = null;
  let viewMode = 'list';
  let rows = [];
  let searchCandidates = [];
  let weaponRows = [];
  let artifactRows = [];
  let weaponTypeFilter = 'all';
  let weaponRarityFilter = 'all';
  const artifactStatLabels = {
    hp: 'characters.hp',
    atk: 'characters.atk',
    def: 'characters.def',
    hp_: 'characters.hpPercent',
    atk_: 'characters.atkPercent',
    def_: 'characters.defPercent',
    eleMas: 'characters.em',
    enerRech_: 'characters.er',
    critRate_: 'characters.critRate',
    critDMG_: 'characters.critDamage',
    heal_: 'characters.healingBonus',
    pyro_dmg_: 'characters.pyroDamageBonus',
    hydro_dmg_: 'characters.hydroDamageBonus',
    dendro_dmg_: 'characters.dendroDamageBonus',
    electro_dmg_: 'characters.electroDamageBonus',
    cryo_dmg_: 'characters.cryoDamageBonus',
    anemo_dmg_: 'characters.anemoDamageBonus',
    geo_dmg_: 'characters.geoDamageBonus',
    physical_dmg_: 'characters.physicalDamageBonus',
  };
  const artifactPercentStats = new Set([
    'hp_',
    'atk_',
    'def_',
    'enerRech_',
    'critRate_',
    'critDMG_',
    'heal_',
    'pyro_dmg_',
    'hydro_dmg_',
    'dendro_dmg_',
    'electro_dmg_',
    'cryo_dmg_',
    'anemo_dmg_',
    'geo_dmg_',
    'physical_dmg_',
  ]);

  function fallbackImage(event) {
    if (event?.currentTarget) {
      event.currentTarget.src = '/images/items.png';
    }
  }

  function fallbackWeaponImage(event) {
    if (event?.currentTarget) {
      event.currentTarget.src = '/images/weapons/any_weapon_1.png';
    }
  }

  function fallbackArtifactImage(event) {
    if (event?.currentTarget) {
      event.currentTarget.src = '/images/artifacts/adventurer_flower.png';
    }
  }

  function toReadableKey(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getArtifactStatLabel(statKey) {
    if (artifactStatLabels[statKey]) {
      return $t(artifactStatLabels[statKey]);
    }
    return toReadableKey(statKey);
  }

  function formatArtifactStatValue(statKey, value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return artifactPercentStats.has(statKey) ? `${numeric}%` : `${numeric}`;
  }

  function getTodoRequired(todosList) {
    return todosList.reduce((prev, current) => {
      if (!current?.resources || typeof current.resources !== 'object') return prev;

      for (const [id, amount] of Object.entries(current.resources)) {
        if (!itemList[id]) continue;
        if (prev[id] === undefined) {
          prev[id] = 0;
        }
        prev[id] += Math.max(0, Number(amount) || 0);
      }
      return prev;
    }, {});
  }

  function getInventoryAmount(id, inventoryData = {}) {
    return Math.max(0, Number(inventoryData[id]?.amount) || 0);
  }

  function manualAdjust(id, delta, metadata = {}) {
    adjustMaterialAmount(id, delta, metadata);
  }

  function manualSet(id, value, metadata = {}) {
    const parsed = Number(value);
    setMaterialAmount(id, parsed, metadata);
  }

  function togglePinned(row) {
    const metadata = row.custom ? { name: row.name, image: row.image } : {};
    setMaterialPinned(row.id, !row.pinned, metadata);
  }

  async function importGOOD() {
    if (!files || !files[0]) return;

    importLoading = true;
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const json = JSON.parse(reader.result);
        const parsed = parseGoodMaterials(json);
        const parsedLoadout = parseGoodLoadout(json);

        if (!parsed.ok) {
          pushToast(`${$t('inventoryPage.importError')}: ${parsed.error}`, 'error');
          return;
        }
        if (!parsedLoadout.ok) {
          pushToast(`${$t('inventoryPage.importError')}: ${parsedLoadout.error}`, 'error');
          return;
        }

        setMaterialInventory(parsed.entries);
        setGoodInventory(parsedLoadout.data);
        await tick();
        importResult = parsed;
        pushToast(
          $t('inventoryPage.importSuccess', {
            values: {
              imported: parsed.stats.imported,
              unmapped: parsed.stats.unmapped,
            },
          }),
        );
      } catch (err) {
        pushToast(`${$t('inventoryPage.importError')}: ${err.message}`, 'error');
      } finally {
        if (input) {
          input.value = '';
        }
        files = null;
        importLoading = false;
      }
    };

    reader.onerror = () => {
      importLoading = false;
      pushToast($t('inventoryPage.importError'), 'error');
    };

    reader.readAsText(files[0]);
  }

  function parseRows(todosList, inventoryData, searchText) {
    const required = getTodoRequired(todosList);
    const rows = [];

    const knownIds = new Set([
      ...Object.keys(required),
      ...Object.keys(inventoryData).filter((id) => itemList[id]),
    ]);

    for (const id of knownIds) {
      if (!itemList[id]) continue;

      const requiredAmount = required[id] || 0;
      const inventoryAmount = getInventoryAmount(id, inventoryData);
      rows.push({
        id,
        name: $t(itemList[id].name),
        image: `/images/items/${id}.png`,
        required: requiredAmount,
        inInventory: inventoryAmount,
        remaining: Math.max(0, requiredAmount - inventoryAmount),
        custom: false,
        pinned: inventoryData[id]?.pinned === true,
      });
    }

    for (const [id, entry] of Object.entries(inventoryData)) {
      if (itemList[id]) continue;
      rows.push({
        id,
        name: entry.name || id,
        image: entry.image || '/images/items.png',
        required: 0,
        inInventory: Math.max(0, Number(entry.amount) || 0),
        remaining: 0,
        custom: true,
        pinned: entry.pinned === true,
      });
    }

    const lowered = searchText.trim().toLowerCase();
    const filtered = lowered
      ? rows.filter((row) => row.name.toLowerCase().includes(lowered) || row.id.toLowerCase().includes(lowered))
      : rows;

    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.custom !== b.custom) return a.custom ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }

  function parseSearchCandidates(searchText) {
    const lowered = searchText.trim().toLowerCase();
    if (!lowered) return [];

    return allMaterialIds
      .map((id) => ({
        id,
        name: $t(itemList[id].name),
      }))
      .filter((item) => item.name.toLowerCase().includes(lowered) || item.id.includes(lowered))
      .slice(0, 10);
  }

  function parseWeaponRows(goodData, searchText, typeFilter, rarityFilter) {
    const lowered = searchText.trim().toLowerCase();
    const collection = Array.isArray(goodData.weaponInventory) ? goodData.weaponInventory : [];

    return collection
      .map((entry, index) => {
        const id = entry?.id || '';
        const locationId = entry?.locationId || null;
        const locationName =
          locationId && characters[locationId] ? $t(characters[locationId].name) : toReadableKey(entry?.locationKey || '');
        const weaponName = id && weaponList[id] ? $t(weaponList[id].name) : entry?.name || id || 'Unknown Weapon';
        const secondaryText =
          entry?.secondaryName && entry?.secondaryValue !== null
            ? `${$t(`weapon.${entry.secondaryName}`)} ${formatStat(entry.secondaryValue, entry.secondaryName)}`
            : null;
        const weaponTypeId = weaponList[id]?.type?.id || '';

        return {
          uid: `${id || 'weapon'}_${index}`,
          id,
          name: weaponName,
          locationName,
          image: `/images/weapons/${id || 'any_weapon_1'}.png`,
          level: Number(entry?.level) || 1,
          ascension: Number(entry?.ascension) || 0,
          refinement: Number(entry?.refinement) || 1,
          rarity: Number(entry?.rarity) || 0,
          weaponTypeId,
          atk: Number.isFinite(Number(entry?.atk)) ? Math.round(Number(entry.atk)) : null,
          secondaryText,
          lock: entry?.lock === true,
        };
      })
      .filter((row) => {
        if (!lowered) return true;
        return (
          row.name.toLowerCase().includes(lowered) ||
          row.locationName.toLowerCase().includes(lowered) ||
          row.id.toLowerCase().includes(lowered)
        );
      })
      .filter((row) => {
        if (typeFilter !== 'all' && row.weaponTypeId !== typeFilter) return false;
        if (rarityFilter !== 'all' && row.rarity !== Number(rarityFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.lock !== b.lock) return a.lock ? -1 : 1;
        if (a.rarity !== b.rarity) return b.rarity - a.rarity;
        if (a.level !== b.level) return b.level - a.level;
        return a.name.localeCompare(b.name);
      });
  }

  function parseArtifactRows(goodData, searchText) {
    const lowered = searchText.trim().toLowerCase();
    const collection = Array.isArray(goodData.artifactInventory) ? goodData.artifactInventory : [];

    return collection
      .map((entry, index) => {
        const slot = entry?.slotKey || 'flower';
        const setId = entry?.setId || null;
        const setName =
          setId && artifactData[setId] ? artifactData[setId].name : entry?.setName || toReadableKey(entry?.setKey || '');
        const locationId = entry?.locationId || null;
        const locationName =
          locationId && characters[locationId] ? $t(characters[locationId].name) : toReadableKey(entry?.locationKey || '');
        const substats = Array.isArray(entry?.substats) ? entry.substats : [];

        return {
          uid: `${setId || entry?.setKey || 'artifact'}_${slot}_${index}`,
          slot,
          slotName: toReadableKey(slot),
          setName,
          image: `/images/artifacts/${setId || 'adventurer'}_${slot}.png`,
          level: Number(entry?.level) || 0,
          rarity: Number(entry?.rarity) || 0,
          mainStatKey: entry?.mainStatKey || '',
          locationName,
          lock: entry?.lock === true,
          substats: substats.map((stat) => ({
            key: stat?.key || '',
            label: getArtifactStatLabel(stat?.key || ''),
            value: formatArtifactStatValue(stat?.key || '', stat?.value),
          })),
        };
      })
      .filter((row) => {
        if (!lowered) return true;
        return (
          row.setName.toLowerCase().includes(lowered) ||
          row.slotName.toLowerCase().includes(lowered) ||
          row.locationName.toLowerCase().includes(lowered) ||
          row.mainStatKey.toLowerCase().includes(lowered)
        );
      })
      .sort((a, b) => {
        if (a.lock !== b.lock) return a.lock ? -1 : 1;
        if (a.rarity !== b.rarity) return b.rarity - a.rarity;
        if (a.level !== b.level) return b.level - a.level;
        return a.setName.localeCompare(b.setName);
      });
  }

  $: if (activeTab === 'materials') {
    rows = parseRows($todos, $materialInventory, search);
    searchCandidates = parseSearchCandidates(search);
  } else {
    rows = [];
    searchCandidates = [];
  }

  $: if (activeTab === 'weapons') {
    weaponRows = parseWeaponRows($goodInventory, search, weaponTypeFilter, weaponRarityFilter);
  } else {
    weaponRows = [];
  }

  $: if (activeTab === 'artifacts') {
    artifactRows = parseArtifactRows($goodInventory, search);
  } else {
    artifactRows = [];
  }
</script>

<svelte:head>
  <title>Inventory - Paimon.moe</title>
  <meta
    name="description"
    content="Genshin Impact inventory manager for GOOD materials import and Todo progress tracking."
  />
  <meta
    property="og:description"
    content="Genshin Impact inventory manager for GOOD materials import and Todo progress tracking."
  />
</svelte:head>
<div class="lg:ml-64 pt-20 lg:pt-8 px-4 md:px-8 min-h-screen">
  <h1 class="font-display font-black text-3xl lg:text-5xl text-white">{$t('inventoryPage.title')}</h1>
  <p class="text-gray-400 font-medium mt-1">{$t('inventoryPage.subtitle')}</p>

  <div class="flex flex-wrap gap-2 mt-4">
    <Button className={activeTab === 'artifacts' ? 'bg-primary border-primary' : ''} on:click={() => (activeTab = 'artifacts')}>
      {$t('inventoryPage.tabs.artifacts')}
    </Button>
    <Button className={activeTab === 'weapons' ? 'bg-primary border-primary' : ''} on:click={() => (activeTab = 'weapons')}>
      {$t('inventoryPage.tabs.weapons')}
    </Button>
    <Button className={activeTab === 'materials' ? 'bg-primary border-primary' : ''} on:click={() => (activeTab = 'materials')}>
      {$t('inventoryPage.tabs.materials')}
    </Button>
  </div>

  {#if activeTab !== 'materials'}
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
      <div class="bg-item rounded-xl p-4 text-white xl:col-span-1">
        <p class="font-bold mb-2">{$t('inventoryPage.importTitle')}</p>
        <p class="text-gray-400 mb-3">{$t('inventoryPage.importSubtitle')}</p>

        {#if !importLoading}
          <div class="flex flex-wrap gap-2">
            <Button className="overflow-hidden whitespace-nowrap" on:click={() => input.click()}>
              {files !== null && files[0] ? files[0].name : $t('inventoryPage.selectFile')}
            </Button>
            {#if files !== null && files[0]}
              <Button on:click={importGOOD}>
                <Icon size={0.8} path={mdiDatabaseImport} />
                {$t('inventoryPage.importButton')}
              </Button>
            {/if}
          </div>
        {:else}
          <Icon path={mdiLoading} color="white" spin />
        {/if}

        {#if importResult}
          <div class="mt-3 text-sm">
            <p>
              {$t('inventoryPage.importStats', {
                values: {
                  source: importResult.source,
                  version: importResult.version,
                  imported: importResult.stats.imported,
                  unmapped: importResult.stats.unmapped,
                },
              })}
            </p>
          </div>
        {/if}

        <input bind:this={input} bind:files type="file" class="hidden" />
      </div>

      <div class="bg-item rounded-xl p-4 text-white xl:col-span-2">
        <p class="font-bold mb-2">{$t('inventoryPage.manualTitle')}</p>
        <div class="flex flex-wrap gap-2 mb-2">
          <Button size="sm" className={viewMode === 'list' ? 'bg-primary border-primary' : ''} on:click={() => (viewMode = 'list')}>
            <Icon size={0.8} path={mdiViewList} />
            {$t('inventoryPage.viewModes.list')}
          </Button>
          <Button size="sm" className={viewMode === 'grid' ? 'bg-primary border-primary' : ''} on:click={() => (viewMode = 'grid')}>
            <Icon size={0.8} path={mdiViewGrid} />
            {$t('inventoryPage.viewModes.grid')}
          </Button>
        </div>
        <Input placeholder={$t('inventoryPage.searchPlaceholder')} bind:value={search} />
        {#if activeTab === 'weapons'}
          <div class="mt-3">
            <p class="text-sm text-gray-300 mb-2">{$t('inventoryPage.weaponFilters.type')}</p>
            <div class="flex flex-wrap gap-2">
              <Button size="sm" className={weaponTypeFilter === 'all' ? 'bg-primary border-primary' : ''} on:click={() => (weaponTypeFilter = 'all')}>
                {$t('inventoryPage.weaponFilters.all')}
              </Button>
              <Button size="sm" className={weaponTypeFilter === 'sword' ? 'bg-primary border-primary' : ''} on:click={() => (weaponTypeFilter = 'sword')}>
                {$t('inventoryPage.weaponFilters.sword')}
              </Button>
              <Button size="sm" className={weaponTypeFilter === 'claymore' ? 'bg-primary border-primary' : ''} on:click={() => (weaponTypeFilter = 'claymore')}>
                {$t('inventoryPage.weaponFilters.claymore')}
              </Button>
              <Button size="sm" className={weaponTypeFilter === 'polearm' ? 'bg-primary border-primary' : ''} on:click={() => (weaponTypeFilter = 'polearm')}>
                {$t('inventoryPage.weaponFilters.polearm')}
              </Button>
              <Button size="sm" className={weaponTypeFilter === 'bow' ? 'bg-primary border-primary' : ''} on:click={() => (weaponTypeFilter = 'bow')}>
                {$t('inventoryPage.weaponFilters.bow')}
              </Button>
              <Button size="sm" className={weaponTypeFilter === 'catalyst' ? 'bg-primary border-primary' : ''} on:click={() => (weaponTypeFilter = 'catalyst')}>
                {$t('inventoryPage.weaponFilters.catalyst')}
              </Button>
            </div>
            <p class="text-sm text-gray-300 mt-3 mb-2">{$t('inventoryPage.weaponFilters.rarity')}</p>
            <div class="flex flex-wrap gap-2">
              <Button size="sm" className={weaponRarityFilter === 'all' ? 'bg-primary border-primary' : ''} on:click={() => (weaponRarityFilter = 'all')}>
                {$t('inventoryPage.weaponFilters.all')}
              </Button>
              <Button size="sm" className={weaponRarityFilter === '5' ? 'bg-primary border-primary' : ''} on:click={() => (weaponRarityFilter = '5')}>
                {$t('inventoryPage.weaponFilters.fiveStar')}
              </Button>
              <Button size="sm" className={weaponRarityFilter === '4' ? 'bg-primary border-primary' : ''} on:click={() => (weaponRarityFilter = '4')}>
                {$t('inventoryPage.weaponFilters.fourStar')}
              </Button>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="bg-item rounded-xl p-4 text-white mt-4 mb-8">
      {#key `${activeTab}-${$goodInventory.importedAt || 'none'}`}
      {#if activeTab === 'weapons'}
        {#if weaponRows.length === 0}
          <p class="text-gray-400">Import GOOD to see your weapon inventory.</p>
        {:else if viewMode === 'list'}
          <div class="space-y-2">
            {#each weaponRows as row (row.uid)}
              <div class="bg-background rounded-xl p-3 inventory-card">
                <div class="flex items-start">
                  <img
                    class="w-12 h-12 mr-3 object-contain"
                    src={row.image}
                    alt={row.name}
                    loading="lazy"
                    decoding="async"
                    on:error={fallbackWeaponImage}
                  />
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold leading-tight break-words">{row.name}</p>
                    <p class="text-xs text-gray-400 mt-1">
                      Lv.{row.level} · Asc {row.ascension} · R{row.refinement}
                      {#if row.atk !== null}
                        · {$t('weapon.baseAtk')}: {row.atk}
                      {/if}
                    </p>
                    {#if row.secondaryText}
                      <p class="text-xs text-gray-400 mt-1 break-words">{row.secondaryText}</p>
                    {/if}
                    {#if row.locationName}
                      <p class="text-xs text-gray-500 mt-1">Equipped: {row.locationName}</p>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {#each weaponRows as row (row.uid)}
              <div class="bg-background rounded-xl p-2 inventory-card">
                <div class="flex items-start">
                  <img
                    class="w-10 h-10 mr-2 object-contain"
                    src={row.image}
                    alt={row.name}
                    loading="lazy"
                    decoding="async"
                    on:error={fallbackWeaponImage}
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold leading-tight break-words">{row.name}</p>
                    <p class="text-xs text-gray-400 mt-1">
                      Lv.{row.level} · Asc {row.ascension} · R{row.refinement}
                      {#if row.atk !== null}
                        · {$t('weapon.baseAtk')}: {row.atk}
                      {/if}
                    </p>
                    {#if row.secondaryText}
                      <p class="text-xs text-gray-400 mt-1 break-words">{row.secondaryText}</p>
                    {/if}
                    {#if row.locationName}
                      <p class="text-xs text-gray-500 mt-1">Equipped: {row.locationName}</p>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        {#if artifactRows.length === 0}
          <p class="text-gray-400">Import GOOD to see your artifact inventory.</p>
        {:else if viewMode === 'list'}
          <div class="space-y-2">
            {#each artifactRows as row (row.uid)}
              <div class="bg-background rounded-xl p-3 inventory-card">
                <div class="flex items-start">
                  <img
                    class="w-12 h-12 mr-3 object-contain"
                    src={row.image}
                    alt={row.setName}
                    loading="lazy"
                    decoding="async"
                    on:error={fallbackArtifactImage}
                  />
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold leading-tight break-words">{row.setName}</p>
                    <p class="text-xs text-gray-400 mt-1">
                      {row.slotName} · +{row.level} · ★{row.rarity}
                      {#if row.mainStatKey}
                        · {getArtifactStatLabel(row.mainStatKey)}
                      {/if}
                    </p>
                    {#if row.locationName}
                      <p class="text-xs text-gray-500 mt-1">Equipped: {row.locationName}</p>
                    {/if}
                    {#if row.substats.length > 0}
                      <div class="mt-1 space-y-1">
                        {#each row.substats as stat}
                          <p class="text-xs text-gray-400 break-words">{stat.label}: {stat.value}</p>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {#each artifactRows as row (row.uid)}
              <div class="bg-background rounded-xl p-2 inventory-card">
                <div class="flex items-start">
                  <img
                    class="w-10 h-10 mr-2 object-contain"
                    src={row.image}
                    alt={row.setName}
                    loading="lazy"
                    decoding="async"
                    on:error={fallbackArtifactImage}
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold leading-tight break-words">{row.setName}</p>
                    <p class="text-xs text-gray-400 mt-1">
                      {row.slotName} · +{row.level} · ★{row.rarity}
                      {#if row.mainStatKey}
                        · {getArtifactStatLabel(row.mainStatKey)}
                      {/if}
                    </p>
                    {#if row.locationName}
                      <p class="text-xs text-gray-500 mt-1">Equipped: {row.locationName}</p>
                    {/if}
                    {#if row.substats.length > 0}
                      <div class="mt-1 space-y-1">
                        {#each row.substats as stat}
                          <p class="text-xs text-gray-400 break-words">{stat.label}: {stat.value}</p>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
      {/key}
    </div>
  {:else}
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
      <div class="bg-item rounded-xl p-4 text-white xl:col-span-1">
        <p class="font-bold mb-2">{$t('inventoryPage.importTitle')}</p>
        <p class="text-gray-400 mb-3">{$t('inventoryPage.importSubtitle')}</p>

        {#if !importLoading}
          <div class="flex flex-wrap gap-2">
            <Button className="overflow-hidden whitespace-nowrap" on:click={() => input.click()}>
              {files !== null && files[0] ? files[0].name : $t('inventoryPage.selectFile')}
            </Button>
            {#if files !== null && files[0]}
              <Button on:click={importGOOD}>
                <Icon size={0.8} path={mdiDatabaseImport} />
                {$t('inventoryPage.importButton')}
              </Button>
            {/if}
          </div>
        {:else}
          <Icon path={mdiLoading} color="white" spin />
        {/if}

        {#if importResult}
          <div class="mt-3 text-sm">
            <p>
              {$t('inventoryPage.importStats', {
                values: {
                  source: importResult.source,
                  version: importResult.version,
                  imported: importResult.stats.imported,
                  unmapped: importResult.stats.unmapped,
                },
              })}
            </p>
          </div>
        {/if}

        <input bind:this={input} bind:files type="file" class="hidden" />
      </div>

      <div class="bg-item rounded-xl p-4 text-white xl:col-span-2">
        <p class="font-bold mb-2">{$t('inventoryPage.manualTitle')}</p>
        <div class="flex flex-wrap gap-2 mb-2">
          <Button size="sm" className={viewMode === 'list' ? 'bg-primary border-primary' : ''} on:click={() => (viewMode = 'list')}>
            <Icon size={0.8} path={mdiViewList} />
            {$t('inventoryPage.viewModes.list')}
          </Button>
          <Button size="sm" className={viewMode === 'grid' ? 'bg-primary border-primary' : ''} on:click={() => (viewMode = 'grid')}>
            <Icon size={0.8} path={mdiViewGrid} />
            {$t('inventoryPage.viewModes.grid')}
          </Button>
        </div>
        <Input placeholder={$t('inventoryPage.searchPlaceholder')} bind:value={search} />
        {#if searchCandidates.length > 0}
          <div class="mt-2 flex flex-wrap gap-2">
            {#each searchCandidates as candidate}
              <Button size="sm" className="text-xs" on:click={() => manualAdjust(candidate.id, 1)}>
                <Icon size={0.8} path={mdiPlus} />
                {candidate.name}
              </Button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="bg-item rounded-xl p-4 text-white mt-4 mb-8">
      {#if rows.length === 0}
        <p class="text-gray-400">{$t('inventoryPage.empty')}</p>
      {:else}
        {#if viewMode === 'list'}
          <div class="overflow-x-auto">
            <table class="w-full min-w-max">
              <thead>
                <tr>
                  <th class="text-left text-gray-400 pb-2 pr-4">{$t('inventoryPage.material')}</th>
                  <th class="text-right text-gray-400 pb-2 px-2">{$t('inventoryPage.required')}</th>
                  <th class="text-right text-gray-400 pb-2 px-2">{$t('inventoryPage.inInventory')}</th>
                  <th class="text-right text-gray-400 pb-2 px-2">{$t('inventoryPage.remaining')}</th>
                  <th class="text-right text-gray-400 pb-2 px-2">{$t('inventoryPage.pin')}</th>
                  <th class="text-right text-gray-400 pb-2 pl-4">{$t('inventoryPage.edit')}</th>
                </tr>
              </thead>
              <tbody>
                {#each rows as row (row.id)}
                  <tr>
                    <td class="border-t border-gray-700 py-2 pr-4">
                      <div class="flex items-center">
                        <img
                          class="w-8 h-8 mr-2 object-contain"
                          src={row.image}
                          alt={row.name}
                          loading="lazy"
                          on:error={fallbackImage}
                        />
                        <div>
                          <p>{row.name}</p>
                          {#if row.custom}
                            <p class="text-xs text-gray-500">{row.id}</p>
                          {/if}
                        </div>
                      </div>
                    </td>
                    <td class="border-t border-gray-700 py-2 text-right px-2">{row.required}</td>
                    <td class="border-t border-gray-700 py-2 text-right px-2">{row.inInventory}</td>
                    <td class="border-t border-gray-700 py-2 text-right px-2">{row.remaining}</td>
                    <td class="border-t border-gray-700 py-2 text-right px-2">
                      <Button size="sm" on:click={() => togglePinned(row)}>
                        <Icon size={0.8} path={row.pinned ? mdiPin : mdiPinOutline} />
                      </Button>
                    </td>
                    <td class="border-t border-gray-700 py-2 pl-4">
                      <div class="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          className="w-8"
                          on:click={() => manualAdjust(row.id, -1, row.custom ? { name: row.name, image: row.image } : {})}
                        >
                          -1
                        </Button>
                        <Button
                          size="sm"
                          className="w-8"
                          on:click={() => manualAdjust(row.id, 1, row.custom ? { name: row.name, image: row.image } : {})}
                        >
                          +1
                        </Button>
                        <input
                          type="number"
                          min="0"
                          class="bg-background rounded-lg text-white px-2 py-1 w-20 text-right"
                          value={row.inInventory}
                          on:change={(e) =>
                            manualSet(row.id, e.target.value, row.custom ? { name: row.name, image: row.image } : {})}
                        />
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {#each rows as row (row.id)}
              <div class="bg-background rounded-xl p-2 inventory-card">
                <div class="flex items-start">
                  <img
                    class="w-10 h-10 mr-2 object-contain"
                    src={row.image}
                    alt={row.name}
                    loading="lazy"
                    decoding="async"
                    on:error={fallbackImage}
                  />
                  <div class="flex-1 min-w-0">
                    <p class="truncate">{row.name}</p>
                    <p class="text-xs text-gray-400">
                      {$t('inventoryPage.required')}: {row.required} | {$t('inventoryPage.remaining')}: {row.remaining}
                    </p>
                  </div>
                  <Button size="sm" className="ml-2" on:click={() => togglePinned(row)}>
                    <Icon size={0.8} path={row.pinned ? mdiPin : mdiPinOutline} />
                  </Button>
                </div>
                <div class="flex items-center justify-end gap-1 mt-2">
                  <Button size="sm" className="w-8" on:click={() => manualAdjust(row.id, -1, row.custom ? { name: row.name, image: row.image } : {})}>
                    -1
                  </Button>
                  <Button size="sm" className="w-8" on:click={() => manualAdjust(row.id, 1, row.custom ? { name: row.name, image: row.image } : {})}>
                    +1
                  </Button>
                  <input
                    type="number"
                    min="0"
                    class="bg-item rounded-lg text-white px-2 py-1 w-20 text-right"
                    value={row.inInventory}
                    on:change={(e) => manualSet(row.id, e.target.value, row.custom ? { name: row.name, image: row.image } : {})}
                  />
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .inventory-card {
    content-visibility: auto;
    contain: layout style paint;
    contain-intrinsic-size: 84px;
  }
</style>
