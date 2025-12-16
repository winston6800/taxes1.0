import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { processReceiptImage } from './services/geminiService';
import { saveEntry, removeEntry, updateEntry, loadEntries, clearAllEntries } from './services/storageService';
import { ReceiptEntry, QueueItem } from './types';
import { ReceiptTable } from './components/ReceiptTable';
import { EmptyState } from './components/EmptyState';

// Maximum number of concurrent API calls
const MAX_CONCURRENT_UPLOADS = 3;

const App: React.FC = () => {
  const [entries, setEntries] = useState<ReceiptEntry[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(true);
  
  // Ref to track the highest invoice number assigned so far.
  // We use a ref to prevent race conditions during rapid uploads.
  const lastAssignedIdRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats for the progress bar
  const totalInQueue = queue.length;
  const completedInQueue = queue.filter(i => i.status === 'COMPLETE').length;
  const errorsInQueue = queue.filter(i => i.status === 'ERROR').length;
  const pendingOrProcessing = queue.filter(i => i.status === 'PENDING' || i.status === 'PROCESSING').length;
  
  // Load persisted data on mount
  useEffect(() => {
    const init = async () => {
      try {
        const saved = await loadEntries();
        // Ensure loaded entries are sorted
        const sorted = saved.sort((a, b) => a.invoiceNumber - b.invoiceNumber);
        setEntries(sorted);
        
        // Initialize our counter based on existing data
        const maxId = sorted.reduce((max, e) => Math.max(max, e.invoiceNumber), 0);
        lastAssignedIdRef.current = maxId;
      } catch (e) {
        console.error("Failed to load receipts", e);
      } finally {
        setLoadingStorage(false);
      }
    };
    init();
  }, []);

  // --- Queue Processor Effect ---
  useEffect(() => {
    const processQueue = async () => {
      const processingCount = queue.filter(item => item.status === 'PROCESSING').length;
      
      // If we have capacity and items waiting
      if (processingCount < MAX_CONCURRENT_UPLOADS) {
        const nextItem = queue.find(item => item.status === 'PENDING');
        
        if (nextItem) {
          // Mark as processing
          setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'PROCESSING' } : i));

          try {
            // Process with AI
            // We pass the PRE-ASSIGNED number to the service
            const entry = await processReceiptImage(nextItem.file, nextItem.assignedInvoiceNumber); 

            let fullEntry: ReceiptEntry;
            
            setEntries(prev => {
               fullEntry = {
                 ...entry,
                 invoiceNumber: nextItem.assignedInvoiceNumber, // Enforce the assigned number
                 imageUrl: URL.createObjectURL(nextItem.file), 
                 fileName: nextItem.file.name
               };
               
               // Persist to storage (async side effect)
               saveEntry(fullEntry, nextItem.file).catch(err => console.error("Save failed", err));

               // Return a sorted list so strict order is maintained in UI
               return [...prev, fullEntry].sort((a, b) => a.invoiceNumber - b.invoiceNumber);
            });

            setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'COMPLETE' } : i));
          } catch (error) {
            console.error(error);
            setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'ERROR', error: 'Failed to extract' } : i));
          }
        }
      }
    };

    if (pendingOrProcessing > 0) {
      processQueue();
    }
  }, [queue, pendingOrProcessing]);


  // --- Handlers ---

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Convert to array
    const fileArray = Array.from(files);
    
    // Assign IDs sequentially starting from the last known max
    const newItems: QueueItem[] = fileArray.map(file => {
        lastAssignedIdRef.current += 1; // Increment for every file
        return {
            id: crypto.randomUUID(),
            file,
            status: 'PENDING',
            assignedInvoiceNumber: lastAssignedIdRef.current
        };
    });

    setQueue(prev => [...prev, ...newItems]);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    removeEntry(id).catch(err => console.error("Delete failed", err));
  };

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to delete ALL receipts? This action cannot be undone.")) {
        setEntries([]);
        lastAssignedIdRef.current = 0; // Reset counter
        await clearAllEntries();
    }
  };

  const handleUpdate = (id: string, field: keyof ReceiptEntry, value: string | number) => {
    setEntries(prev => {
        const newEntries = prev.map(e => {
            if (e.id === id) {
                const updated = { ...e, [field]: value };
                // Persist update
                updateEntry(updated);
                return updated;
            }
            return e;
        });
        
        // If the user manually changes an invoice number, we should resort
        if (field === 'invoiceNumber') {
            return newEntries.sort((a, b) => a.invoiceNumber - b.invoiceNumber);
        }
        
        return newEntries;
    });
  };

  const clearCompletedQueue = () => {
    setQueue(prev => prev.filter(i => i.status !== 'COMPLETE'));
  };

  // Drag and Drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, []);

  // Export to CSV
  const downloadCSV = () => {
    const headers = ["invoice#", "date", "explanation", "store", "repairs", "utilities", "filename"];
    const rows = entries.map(e => [
      e.invoiceNumber,
      e.date,
      `"${e.explanation.replace(/"/g, '""')}"`,
      `"${e.store.replace(/"/g, '""')}"`,
      e.repairs || 0,
      e.utilities || 0,
      `"${e.fileName.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      headers.join(','), 
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `receipts_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy to Clipboard
  const copyToClipboard = () => {
    const headers = ["invoice#", "date", "explanation", "store", "repairs", "utilities", "filename"];
    const rows = entries.map(e => [
      e.invoiceNumber,
      e.date,
      e.explanation,
      e.store,
      e.repairs || '', 
      e.utilities || '',
      e.fileName
    ]);

    const tsvContent = [
      headers.join('\t'), 
      ...rows.map(r => r.join('\t'))
    ].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loadingStorage) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Restoring your session...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="bg-indigo-600 p-2 rounded-lg">
                    <FileSpreadsheet className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Receipt2Sheet AI</h1>
            </div>
            <div className="flex items-center space-x-4">
                <div className="hidden sm:flex flex-col items-end mr-4">
                   <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Value</span>
                   <span className="text-sm font-bold text-gray-900 font-mono">
                     {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(entries.reduce((sum, e) => sum + (e.repairs || 0) + (e.utilities || 0), 0))}
                   </span>
                </div>
                <a 
                    href="https://docs.google.com/spreadsheets/create" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-sm text-gray-500 hover:text-indigo-600 transition-colors hidden sm:block font-medium"
                >
                    Open Google Sheets &rarr;
                </a>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Left Column: Uploader & Queue Stats - Sticky for better UX with long lists */}
            <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 h-fit">
                
                {/* Upload Area */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Add Receipts</h2>
                        <p className="text-sm text-gray-500 mb-6">Queue up multiple files. We process them in parallel.</p>
                        
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
                                        {pendingOrProcessing > 0 ? "Add more receipts" : "Drop files here"}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">or click to browse (Images & PDF)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Queue Status Panel */}
                {totalInQueue > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                          <h3 className="font-semibold text-gray-900 text-sm">Processing Queue</h3>
                          {completedInQueue > 0 && (
                            <button 
                                onClick={clearCompletedQueue}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                Clear finished
                            </button>
                          )}
                      </div>
                      <div className="p-4 space-y-4">
                          {/* Progress Bar */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">Progress ({completedInQueue}/{totalInQueue})</span>
                                <span className="text-gray-700 font-medium">{Math.round((completedInQueue / totalInQueue) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${(completedInQueue / totalInQueue) * 100}%` }}
                                ></div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                             <div className="flex items-center">
                                <Check className="w-3 h-3 mr-1 text-green-500" />
                                {completedInQueue} Done
                             </div>
                             {pendingOrProcessing > 0 && (
                                 <div className="flex items-center font-medium text-blue-600">
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    {pendingOrProcessing} Processing...
                                 </div>
                             )}
                             {errorsInQueue > 0 && (
                                <div className="flex items-center text-red-600">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    {errorsInQueue} Failed
                                </div>
                             )}
                          </div>
                          
                          {errorsInQueue > 0 && (
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                               Some files failed. Check the table or retry.
                            </div>
                          )}
                      </div>
                  </div>
                )}

                <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="font-semibold text-lg mb-2 flex items-center"><div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>Pro Tip</h3>
                        <p className="text-indigo-100 text-sm leading-relaxed">
                            Data is now saved automatically! You can close the tab and come back later.
                        </p>
                    </div>
                    {/* Decorative Background Element */}
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
                </div>
            </div>

            {/* Right Column: Data Table */}
            <div className="lg:col-span-3 flex flex-col h-full min-h-[500px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                        <ImageIcon className="w-5 h-5 text-gray-400 mr-2" />
                        Extracted Data <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">{entries.length} items</span>
                    </h2>
                    
                    <div className="flex space-x-2">
                        <button
                            onClick={handleClearAll}
                            disabled={entries.length === 0}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-red-200 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Clear All
                        </button>
                        
                        <button
                            onClick={copyToClipboard}
                            disabled={entries.length === 0}
                            className={`flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-md shadow-sm transition-all ${
                                copied 
                                ? 'bg-green-600 border-green-600 text-white' 
                                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        
                        <button
                            onClick={downloadCSV}
                            disabled={entries.length === 0}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            CSV
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    {entries.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <ReceiptTable 
                            entries={entries} 
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                        />
                    )}
                </div>
            </div>

        </div>
      </main>
    </div>
  );
};

export default App;