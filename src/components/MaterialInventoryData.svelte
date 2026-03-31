<script>
  import { onMount } from 'svelte';
  import { fromRemote, readSave, updateSave } from '../stores/saveManager';
  import { getAccountPrefix, selectedAccount } from '../stores/account';
  import { materialInventory, setMaterialInventory } from '../stores/materialInventory';

  let unsubscribe = null;
  let firstLoad = true;

  $: if ($fromRemote) {
    readLocalData();
  }

  onMount(async () => {
    await readLocalData();

    const unsub = selectedAccount.subscribe(() => {
      readLocalData();
    });

    return () => unsub();
  });

  async function readLocalData() {
    firstLoad = true;

    if (unsubscribe) unsubscribe();

    const prefix = getAccountPrefix();
    const data = await readSave(`${prefix}material-inventory`);

    if (data !== null) {
      setMaterialInventory(data);
    } else {
      setMaterialInventory({});
    }

    unsubscribe = materialInventory.subscribe(async (val) => {
      if (firstLoad) return;
      await updateSave(`${prefix}material-inventory`, val);
    });

    firstLoad = false;
  }
</script>
