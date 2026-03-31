import artifactData from '../data/artifacts/en.json';
import weaponData from '../data/weapons/en.json';
import { characters } from '../data/characters';
import { weaponList } from '../data/weaponList';

const TRAVELER_IDS = ['traveler_anemo', 'traveler_geo', 'traveler_electro', 'traveler_dendro'];

/* prettier-ignore */
const WEAPON_LEVEL = [1, 5, 10, 15, 20, 20, 25, 30, 35, 40, 40, 45, 50, 50, 55, 60, 60, 65, 70, 70, 75, 80, 80, 85, 90];
/* prettier-ignore */
const WEAPON_ASC = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6];
/* prettier-ignore */
const WEAPON_INDEX = [1, 6, 11, 16, 20, 21, 26, 31, 36, 41, 42, 47, 52, 53, 58, 63, 64, 69, 74, 75, 80, 85, 86, 91, 96];

const CHARACTER_KEY_ALIASES = {
  traveler: '__all_traveler__',
  traveleranemo: 'traveler_anemo',
  travelergeo: 'traveler_geo',
  travelerelectro: 'traveler_electro',
  travelerdendro: 'traveler_dendro',
  playerboy: '__all_traveler__',
  playergirl: '__all_traveler__',
};

const SLOT_KEY_ALIASES = {
  flower: 'flower',
  plume: 'plume',
  feather: 'plume',
  sands: 'sands',
  goblet: 'goblet',
  circlet: 'circlet',
};

function normalizeGoodId(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function normalizeLookup(value) {
  return normalizeGoodId(value).replace(/_/g, '');
}

function prettyName(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

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

function addLookup(map, key, id) {
  const normalized = normalizeLookup(key);
  if (!normalized) return;
  if (!map[normalized]) {
    map[normalized] = id;
  }
}

const characterLookup = Object.entries(characters).reduce((prev, [id, character]) => {
  addLookup(prev, id, id);
  addLookup(prev, character.name, id);
  return prev;
}, {});

const weaponLookup = Object.entries(weaponList).reduce((prev, [id, weapon]) => {
  addLookup(prev, id, id);
  addLookup(prev, weapon.name, id);
  return prev;
}, {});

const artifactLookup = Object.entries(artifactData).reduce((prev, [id, artifact]) => {
  addLookup(prev, id, id);
  addLookup(prev, artifact.name, id);
  return prev;
}, {});

function resolveCharacterIds(goodKey) {
  const normalized = normalizeLookup(goodKey);
  if (!normalized) return [];

  if (CHARACTER_KEY_ALIASES[normalized] === '__all_traveler__') {
    return [...TRAVELER_IDS];
  }

  if (CHARACTER_KEY_ALIASES[normalized]) {
    return [CHARACTER_KEY_ALIASES[normalized]];
  }

  const mapped = characterLookup[normalized];
  if (!mapped) return [];
  return [mapped];
}

function resolveWeaponId(goodKey) {
  const normalized = normalizeLookup(goodKey);
  if (!normalized) return null;
  return weaponLookup[normalized] || null;
}

function resolveArtifactSetId(goodKey) {
  const normalized = normalizeLookup(goodKey);
  if (!normalized) return null;
  return artifactLookup[normalized] || null;
}

function resolveArtifactSlot(slotKey) {
  const normalized = normalizeLookup(slotKey);
  if (!normalized) return null;
  return SLOT_KEY_ALIASES[normalized] || null;
}

function getWeaponStatIndex(level, ascension) {
  const exactIndex = WEAPON_LEVEL.findIndex((itemLevel, index) => itemLevel === level && WEAPON_ASC[index] === ascension);
  if (exactIndex >= 0) return WEAPON_INDEX[exactIndex];

  const sameAsc = WEAPON_LEVEL.map((itemLevel, index) => ({
    level: itemLevel,
    ascension: WEAPON_ASC[index],
    index: WEAPON_INDEX[index],
  }))
    .filter((entry) => entry.ascension === ascension)
    .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level));

  if (sameAsc[0]) return sameAsc[0].index;

  return WEAPON_INDEX[0];
}

