import { writable } from 'svelte/store';

export const goodInventory = writable({
  source: 'Unknown',
  version: null,
  importedAt: null,
  characters: {},
  weaponInventory: [],
  artifactInventory: [],
});

function toInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function sanitizeTalent(talent = {}) {
  return {
    auto: toInteger(talent.auto, 1),
    skill: toInteger(talent.skill, 1),
    burst: toInteger(talent.burst, 1),
  };
}

function sanitizeSubstats(substats = []) {
  if (!Array.isArray(substats)) return [];

  const next = [];
  for (const stat of substats) {
    if (!stat || typeof stat !== 'object') continue;
    if (typeof stat.key !== 'string' || stat.key.trim().length === 0) continue;

    const value = Number(stat.value);
    if (!Number.isFinite(value)) continue;

    next.push({
      key: stat.key,
      value,
    });
  }

  return next;
}

function sanitizeArtifact(artifact = {}) {
  return {
    setId: typeof artifact.setId === 'string' ? artifact.setId : null,
    setKey: typeof artifact.setKey === 'string' ? artifact.setKey : '',
    setName: typeof artifact.setName === 'string' ? artifact.setName : '',
    slotKey: typeof artifact.slotKey === 'string' ? artifact.slotKey : '',
    level: toInteger(artifact.level, 0),
    rarity: toInteger(artifact.rarity, 0),
    mainStatKey: typeof artifact.mainStatKey === 'string' ? artifact.mainStatKey : '',
    lock: artifact.lock === true,
    totalRolls: toInteger(artifact.totalRolls, 0),
    substats: sanitizeSubstats(artifact.substats),
  };
}

function sanitizeWeapon(weapon = null) {
  if (!weapon || typeof weapon !== 'object') return null;

  const secondaryValue = Number(weapon.secondaryValue);

  return {
    id: typeof weapon.id === 'string' ? weapon.id : '',
    key: typeof weapon.key === 'string' ? weapon.key : '',
    level: toInteger(weapon.level, 1),
    ascension: toInteger(weapon.ascension, 0),
    refinement: Math.max(1, toInteger(weapon.refinement, 1)),
    lock: weapon.lock === true,
    name: typeof weapon.name === 'string' ? weapon.name : '',
    rarity: toInteger(weapon.rarity, 0),
    atk: Number.isFinite(Number(weapon.atk)) ? Math.round(Number(weapon.atk)) : null,
    secondaryName: typeof weapon.secondaryName === 'string' ? weapon.secondaryName : null,
    secondaryValue: Number.isFinite(secondaryValue) ? secondaryValue : null,
  };
}

function sanitizeWeaponInventoryEntry(weapon = {}) {
  const base = sanitizeWeapon(weapon);
  if (!base) return null;

  return {
    ...base,
    locationId: typeof weapon.locationId === 'string' ? weapon.locationId : null,
    locationKey: typeof weapon.locationKey === 'string' ? weapon.locationKey : '',
  };
}

function sanitizeCharacter(character = {}) {
  const artifacts = {};
  if (character.artifacts && typeof character.artifacts === 'object') {
    for (const [slot, artifact] of Object.entries(character.artifacts)) {
      if (typeof slot !== 'string' || slot.length === 0) continue;
      artifacts[slot] = sanitizeArtifact(artifact);
    }
  }

  return {
    goodKey: typeof character.goodKey === 'string' ? character.goodKey : '',
    level: toInteger(character.level, 1),
    ascension: toInteger(character.ascension, 0),
    constellation: toInteger(character.constellation, 0),
    talent: sanitizeTalent(character.talent),
    weapon: sanitizeWeapon(character.weapon),
    artifacts,
  };
}

function sanitizeArtifactInventoryEntry(artifact = {}) {
  return {
    ...sanitizeArtifact(artifact),
    locationId: typeof artifact.locationId === 'string' ? artifact.locationId : null,
    locationKey: typeof artifact.locationKey === 'string' ? artifact.locationKey : '',
  };
}

function sanitizeGoodInventory(data = {}) {
  const characters = {};
  if (data.characters && typeof data.characters === 'object') {
    for (const [characterId, characterData] of Object.entries(data.characters)) {
      if (typeof characterId !== 'string' || characterId.length === 0) continue;
      characters[characterId] = sanitizeCharacter(characterData);
    }
  }

  const weaponInventory = Array.isArray(data.weaponInventory)
    ? data.weaponInventory.map((entry) => sanitizeWeaponInventoryEntry(entry)).filter(Boolean)
    : [];

  const artifactInventory = Array.isArray(data.artifactInventory)
    ? data.artifactInventory.map((entry) => sanitizeArtifactInventoryEntry(entry))
    : [];

  return {
    source: typeof data.source === 'string' && data.source.trim().length > 0 ? data.source : 'Unknown',
    version: typeof data.version === 'number' ? data.version : null,
    importedAt: typeof data.importedAt === 'string' ? data.importedAt : null,
    characters,
    weaponInventory,
    artifactInventory,
  };
}

export function setGoodInventory(data = {}) {
  goodInventory.set(sanitizeGoodInventory(data));
}
