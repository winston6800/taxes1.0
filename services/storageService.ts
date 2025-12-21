import { get, set, del, clear, createStore, keys } from 'idb-keyval';
import { ReceiptEntry, Batch } from '../types';

// Create separate stores for better organization
const imagesStore = createStore('receipt2sheet-db', 'images');
const metadataStore = createStore('receipt2sheet-db', 'metadata');
const batchesStore = createStore('receipt2sheet-db', 'batches');
const backupsStore = createStore('receipt2sheet-db', 'backups');

// Storage keys
const METADATA_KEY = 'receipts_metadata_v2';
const BATCHES_KEY = 'batches_meta_v2';
const LAST_BACKUP_KEY = 'last_backup_timestamp';

// Maximum retry attempts for operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 100; // ms

// Helper: Retry with exponential backoff
async function retryOperation<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Data validation helpers
function validateReceiptEntry(entry: any): entry is Omit<ReceiptEntry, 'imageUrl'> {
  return (
    typeof entry.id === 'string' &&
    typeof entry.batchId === 'string' &&
    typeof entry.invoiceNumber === 'number' &&
    typeof entry.date === 'string' &&
    typeof entry.explanation === 'string' &&
    typeof entry.store === 'string' &&
    typeof entry.repairs === 'number' &&
    typeof entry.utilities === 'number' &&
    typeof entry.fileName === 'string'
  );
}

function validateBatch(batch: any): batch is Batch {
  return (
    typeof batch.id === 'string' &&
    typeof batch.name === 'string' &&
    typeof batch.createdAt === 'string'
  );
}

// --- BACKUP & RECOVERY ---

export interface BackupData {
  entries: Omit<ReceiptEntry, 'imageUrl'>[];
  batches: Batch[];
  timestamp: string;
  version: string;
}

export const createBackup = async (): Promise<BackupData> => {
  try {
    const entries = await loadMetadata();
    const batches = await loadBatches();
    
    const backup: BackupData = {
      entries,
      batches,
      timestamp: new Date().toISOString(),
      version: '2.0'
    };

    // Save backup to IndexedDB
    const backupId = `backup_${Date.now()}`;
    await retryOperation(() => set(backupId, backup, backupsStore));
    
    // Keep only last 5 backups
    const allBackupKeys = await keys(backupsStore);
    if (allBackupKeys.length > 5) {
      const sortedKeys = allBackupKeys.sort().reverse();
      const keysToDelete = sortedKeys.slice(5);
      for (const key of keysToDelete) {
        await del(key, backupsStore);
      }
    }

    // Update last backup timestamp
    await retryOperation(() => set(LAST_BACKUP_KEY, Date.now(), metadataStore));
    
    return backup;
  } catch (error) {
    console.error('Failed to create backup', error);
    throw error;
  }
};

export const restoreFromBackup = async (backup: BackupData): Promise<void> => {
  try {
    // Validate backup data
    if (!backup.entries || !backup.batches) {
      throw new Error('Invalid backup data structure');
    }

    // Validate all entries and batches
    for (const entry of backup.entries) {
      if (!validateReceiptEntry(entry)) {
        throw new Error(`Invalid entry in backup: ${entry.id}`);
      }
    }
    for (const batch of backup.batches) {
      if (!validateBatch(batch)) {
        throw new Error(`Invalid batch in backup: ${batch.id}`);
      }
    }

    // Save metadata
    await retryOperation(() => set(METADATA_KEY, backup.entries, metadataStore));
    
    // Save batches
    await retryOperation(() => set(BATCHES_KEY, backup.batches, batchesStore));

    // Note: Images are not included in backup, they remain in IndexedDB
    // If images are missing, they'll be handled gracefully on load
  } catch (error) {
    console.error('Failed to restore from backup', error);
    throw error;
  }
};

export const getLatestBackup = async (): Promise<BackupData | null> => {
  try {
    const allBackupKeys = await keys(backupsStore);
    if (allBackupKeys.length === 0) return null;

    const sortedKeys = allBackupKeys.sort().reverse();
    const latestKey = sortedKeys[0];
    return await get(latestKey, backupsStore);
  } catch (error) {
    console.error('Failed to get latest backup', error);
    return null;
  }
};

export const exportBackup = async (): Promise<string> => {
  const backup = await createBackup();
  return JSON.stringify(backup, null, 2);
};

export const importBackup = async (jsonString: string): Promise<void> => {
  try {
    const backup: BackupData = JSON.parse(jsonString);
    await restoreFromBackup(backup);
  } catch (error) {
    console.error('Failed to import backup', error);
    throw new Error('Invalid backup file format');
  }
};

// --- BATCH MANAGEMENT ---

