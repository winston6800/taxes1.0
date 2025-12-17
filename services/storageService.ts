import { get, set, del, clear, createStore } from 'idb-keyval';
import { ReceiptEntry, Batch } from '../types';

// Create a custom store for our images
const customStore = createStore('receipt2sheet-db', 'images');

const STORAGE_KEY = 'receipts_data_v1';
const BATCHES_KEY = 'batches_meta_v1';

// --- BATCH MANAGEMENT ---

export const loadBatches = (): Batch[] => {
  const raw = localStorage.getItem(BATCHES_KEY);
  if (!raw) {
    // Default initial batch if none exists
    const defaultBatch: Batch = {
        id: 'default',
        name: 'Batch 1',
        createdAt: new Date().toISOString()
    };
    saveBatches([defaultBatch]);
    return [defaultBatch];
  }
  return JSON.parse(raw);
};

export const saveBatches = (batches: Batch[]) => {
  localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
};

export const createBatch = (name: string): Batch => {
    const batches = loadBatches();
    const newBatch: Batch = {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString()
    };
    batches.push(newBatch);
    saveBatches(batches);
    return newBatch;
};

export const deleteBatch = async (batchId: string) => {
    try {
        // 1. Remove Batch Meta first (Source of truth for the list)
        const batches = loadBatches();
        const newBatches = batches.filter(b => b.id !== batchId);
        saveBatches(newBatches);

        // 2. Remove all entries associated with this batch
        const allEntries = loadMetadata();
        const batchEntries = allEntries.filter((e: any) => e.batchId === batchId);
        const keepEntries = allEntries.filter((e: any) => e.batchId !== batchId);
        
        // 3. Update local storage metadata immediately
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keepEntries));

        // 4. Delete images from IDB (Best effort)
        // We do this last and in a separate try/catch loop so one failure doesn't stop everything
        // or if this fails, the metadata is already gone so the user perceives it as deleted.
        for (const entry of batchEntries) {
            try {
                await del(entry.id, customStore);
            } catch (e) {
                console.warn(`Failed to delete image for entry ${entry.id}`, e);
            }
        }
    } catch (error) {
        console.error("Critical error in deleteBatch", error);
        throw error;
    }
};


// --- ENTRY MANAGEMENT ---

// Load all entries from local storage and rehydrate images from IndexedDB
export const loadEntries = async (): Promise<ReceiptEntry[]> => {
  const rawData = localStorage.getItem(STORAGE_KEY);
  if (!rawData) return [];

  try {
    const parsed: Omit<ReceiptEntry, 'imageUrl'>[] = JSON.parse(rawData);

    // Migration: If entries don't have a batchId, assign them to 'default'
    let needsMigration = false;
    parsed.forEach(p => {
        if (!p.batchId) {
            p.batchId = 'default';
            needsMigration = true;
        }
    });
    if (needsMigration) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }

    // Fetch images in parallel
    const entries = await Promise.all(parsed.map(async (item) => {
      try {
        const blob = await get(item.id, customStore);
        if (blob) {
          return { ...item, imageUrl: URL.createObjectURL(blob) };
        }
        return { ...item, imageUrl: '' }; // Handle missing image gracefully
      } catch (e) {
        console.error('Failed to load image for', item.id, e);
        return { ...item, imageUrl: '' };
      }
    }));

    return entries;
  } catch (error) {
    console.error("Error parsing local storage", error);
    return [];
  }
};

// Save a new entry
export const saveEntry = async (entry: ReceiptEntry, file: Blob) => {
  // 1. Save Blob to IDB
  try {
    await set(entry.id, file, customStore);
  } catch (e) {
    console.error("Failed to save image to DB", e);
  }

  // 2. Save Metadata to LocalStorage (exclude blob URL)
  const current = loadMetadata();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { imageUrl, ...meta } = entry; 
  current.push(meta);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
};

// Update an existing entry (text fields only)
export const updateEntry = (updatedEntry: ReceiptEntry) => {
    const current = loadMetadata();
    const index = current.findIndex((e: any) => e.id === updatedEntry.id);
    if (index !== -1) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { imageUrl, ...meta } = updatedEntry;
        current[index] = meta;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
}

// Remove an entry
export const removeEntry = async (id: string) => {
    // 1. Remove from IDB
    await del(id, customStore);

    // 2. Remove from LocalStorage
    const current = loadMetadata();
    const filtered = current.filter((e: any) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// Clear all entries (Wipe everything)
export const clearAllEntries = async () => {
    // 1. Clear IDB
    await clear(customStore);
    
    // 2. Clear LocalStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BATCHES_KEY);
}

// Helper to just get the array from LS without async logic
const loadMetadata = (): any[] => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}