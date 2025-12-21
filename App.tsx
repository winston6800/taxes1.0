import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Copy, 
  Loader2, 
  Plus, 
  Image as ImageIcon,
  Check,
  AlertCircle,
  Trash2,
  History,
  FolderPlus,
  FolderOpen,
  Edit2,
  X,
  Database
} from 'lucide-react';
import { processReceiptImage } from './services/geminiService';
import { 
    saveEntry, 
    removeEntry, 
    updateEntry, 
    loadEntries, 
    // clearAllEntries, // Unused in this version
    loadBatches, 
    saveBatches, 
    createBatch, 
    deleteBatch 
} from './services/storageService';
import { ReceiptEntry, QueueItem, Batch } from './types';
import { ReceiptTable } from './components/ReceiptTable';
import { EmptyState } from './components/EmptyState';
import { BackupManager } from './components/BackupManager';

// Maximum number of concurrent API calls
const MAX_CONCURRENT_UPLOADS = 3;

const App: React.FC = () => {
  // Global State
  const [allEntries, setAllEntries] = useState<ReceiptEntry[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string>('default');
  
  // Queue State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  
  // UI State
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isEditingBatchName, setIsEditingBatchName] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  
  // Refs
  const lastAssignedIdRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchNameInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const currentBatch = useMemo(() => batches.find(b => b.id === activeBatchId), [batches, activeBatchId]);
  
  const displayedEntries = useMemo(() => {
    return allEntries
        .filter(e => e.batchId === activeBatchId)
        .sort((a, b) => a.invoiceNumber - b.invoiceNumber);
  }, [allEntries, activeBatchId]);

  // Stats
  const totalInQueue = queue.length;
  const completedInQueue = queue.filter(i => i.status === 'COMPLETE').length;
  const errorsInQueue = queue.filter(i => i.status === 'ERROR').length;
  const pendingOrProcessing = queue.filter(i => i.status === 'PENDING' || i.status === 'PROCESSING').length;

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      try {
        // Load Batches
        let loadedBatches = await loadBatches();
        
        // Safety check: Ensure at least one batch exists
        if (loadedBatches.length === 0) {
            const defaultBatch = await createBatch("Batch 1");
            loadedBatches = [defaultBatch];
        }
        
        setBatches(loadedBatches);
        
        // Ensure we have a valid active batch
        if (!loadedBatches.find(b => b.id === activeBatchId)) {
            setActiveBatchId(loadedBatches[loadedBatches.length - 1].id);
        }

        // Load Entries
        const saved = await loadEntries();
        setAllEntries(saved);

      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setLoadingStorage(false);
      }
    };
    init();
  }, []); // Only run once on mount

  // Update Invoice Counter when switching batches
  useEffect(() => {
    if (displayedEntries.length > 0) {
        const maxId = displayedEntries.reduce((max, e) => Math.max(max, e.invoiceNumber), 0);
        lastAssignedIdRef.current = maxId;
    } else {
        lastAssignedIdRef.current = 0;
    }
  }, [displayedEntries, activeBatchId]);

  // --- Queue Processor ---
  useEffect(() => {
    const processQueue = async () => {
      const processingCount = queue.filter(item => item.status === 'PROCESSING').length;
      
      if (processingCount < MAX_CONCURRENT_UPLOADS) {
        const nextItem = queue.find(item => item.status === 'PENDING');
        
        if (nextItem) {
          setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'PROCESSING' } : i));

          try {
            // Process with AI
            const entry = await processReceiptImage(nextItem.file, nextItem.assignedInvoiceNumber); 

            let fullEntry: ReceiptEntry;
            
            setAllEntries(prev => {
               fullEntry = {
                 ...entry,
                 batchId: activeBatchId, // Bind to current batch
                 invoiceNumber: nextItem.assignedInvoiceNumber,
                 imageUrl: URL.createObjectURL(nextItem.file), 
                 fileName: nextItem.file.name
               };
               
               saveEntry(fullEntry, nextItem.file).catch(err => console.error("Save failed", err));

               return [...prev, fullEntry];
            });

            setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'COMPLETE' } : i));
          } catch (error: any) {
            console.error("Error processing receipt:", error);
            const errorMessage = error?.message || 'Failed to extract receipt data';
            setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'ERROR', error: errorMessage } : i));
          }
        }
      }
    };

    if (pendingOrProcessing > 0) {
      processQueue();
    }
  }, [queue, pendingOrProcessing, activeBatchId]);


  // --- Event Handlers ---

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    
    // Validate file types
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.pdf'];
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];
    
    fileArray.forEach(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (validExtensions.includes(ext)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });
    
    if (invalidFiles.length > 0) {
      alert(`Invalid file types: ${invalidFiles.join(', ')}\n\nSupported formats: JPG, PNG, GIF, WEBP, HEIC, PDF`);
    }
    
    if (validFiles.length === 0) return;
    
    const newItems: QueueItem[] = validFiles.map(file => {
        lastAssignedIdRef.current += 1;
        return {
            id: crypto.randomUUID(),
            file,
            status: 'PENDING',
            assignedInvoiceNumber: lastAssignedIdRef.current
        };
    });

    setQueue(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteEntry = (id: string) => {
    setAllEntries(prev => prev.filter(e => e.id !== id));
    removeEntry(id).catch(err => console.error("Delete failed", err));
  };

  const handleUpdateEntry = async (id: string, field: keyof ReceiptEntry, value: string | number) => {
    setAllEntries(prev => prev.map(e => {
        if (e.id === id) {
            const updated = { ...e, [field]: value };
            updateEntry(updated).catch(err => console.error("Failed to update entry", err));
            return updated;
        }
        return e;
    }));
  };

  // --- Batch Actions ---

  const handleCreateBatch = async () => {
    const name = `Batch ${batches.length + 1}`;
    const newBatch = await createBatch(name);
    setBatches(prev => [...prev, newBatch]);
    setActiveBatchId(newBatch.id);
    lastAssignedIdRef.current = 0; // Reset for new batch
    setShowHistory(false); // Mobile UX
  };

  const handleDeleteBatch = async (batchId: string, e: React.MouseEvent) => {
    // Explicitly prevent default and propagation
    e.preventDefault();
    e.stopPropagation(); 
    
    if (!window.confirm("Are you sure you want to delete this batch and all its receipts?")) {
        return;
    }

    try {
        await deleteBatch(batchId);
        
        // Refresh batches from source of truth
        let currentBatches = await loadBatches();
        
        // Handle case where we deleted the last batch
        if (currentBatches.length === 0) {
            const newBatch = await createBatch("Batch 1");
            currentBatches = [newBatch];
        }
        
        setBatches(currentBatches);
        setAllEntries(prev => prev.filter(entry => entry.batchId !== batchId));

        // If we deleted the active batch, switch to another one
        if (activeBatchId === batchId) {
             // Switch to the last available batch
             setActiveBatchId(currentBatches[currentBatches.length - 1].id);
        }
    } catch (err) {
        console.error("Failed to delete batch", err);
        alert("An error occurred while deleting the batch.");
    }
  };

  const handleRenameBatch = async (name: string) => {
    if (!name.trim()) return;
    const updatedBatches = batches.map(b => b.id === activeBatchId ? { ...b, name } : b);
    setBatches(updatedBatches);
    await saveBatches(updatedBatches);
  };

  // CSV Export for CURRENT batch
  const downloadCSV = () => {
    const headers = ["invoice#", "date", "explanation", "store", "repairs", "utilities", "filename"];
    const rows = displayedEntries.map(e => [
      e.invoiceNumber,
      e.date,
      `"${e.explanation.replace(/"/g, '""')}"`,
      `"${e.store.replace(/"/g, '""')}"`,
      e.repairs || 0,
      e.utilities || 0,
      `"${e.fileName.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentBatch?.name || 'receipts'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = () => {
    const headers = ["invoice#", "date", "explanation", "store", "repairs", "utilities", "filename"];
    const rows = displayedEntries.map(e => [
      e.invoiceNumber,
      e.date,
      e.explanation,
      e.store,
      e.repairs || '', 
      e.utilities || '',
      e.fileName
    ]);
    const tsvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, []);

  if (loadingStorage) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                 <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className={`p-2 rounded-md transition-colors ${showHistory ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <History className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-2">
                     <div className="bg-indigo-600 p-2 rounded-lg hidden sm:block">
                        <FileSpreadsheet className="h-5 w-5 text-white" />
                    </div>
                    
                    {/* Editable Batch Name */}
                    {isEditingBatchName ? (
                        <input
                            ref={batchNameInputRef}
                            type="text"
                            defaultValue={currentBatch?.name}
                            onBlur={(e) => {
                                handleRenameBatch(e.target.value);
                                setIsEditingBatchName(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRenameBatch(e.currentTarget.value);
                                    setIsEditingBatchName(false);
                                }
                            }}
                            autoFocus
                            className="text-lg font-bold text-gray-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent px-1"
                        />
                    ) : (
                        <div className="flex items-center group cursor-pointer" onClick={() => setIsEditingBatchName(true)}>
                            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight mr-2">
                                {currentBatch?.name || 'Receipt2Sheet'}
                            </h1>
                            <Edit2 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex items-center space-x-4">
                <div className="hidden md:flex flex-col items-end mr-4">
                   <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Batch Value</span>
                   <span className="text-sm font-bold text-gray-900 font-mono">
                     {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(displayedEntries.reduce((sum, e) => sum + (e.repairs || 0) + (e.utilities || 0), 0))}
                   </span>
                </div>
                <button
                    onClick={() => setShowBackupManager(true)}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                    title="Backup & Data Management"
                >
                    <Database className="w-5 h-5" />
                </button>
                <a 
                    href="https://docs.google.com/spreadsheets/create" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-sm text-gray-500 hover:text-indigo-600 transition-colors hidden sm:block font-medium"
                >
                    Open Sheets &rarr;
                </a>
            </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex relative">
          
          {/* History Sidebar (Collapsible) */}
          <div className={`
            fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
            ${showHistory ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full lg:hidden'}
          `}>
             <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="font-semibold text-gray-900">Batch History</h2>
                    <button onClick={() => setShowHistory(false)} className="lg:hidden text-gray-500"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="p-3">
                    <button 
                        onClick={handleCreateBatch}
                        className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm"
                    >
                        <FolderPlus className="w-4 h-4" />
                        <span>New Batch</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
                    {batches.map(batch => (
                        <div 
                            key={batch.id}
                            className={`group flex items-center justify-between rounded-lg mb-1 overflow-hidden cursor-pointer ${
                                activeBatchId === batch.id 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            {/* Selection Area - Click here to switch */}
                            <div 
                                className="flex-1 p-3 flex items-center overflow-hidden"
                                onClick={() => {
                                    setActiveBatchId(batch.id);
                                    if (window.innerWidth < 1024) setShowHistory(false);
                                }}
                            >
                                <FolderOpen className={`w-4 h-4 mr-3 flex-shrink-0 ${activeBatchId === batch.id ? 'text-indigo-200' : 'text-gray-400'}`} />
                                <div className="flex flex-col truncate">
                                    <span className="font-medium text-sm truncate">{batch.name}</span>
                                    <span className={`text-xs ${activeBatchId === batch.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                                        {new Date(batch.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Delete Button Area - Separated click target */}
                            <div className="pr-2 flex items-center">
                                <button 
                                    onClick={(e) => handleDeleteBatch(batch.id, e)}
                                    className={`p-2 rounded-md transition-colors ${
                                        activeBatchId === batch.id 
                                        ? 'text-indigo-100 hover:bg-indigo-700 hover:text-white' 
                                        : 'text-gray-400 hover:bg-red-50 hover:text-red-600 lg:opacity-0 group-hover:opacity-100 opacity-100'
                                    }`}
                                    title="Delete Batch"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          </div>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                
                {/* Uploader Column */}
                <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 h-fit">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload Receipts</h2>
                            <p className="text-sm text-gray-500 mb-6">Adding to: <span className="font-medium text-indigo-600">{currentBatch?.name}</span></p>
                            
                            <div 
                                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ease-in-out cursor-pointer ${
                                    dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                                }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e.target.files)}
                                />
                                
                                <div className="flex flex-col items-center justify-center space-y-3">
                                    <div className={`p-3 rounded-full transition-colors ${pendingOrProcessing > 0 ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {pendingOrProcessing > 0 ? <Plus className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {pendingOrProcessing > 0 ? "Add more" : "Drop files"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Queue Status */}
                    {totalInQueue > 0 && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                              <h3 className="font-semibold text-gray-900 text-sm">Processing Queue</h3>
                              {completedInQueue > 0 && (
                                <button 
                                    onClick={() => setQueue(prev => prev.filter(i => i.status !== 'COMPLETE'))}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    Clear finished
                                </button>
                              )}
                          </div>
                          <div className="p-4 space-y-4">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500">Progress</span>
                                    <span className="text-gray-700 font-medium">{Math.round((completedInQueue / totalInQueue) * 100)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                                      style={{ width: `${(completedInQueue / totalInQueue) * 100}%` }}
                                    ></div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                  {pendingOrProcessing > 0 && <div className="flex items-center text-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</div>}
                                  {errorsInQueue > 0 && <div className="flex items-center text-red-600"><AlertCircle className="w-3 h-3 mr-1" /> {errorsInQueue} Error(s)</div>}
                                </div>
                                {errorsInQueue > 0 && (
                                  <div className="space-y-1">
                                    {queue.filter(i => i.status === 'ERROR').map(item => (
                                      <div key={item.id} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                        <strong>{item.file.name}:</strong> {item.error || 'Unknown error'}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                          </div>
                      </div>
                    )}
                </div>

                {/* Data Table Column */}
                <div className="lg:col-span-3 flex flex-col h-full min-h-[500px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                            <ImageIcon className="w-5 h-5 text-gray-400 mr-2" />
                            {currentBatch?.name} <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">{displayedEntries.length} items</span>
                        </h2>
                        
                        <div className="flex space-x-2">
                            <button
                                onClick={copyToClipboard}
                                disabled={displayedEntries.length === 0}
                                className={`flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-md shadow-sm transition-all ${
                                    copied 
                                    ? 'bg-green-600 border-green-600 text-white' 
                                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                                } disabled:opacity-50`}
                            >
                                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                            
                            <button
                                onClick={downloadCSV}
                                disabled={displayedEntries.length === 0}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export CSV
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        {displayedEntries.length === 0 ? (
                            <EmptyState />
                        ) : (
                            <ReceiptTable 
                                entries={displayedEntries} 
                                onDelete={handleDeleteEntry}
                                onUpdate={handleUpdateEntry}
                            />
                        )}
                    </div>
                </div>
            </div>
          </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {showHistory && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setShowHistory(false)}
        />
      )}

      {/* Backup Manager Modal */}
      {showBackupManager && (
        <BackupManager onClose={() => setShowBackupManager(false)} />
      )}
    </div>
  );
};

export default App;