export const loadBatches = async (): Promise<Batch[]> => {
  try {
    const batches = await retryOperation(() => get<Batch[]>(BATCHES_KEY, batchesStore));
    
    if (!batches || !Array.isArray(batches)) {
      // Create default batch
      const defaultBatch: Batch = {
        id: 'default',
        name: 'Batch 1',
        createdAt: new Date().toISOString()
      };
      await saveBatches([defaultBatch]);
      return [defaultBatch];
    }

    // Validate batches
    const validBatches = batches.filter(b => validateBatch(b));
    if (validBatches.length !== batches.length) {
      console.warn('Some batches failed validation, using valid ones only');
      await saveBatches(validBatches);
    }

    return validBatches;
  } catch (error) {
    console.error('Error loading batches, creating default', error);
    const defaultBatch: Batch = {
      id: 'default',
      name: 'Batch 1',
      createdAt: new Date().toISOString()
    };
    await saveBatches([defaultBatch]).catch(() => {});
    return [defaultBatch];
  }
};

export const saveBatches = async (batches: Batch[]): Promise<void> => {
  // Validate all batches
  for (const batch of batches) {
    if (!validateBatch(batch)) {
      throw new Error(`Invalid batch data: ${JSON.stringify(batch)}`);
    }
  }

  await retryOperation(() => set(BATCHES_KEY, batches, batchesStore));
  
  // Auto-backup after batch changes
  createBackup().catch(err => console.warn('Auto-backup failed', err));
};

export const createBatch = async (name: string): Promise<Batch> => {
  const batches = await loadBatches();
  const newBatch: Batch = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString()
  };
  batches.push(newBatch);
  await saveBatches(batches);
  return newBatch;
};

export const deleteBatch = async (batchId: string): Promise<void> => {
  try {
    // 1. Remove Batch Meta
    const batches = await loadBatches();
    const newBatches = batches.filter(b => b.id !== batchId);
    await saveBatches(newBatches);

    // 2. Remove all entries associated with this batch
    const allEntries = await loadMetadata();
    const batchEntries = allEntries.filter(e => e.batchId === batchId);
    const keepEntries = allEntries.filter(e => e.batchId !== batchId);
    
    // 3. Update metadata
    await retryOperation(() => set(METADATA_KEY, keepEntries, metadataStore));

    // 4. Delete images from IDB (best effort)
    for (const entry of batchEntries) {
      try {
        await del(entry.id, imagesStore);
      } catch (e) {
        console.warn(`Failed to delete image for entry ${entry.id}`, e);
      }
    }
  } catch (error) {
    console.error('Critical error in deleteBatch', error);
    throw error;
  }
};

// --- ENTRY MANAGEMENT ---

// Load metadata from IndexedDB
const loadMetadata = async (): Promise<Omit<ReceiptEntry, 'imageUrl'>[]> => {
  try {
    const metadata = await retryOperation(() => get<Omit<ReceiptEntry, 'imageUrl'>[]>(METADATA_KEY, metadataStore));
    if (!metadata || !Array.isArray(metadata)) {
      return [];
    }

    // Validate and filter invalid entries
    const validEntries = metadata.filter(e => validateReceiptEntry(e));
    if (validEntries.length !== metadata.length) {
      console.warn('Some entries failed validation, saving valid ones');
      await retryOperation(() => set(METADATA_KEY, validEntries, metadataStore));
    }

    // Migration: Ensure all entries have batchId
    let needsMigration = false;
    validEntries.forEach(e => {
      if (!e.batchId) {
        e.batchId = 'default';
        needsMigration = true;
      }
    });
    if (needsMigration) {
      await retryOperation(() => set(METADATA_KEY, validEntries, metadataStore));
    }

    return validEntries;
  } catch (error) {
    console.error('Error loading metadata', error);
    return [];
  }
};

// Load all entries from IndexedDB and rehydrate images
export const loadEntries = async (): Promise<ReceiptEntry[]> => {
  try {
    const metadata = await loadMetadata();

    // Fetch images in parallel with error handling
    const entries = await Promise.all(
      metadata.map(async (item) => {
        try {
          const blob = await get<Blob>(item.id, imagesStore);
          if (blob) {
            return { ...item, imageUrl: URL.createObjectURL(blob) };
          }
          return { ...item, imageUrl: '' };
        } catch (e) {
          console.error('Failed to load image for', item.id, e);
          return { ...item, imageUrl: '' };
        }
      })
    );

    return entries;
  } catch (error) {
    console.error('Error loading entries', error);
    return [];
  }
};

// Save a new entry with transaction-like behavior
export const saveEntry = async (entry: ReceiptEntry, file: Blob): Promise<void> => {
  try {
    // Validate entry
    const { imageUrl, ...meta } = entry;
    if (!validateReceiptEntry(meta)) {
      throw new Error(`Invalid entry data: ${JSON.stringify(meta)}`);
    }

    // 1. Save image to IndexedDB first
    await retryOperation(() => set(entry.id, file, imagesStore));

    // 2. Save metadata
    const current = await loadMetadata();
    current.push(meta);
    await retryOperation(() => set(METADATA_KEY, current, metadataStore));

    // Auto-backup after significant changes (every 10 entries)
    if (current.length % 10 === 0) {
      createBackup().catch(err => console.warn('Auto-backup failed', err));
    }
  } catch (error) {
    console.error('Failed to save entry', error);
    // Try to clean up if image was saved but metadata failed
    try {
      await del(entry.id, imagesStore);
    } catch (cleanupError) {
      console.error('Failed to cleanup after save error', cleanupError);
    }
    throw error;
  }
};

