<script>
  import { onMount } from 'svelte';
  import { fromRemote, readSave, updateSave } from '../stores/saveManager';
  import { getAccountPrefix, selectedAccount } from '../stores/account';
  import { goodInventory, setGoodInventory } from '../stores/goodInventory';

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
    const data = await readSave(`${prefix}good-inventory`);

    if (data !== null) {
      setGoodInventory(data);
    } else {
      setGoodInventory({});
    }

    unsubscribe = goodInventory.subscribe(async (val) => {
      if (firstLoad) return;
      await updateSave(`${prefix}good-inventory`, val);
    });

    firstLoad = false;
  }
</script>
