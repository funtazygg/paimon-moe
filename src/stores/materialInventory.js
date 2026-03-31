import { writable } from 'svelte/store';

export const materialInventory = writable({});

function toNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function toDelta(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.floor(numeric);
}

function sanitizeEntry(entry = {}) {
  const amount = toNumber(entry.amount);
  const next = { amount };

  if (typeof entry.name === 'string' && entry.name.trim().length > 0) {
    next.name = entry.name.trim();
  }

  if (typeof entry.image === 'string' && entry.image.trim().length > 0) {
    next.image = entry.image.trim();
  }

  if (typeof entry.goodKey === 'string' && entry.goodKey.trim().length > 0) {
    next.goodKey = entry.goodKey.trim();
  }

  if (entry.pinned === true) {
    next.pinned = true;
  }

  return next;
}

function sanitizeInventory(data) {
  const next = {};
  if (!data || typeof data !== 'object') return next;

  for (const [id, entry] of Object.entries(data)) {
    if (typeof id !== 'string' || id.trim().length === 0) continue;

    if (typeof entry === 'number') {
      const amount = toNumber(entry);
      if (amount > 0) next[id] = { amount };
      continue;
    }

    if (!entry || typeof entry !== 'object') continue;
    const sanitized = sanitizeEntry(entry);
    if (sanitized.amount > 0 || sanitized.name || sanitized.image || sanitized.goodKey || sanitized.pinned) {
      next[id] = sanitized;
    }
  }

  return next;
}

export function setMaterialInventory(data = {}) {
  materialInventory.set(sanitizeInventory(data));
}

export function setMaterialAmount(id, amount, metadata = {}) {
  if (typeof id !== 'string' || id.trim().length === 0) return;

  materialInventory.update((current) => {
    const currentEntry = current[id] || {};
    const nextEntry = sanitizeEntry({
      ...currentEntry,
      ...metadata,
      amount,
    });

    if (nextEntry.amount <= 0 && !nextEntry.name && !nextEntry.image && !nextEntry.goodKey && !nextEntry.pinned) {
      const { [id]: _removed, ...rest } = current;
      return rest;
    }

    return {
      ...current,
      [id]: nextEntry,
    };
  });
}

export function adjustMaterialAmount(id, delta, metadata = {}) {
  if (typeof id !== 'string' || id.trim().length === 0) return;

  materialInventory.update((current) => {
    const currentEntry = current[id] || {};
    const currentAmount = toNumber(currentEntry.amount);
    const nextAmount = Math.max(0, currentAmount + toDelta(delta));
    const nextEntry = sanitizeEntry({
      ...currentEntry,
      ...metadata,
      amount: nextAmount,
    });

    if (nextEntry.amount <= 0 && !nextEntry.name && !nextEntry.image && !nextEntry.goodKey && !nextEntry.pinned) {
      const { [id]: _removed, ...rest } = current;
      return rest;
    }

    return {
      ...current,
      [id]: nextEntry,
    };
  });
}

export function mergeMaterialInventory(entries = {}, { replace = false } = {}) {
  materialInventory.update((current) => {
    const base = replace ? {} : { ...current };
    for (const [id, entry] of Object.entries(entries || {})) {
      if (typeof id !== 'string' || id.trim().length === 0) continue;
      const currentEntry = base[id] || {};
      const nextEntry = sanitizeEntry({
        ...currentEntry,
        ...(entry || {}),
      });

      if (nextEntry.amount <= 0 && !nextEntry.name && !nextEntry.image && !nextEntry.goodKey && !nextEntry.pinned) {
        delete base[id];
      } else {
        base[id] = nextEntry;
      }
    }

    return sanitizeInventory(base);
  });
}

export function setMaterialPinned(id, pinned, metadata = {}) {
  if (typeof id !== 'string' || id.trim().length === 0) return;

  materialInventory.update((current) => {
    const currentEntry = current[id] || {};
    const nextEntry = sanitizeEntry({
      ...currentEntry,
      ...metadata,
      pinned: Boolean(pinned),
    });

    if (nextEntry.amount <= 0 && !nextEntry.name && !nextEntry.image && !nextEntry.goodKey && !nextEntry.pinned) {
      const { [id]: _removed, ...rest } = current;
      return rest;
    }

    return {
      ...current,
      [id]: nextEntry,
    };
  });
}
