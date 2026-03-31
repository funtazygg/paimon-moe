import { itemList } from '../data/itemList';

const GOOD_KEY_ALIASES = {
  Redcrest: 'henna_berry',
  WanderersAdvice: 'wanderes_advice',
};

const GOOD_ID_ALIASES = {
  redcrest: 'henna_berry',
  wanderers_advice: 'wanderes_advice',
};

const NORMALIZED_ITEM_NAME_MAP = Object.entries(itemList).reduce((prev, [id, item]) => {
  const normalized = normalizeText(item.name);
  if (normalized) {
    prev[normalized] = id;
  }
  return prev;
}, {});

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

function prettyName(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toInventoryAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.floor(numeric));
}

export function getPaimonMaterialId(goodKey) {
  if (GOOD_KEY_ALIASES[goodKey] && itemList[GOOD_KEY_ALIASES[goodKey]]) {
    return GOOD_KEY_ALIASES[goodKey];
  }

  const normalized = normalizeGoodId(goodKey);
  const alias = GOOD_ID_ALIASES[normalized] || normalized;

  if (itemList[alias]) return alias;

  const byPrettyName = NORMALIZED_ITEM_NAME_MAP[normalizeText(prettyName(goodKey))];
  if (byPrettyName) return byPrettyName;

  const byRawName = NORMALIZED_ITEM_NAME_MAP[normalizeText(goodKey)];
  if (byRawName) return byRawName;

  return null;
}

export function parseGoodMaterials(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'invalid-json' };
  }

  if (data.format !== 'GOOD') {
    return { ok: false, error: 'not-good-format' };
  }

  if (!data.materials || typeof data.materials !== 'object') {
    return { ok: false, error: 'missing-materials' };
  }

  const entries = {};
  const unmapped = [];
  let skipped = 0;

  for (const [goodKey, rawAmount] of Object.entries(data.materials)) {
    const amount = toInventoryAmount(rawAmount);
    if (amount === null) {
      skipped++;
      continue;
    }
    if (amount <= 0) {
      skipped++;
      continue;
    }

    const paimonId = getPaimonMaterialId(goodKey);
    if (paimonId) {
      const current = entries[paimonId]?.amount || 0;
      entries[paimonId] = {
        ...entries[paimonId],
        amount: current + amount,
        goodKey: entries[paimonId]?.goodKey || goodKey,
      };
      continue;
    }

    const normalized = normalizeGoodId(goodKey);
    const customId = `good_${normalized || Math.random().toString(36).slice(2, 10)}`;
    const current = entries[customId]?.amount || 0;

    entries[customId] = {
      ...entries[customId],
      amount: current + amount,
      name: prettyName(goodKey) || goodKey,
      image: '/images/items.png',
      goodKey,
    };
    unmapped.push(goodKey);
  }

  return {
    ok: true,
    entries,
    source: data.source || 'Unknown',
    version: data.version,
    stats: {
      total: Object.keys(data.materials).length,
      imported: Object.keys(entries).length,
      unmapped: unmapped.length,
      skipped,
    },
    unmapped,
  };
}
