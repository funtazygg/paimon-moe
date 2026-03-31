function toInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function toNumber(value, fallback = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSubstats(substats) {
  if (!Array.isArray(substats)) return [];

  const next = [];
  for (const stat of substats) {
    if (!isObject(stat)) continue;
    if (typeof stat.key !== 'string' || stat.key.trim().length === 0) continue;

    const value = toNumber(stat.value, null);
    if (value === null) continue;

    next.push({
      key: stat.key,
      value,
    });
  }
  return next;
}

function normalizeCharacters(goodInventory) {
  if (!isObject(goodInventory?.characters)) return [];

  const exported = [];
  for (const [id, character] of Object.entries(goodInventory.characters)) {
    if (!isObject(character)) continue;

    const hasAnyData =
      Number.isFinite(Number(character.level)) ||
      Number.isFinite(Number(character.ascension)) ||
      Number.isFinite(Number(character.constellation)) ||
      isObject(character.talent);

    if (!hasAnyData) continue;

    exported.push({
      key: typeof character.goodKey === 'string' && character.goodKey.trim().length > 0 ? character.goodKey : id,
      level: toInteger(character.level, 1),
      ascension: toInteger(character.ascension, 0),
      constellation: toInteger(character.constellation, 0),
      talent: {
        auto: toInteger(character.talent?.auto, 1),
        skill: toInteger(character.talent?.skill, 1),
        burst: toInteger(character.talent?.burst, 1),
      },
    });
  }

  return exported;
}

function normalizeWeapons(goodInventory) {
  if (!Array.isArray(goodInventory?.weaponInventory)) return [];

  return goodInventory.weaponInventory
    .filter((weapon) => isObject(weapon))
    .map((weapon, index) => ({
      key:
        typeof weapon.key === 'string' && weapon.key.trim().length > 0
          ? weapon.key
          : typeof weapon.id === 'string' && weapon.id.trim().length > 0
            ? weapon.id
            : `Weapon_${index + 1}`,
      level: toInteger(weapon.level, 1),
      ascension: toInteger(weapon.ascension, 0),
      refinement: Math.max(1, toInteger(weapon.refinement, 1)),
      location: typeof weapon.locationKey === 'string' ? weapon.locationKey : '',
      lock: weapon.lock === true,
    }));
}

function normalizeArtifacts(goodInventory) {
  if (!Array.isArray(goodInventory?.artifactInventory)) return [];

  return goodInventory.artifactInventory
    .filter((artifact) => isObject(artifact))
    .map((artifact, index) => ({
      setKey:
        typeof artifact.setKey === 'string' && artifact.setKey.trim().length > 0
          ? artifact.setKey
          : typeof artifact.setId === 'string' && artifact.setId.trim().length > 0
            ? artifact.setId
            : `ArtifactSet_${index + 1}`,
      slotKey: typeof artifact.slotKey === 'string' && artifact.slotKey.trim().length > 0 ? artifact.slotKey : 'flower',
      level: toInteger(artifact.level, 0),
      rarity: Math.max(1, toInteger(artifact.rarity, 1)),
      mainStatKey: typeof artifact.mainStatKey === 'string' ? artifact.mainStatKey : '',
      location: typeof artifact.locationKey === 'string' ? artifact.locationKey : '',
      lock: artifact.lock === true,
      substats: normalizeSubstats(artifact.substats),
      totalRolls: toInteger(artifact.totalRolls, 0),
    }));
}

function normalizeMaterials(materialInventory) {
  if (!isObject(materialInventory)) return {};

  const materials = {};
  for (const [id, entry] of Object.entries(materialInventory)) {
    if (!isObject(entry)) continue;

    const amount = toInteger(entry.amount, 0);
    if (amount <= 0) continue;

    const goodKey =
      typeof entry.goodKey === 'string' && entry.goodKey.trim().length > 0
        ? entry.goodKey
        : typeof id === 'string'
          ? id
          : null;

    if (!goodKey) continue;

    if (materials[goodKey] === undefined) {
      materials[goodKey] = 0;
    }
    materials[goodKey] += amount;
  }

  return materials;
}

export function buildGoodExportFromSaveData(saveData = {}) {
  const goodInventory = isObject(saveData['good-inventory']) ? saveData['good-inventory'] : {};
  const materialInventory = isObject(saveData['material-inventory']) ? saveData['material-inventory'] : {};

  return {
    format: 'GOOD',
    version: 3,
    source: 'paimon-moe',
    generatedAt: new Date().toISOString(),
    characters: normalizeCharacters(goodInventory),
    weapons: normalizeWeapons(goodInventory),
    artifacts: normalizeArtifacts(goodInventory),
    materials: normalizeMaterials(materialInventory),
  };
}

export const UNIVERSAL_EXPORT_KEY = '__paimon_moe_universal__';

export function buildUniversalExportFromSaveData(saveData = {}) {
  const base = isObject(saveData) ? { ...saveData } : {};
  base[UNIVERSAL_EXPORT_KEY] = {
    version: 1,
    exportedAt: new Date().toISOString(),
    good: buildGoodExportFromSaveData(base),
  };
  return base;
}
