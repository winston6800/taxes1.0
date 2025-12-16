import { get, set, del, clear, createStore } from 'idb-keyval';
import { ReceiptEntry } from '../types';

// Create a custom store for our images
const customStore = createStore('receipt2sheet-db', 'images');

const STORAGE_KEY = 'receipts_data_v1';

// Load all entries from local storage and rehydrate images from IndexedDB
export const loadEntries = async (): Promise<ReceiptEntry[]> => {
  const rawData = localStorage.getItem(STORAGE_KEY);
  if (!rawData) return [];

  try {
    const parsed: Omit<ReceiptEntry, 'imageUrl'>[] = JSON.parse(rawData);

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
    // Continue saving metadata even if image fails, though not ideal
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

// Clear all entries
export const clearAllEntries = async () => {
    // 1. Clear IDB
    await clear(customStore);
    
    // 2. Clear LocalStorage
    localStorage.removeItem(STORAGE_KEY);
}

// Helper to just get the array from LS without async logic
const loadMetadata = (): any[] => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}