function sanitizeSubstats(substats) {
  if (!Array.isArray(substats)) return [];

  const next = [];
  for (const stat of substats) {
    if (!stat || typeof stat !== 'object') continue;
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

function getOrCreateCharacter(collection, id) {
  if (!collection[id]) {
    collection[id] = {
      artifacts: {},
    };
  }

  if (!collection[id].artifacts || typeof collection[id].artifacts !== 'object') {
    collection[id].artifacts = {};
  }

  return collection[id];
}

export function parseGoodLoadout(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'invalid-json' };
  }

  if (data.format !== 'GOOD') {
    return { ok: false, error: 'not-good-format' };
  }

  const result = {
    source: data.source || 'Unknown',
    version: data.version || null,
    importedAt: new Date().toISOString(),
    characters: {},
    weaponInventory: [],
    artifactInventory: [],
  };

  const unmappedCharacters = new Set();
  const unmappedWeapons = new Set();
  const unmappedArtifactSets = new Set();

  let mappedCharacters = 0;
  let mappedWeapons = 0;
  let mappedArtifacts = 0;

  for (const character of Array.isArray(data.characters) ? data.characters : []) {
    if (!character || typeof character !== 'object') continue;

    const characterIds = resolveCharacterIds(character.key);
    if (characterIds.length === 0) {
      if (character.key) unmappedCharacters.add(character.key);
      continue;
    }

    mappedCharacters++;
    const profile = {
      goodKey: character.key,
      level: toInteger(character.level, 1),
      ascension: toInteger(character.ascension, 0),
      constellation: toInteger(character.constellation, 0),
      talent: {
        auto: toInteger(character.talent?.auto, 1),
        skill: toInteger(character.talent?.skill, 1),
        burst: toInteger(character.talent?.burst, 1),
      },
    };

    for (const characterId of characterIds) {
      const current = getOrCreateCharacter(result.characters, characterId);
      result.characters[characterId] = {
        ...current,
        ...profile,
      };
    }
  }

  for (const weapon of Array.isArray(data.weapons) ? data.weapons : []) {
    if (!weapon || typeof weapon !== 'object') continue;

    const locationKey = typeof weapon.location === 'string' ? weapon.location : '';
    const hasLocation = locationKey.trim().length > 0;
    const characterIds = hasLocation ? resolveCharacterIds(locationKey) : [];
    if (hasLocation && characterIds.length === 0) {
      unmappedCharacters.add(locationKey);
    }

    const resolvedWeaponId = resolveWeaponId(weapon.key);
    const isMappedWeapon = Boolean(resolvedWeaponId);
    if (!isMappedWeapon && weapon.key) {
      unmappedWeapons.add(weapon.key);
    }
    if (isMappedWeapon) {
      mappedWeapons++;
    }

    const weaponId =
      resolvedWeaponId || `good_weapon_${normalizeGoodId(weapon.key) || String(result.weaponInventory.length + 1)}`;

    const weaponInfo = isMappedWeapon ? weaponData[weaponId] || {} : {};
    const level = toInteger(weapon.level, 1);
    const ascension = toInteger(weapon.ascension, 0);
    const statIndex = getWeaponStatIndex(level, ascension);

    const atkValue = toNumber(weaponInfo?.atk?.[statIndex], null);
    const secondaryValue = toNumber(weaponInfo?.secondary?.stats?.[statIndex], null);

    const mappedWeapon = {
      id: weaponId,
      key: weapon.key,
      level,
      ascension,
      refinement: Math.max(1, toInteger(weapon.refinement, 1)),
      lock: weapon.lock === true,
      name: weaponInfo.name || weaponList[weaponId]?.name || prettyName(weapon.key) || weapon.key,
      rarity: toInteger(weaponInfo.rarity, weaponList[weaponId]?.rarity || toInteger(weapon.rarity, 0)),
      atk: atkValue === null ? null : Math.round(atkValue),
      secondaryName: weaponInfo?.secondary?.name || null,
      secondaryValue,
    };

    result.weaponInventory.push({
      ...mappedWeapon,
      locationId: characterIds[0] || null,
      locationKey,
    });

    if (characterIds.length > 0) {
      for (const characterId of characterIds) {
        const current = getOrCreateCharacter(result.characters, characterId);
        current.weapon = mappedWeapon;
      }
    }
  }

  for (const artifact of Array.isArray(data.artifacts) ? data.artifacts : []) {
    if (!artifact || typeof artifact !== 'object') continue;

    const locationKey = typeof artifact.location === 'string' ? artifact.location : '';
    const hasLocation = locationKey.trim().length > 0;
    const characterIds = hasLocation ? resolveCharacterIds(locationKey) : [];
    if (hasLocation && characterIds.length === 0) {
      unmappedCharacters.add(locationKey);
    }

    const slotKey = resolveArtifactSlot(artifact.slotKey);
    if (!slotKey) continue;

    const setId = resolveArtifactSetId(artifact.setKey);
    if (!setId && artifact.setKey) {
      unmappedArtifactSets.add(artifact.setKey);
    }

    mappedArtifacts++;

    const mappedArtifact = {
      setId,
      setKey: artifact.setKey || '',
      setName: setId && artifactData[setId] ? artifactData[setId].name : prettyName(artifact.setKey) || artifact.setKey,
      slotKey,
      level: toInteger(artifact.level, 0),
      rarity: toInteger(artifact.rarity, 0),
      mainStatKey: typeof artifact.mainStatKey === 'string' ? artifact.mainStatKey : '',
      lock: artifact.lock === true,
      totalRolls: toInteger(artifact.totalRolls, 0),
      substats: sanitizeSubstats(artifact.substats),
    };

    result.artifactInventory.push({
      ...mappedArtifact,
      locationId: characterIds[0] || null,
      locationKey,
    });

    if (characterIds.length > 0) {
      for (const characterId of characterIds) {
        const current = getOrCreateCharacter(result.characters, characterId);
        const existing = current.artifacts[slotKey];

        if (!existing) {
          current.artifacts[slotKey] = mappedArtifact;
          continue;
        }

        if (mappedArtifact.rarity > existing.rarity || mappedArtifact.level > existing.level) {
          current.artifacts[slotKey] = mappedArtifact;
        }
      }
    }
  }

  return {
    ok: true,
    data: result,
    stats: {
      mappedCharacters,
      mappedWeapons,
      mappedArtifacts,
      unmappedCharacters: unmappedCharacters.size,
      unmappedWeapons: unmappedWeapons.size,
      unmappedArtifactSets: unmappedArtifactSets.size,
    },
    unmapped: {
      characters: [...unmappedCharacters],
      weapons: [...unmappedWeapons],
      artifactSets: [...unmappedArtifactSets],
    },
  };
}