// Update an existing entry
export const updateEntry = async (updatedEntry: ReceiptEntry): Promise<void> => {
  try {
    const { imageUrl, ...meta } = updatedEntry;
    if (!validateReceiptEntry(meta)) {
      throw new Error(`Invalid entry data: ${JSON.stringify(meta)}`);
    }

    const current = await loadMetadata();
    const index = current.findIndex(e => e.id === updatedEntry.id);
    
    if (index === -1) {
      throw new Error(`Entry not found: ${updatedEntry.id}`);
    }

    current[index] = meta;
    await retryOperation(() => set(METADATA_KEY, current, metadataStore));
  } catch (error) {
    console.error('Failed to update entry', error);
    throw error;
  }
};

// Remove an entry
export const removeEntry = async (id: string): Promise<void> => {
  try {
    // Remove from both stores
    await Promise.all([
      retryOperation(() => del(id, imagesStore)),
      (async () => {
        const current = await loadMetadata();
        const filtered = current.filter(e => e.id !== id);
        await retryOperation(() => set(METADATA_KEY, filtered, metadataStore));
      })()
    ]);
  } catch (error) {
    console.error('Failed to remove entry', error);
    throw error;
  }
};

// Clear all entries
export const clearAllEntries = async (): Promise<void> => {
  try {
    await Promise.all([
      clear(imagesStore),
      retryOperation(() => set(METADATA_KEY, [], metadataStore)),
      retryOperation(() => set(BATCHES_KEY, [], batchesStore))
    ]);
  } catch (error) {
    console.error('Failed to clear all entries', error);
    throw error;
  }
};

// Data integrity check
export const checkDataIntegrity = async (): Promise<{
  valid: boolean;
  issues: string[];
  entryCount: number;
  imageCount: number;
  batchCount: number;
}> => {
  const issues: string[] = [];
  
  try {
    const entries = await loadMetadata();
    const batches = await loadBatches();
    
    // Check for orphaned entries (entries with batchId that doesn't exist)
    const batchIds = new Set(batches.map(b => b.id));
    const orphanedEntries = entries.filter(e => !batchIds.has(e.batchId));
    if (orphanedEntries.length > 0) {
      issues.push(`${orphanedEntries.length} entries have invalid batchId`);
    }

    // Check for missing images
    const entryIds = new Set(entries.map(e => e.id));
    const imageKeys = await keys(imagesStore);
    const missingImages = entries.filter(e => !imageKeys.includes(e.id));
    if (missingImages.length > 0) {
      issues.push(`${missingImages.length} entries are missing their images`);
    }

    // Check for orphaned images (images without entries)
    const orphanedImages = imageKeys.filter((key: any) => !entryIds.has(key));
    if (orphanedImages.length > 0) {
      issues.push(`${orphanedImages.length} orphaned images found`);
    }

    return {
      valid: issues.length === 0,
      issues,
      entryCount: entries.length,
      imageCount: imageKeys.length,
      batchCount: batches.length
    };
  } catch (error) {
    console.error('Error checking data integrity', error);
    return {
      valid: false,
      issues: [`Error during integrity check: ${error}`],
      entryCount: 0,
      imageCount: 0,
      batchCount: 0
    };
  }
};

// Auto-recovery: Attempt to fix common issues
export const autoRecover = async (): Promise<{ fixed: number; errors: string[] }> => {
  const errors: string[] = [];
  let fixed = 0;

  try {
    const integrity = await checkDataIntegrity();
    
    // Fix orphaned images
    const entries = await loadMetadata();
    const entryIds = new Set(entries.map(e => e.id));
    const imageKeys = await keys(imagesStore);
    
    for (const key of imageKeys) {
      if (!entryIds.has(key as string)) {
        try {
          await del(key, imagesStore);
          fixed++;
        } catch (e) {
          errors.push(`Failed to remove orphaned image ${key}: ${e}`);
        }
      }
    }

    // Fix orphaned entries (assign to default batch)
    const batches = await loadBatches();
    const batchIds = new Set(batches.map(b => b.id));
    let needsUpdate = false;
    
    const fixedEntries = entries.map(e => {
      if (!batchIds.has(e.batchId)) {
        e.batchId = 'default';
        needsUpdate = true;
        fixed++;
        return e;
      }
      return e;
    });

    if (needsUpdate) {
      await retryOperation(() => set(METADATA_KEY, fixedEntries, metadataStore));
    }

    return { fixed, errors };
  } catch (error) {
    errors.push(`Auto-recovery failed: ${error}`);
    return { fixed, errors };
  }
};
