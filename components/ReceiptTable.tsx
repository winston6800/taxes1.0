import React, { useState } from 'react';
import { ReceiptEntry } from '../types';
import { Trash2, ExternalLink, X, FileText } from 'lucide-react';

interface ReceiptTableProps {
  entries: ReceiptEntry[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: keyof ReceiptEntry, value: string | number) => void;
}

export const ReceiptTable: React.FC<ReceiptTableProps> = ({ entries, onDelete, onUpdate }) => {
  const [previewFile, setPreviewFile] = useState<{url: string, type: 'image' | 'pdf'} | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ReceiptEntry | null>(null);

  const formatCurrency = (val: number) => {
    if (val === 0) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleInputChange = (id: string, field: keyof ReceiptEntry, value: string) => {
    if (field === 'repairs' || field === 'utilities' || field === 'invoiceNumber') {
      const num = parseFloat(value.replace(/[^0-9.-]+/g, ''));
      onUpdate(id, field, isNaN(num) ? 0 : num);
    } else {
      onUpdate(id, field, value);
    }
  };

  const isPdf = (fileName: string) => fileName.toLowerCase().endsWith('.pdf');

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Main Table */}
      <div className="flex-1 overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300 bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-20">
                #
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-16">
                Ref
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-32">
                File Name
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-32">
                Date
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Contents or Explanation
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-48">
                Store
              </th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 w-32">
                Repairs
              </th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 w-32">
                Utilities
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 w-10">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {entries.map((entry) => (
              <tr 
                key={entry.id} 
                className={`transition-colors cursor-pointer ${
                  selectedEntry?.id === entry.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedEntry(entry)}
                onMouseEnter={() => !selectedEntry && setSelectedEntry(entry)}
              >
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                  <input
                      type="number"
                      className="w-full border-0 p-0 text-sm focus:ring-0 text-gray-900 font-medium bg-transparent"
                      value={entry.invoiceNumber}
                      onChange={(e) => handleInputChange(entry.id, 'invoiceNumber', e.target.value)}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <div 
                    className="h-10 w-10 rounded overflow-hidden border border-gray-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 relative group flex items-center justify-center bg-gray-50"
                    onClick={() => setPreviewFile({
                        url: entry.imageUrl,
                        type: isPdf(entry.fileName) ? 'pdf' : 'image'
                    })}
                  >
                    {isPdf(entry.fileName) ? (
                        <FileText className="text-red-500 w-6 h-6" />
                    ) : (
                        <img 
                            src={entry.imageUrl} 
                            alt="Receipt" 
                            className="h-full w-full object-cover" 
                            loading="lazy"
                        />
                    )}
                    
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                      <ExternalLink className="text-gray-900 opacity-0 group-hover:opacity-10 w-4 h-4" />
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <input
                      type="text"
                      className="w-full border-0 p-0 text-sm focus:ring-0 text-gray-500 bg-transparent"
                      value={entry.fileName}
                      onChange={(e) => handleInputChange(entry.id, 'fileName', e.target.value)}
                      title={entry.fileName}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                   <input
                      type="text"
                      className="w-full border-0 p-0 text-sm focus:ring-0 text-gray-600 bg-transparent"
                      value={entry.date}
                      onChange={(e) => handleInputChange(entry.id, 'date', e.target.value)}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <input
                      type="text"
                      className="w-full border-0 p-0 text-sm focus:ring-0 text-gray-600 bg-transparent"
                      value={entry.explanation}
                      onChange={(e) => handleInputChange(entry.id, 'explanation', e.target.value)}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <input
                      type="text"
                      className="w-full border-0 p-0 text-sm focus:ring-0 text-gray-600 bg-transparent"
                      value={entry.store}
                      onChange={(e) => handleInputChange(entry.id, 'store', e.target.value)}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">
                   <input
                      type="number"
                      step="0.01"
                      className="w-full border-0 p-0 text-sm focus:ring-0 text-gray-600 text-right bg-transparent"
                      value={entry.repairs === 0 ? '' : entry.repairs}
                      placeholder="-"
                      onChange={(e) => handleInputChange(entry.id, 'repairs', e.target.value)}
                  />
                </td>
                 <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">
                   <input
                      type="number"
                      step="0.01"
                      className="w-full border-0 p-0 text-sm focus:ring-0 text-gray-600 text-right bg-transparent"
                      value={entry.utilities === 0 ? '' : entry.utilities}
                      placeholder="-"
                      onChange={(e) => handleInputChange(entry.id, 'utilities', e.target.value)}
                  />
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button
                    onClick={() => {
                        if (window.confirm('Are you sure you want to delete this receipt?')) {
                            onDelete(entry.id);
                        }
                    }}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete receipt"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {/* Total Row */}
             <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                <td colSpan={6} className="py-4 pl-4 pr-3 text-right text-sm text-gray-900 uppercase tracking-wider text-xs">
                  Total
                </td>
                <td className="px-3 py-4 text-right text-sm text-gray-900 font-mono">
                   {formatCurrency(entries.reduce((sum, e) => sum + (e.repairs || 0), 0))}
                </td>
                <td className="px-3 py-4 text-right text-sm text-gray-900 font-mono">
                   {formatCurrency(entries.reduce((sum, e) => sum + (e.utilities || 0), 0))}
                </td>
                <td></td>
              </tr>
          </tbody>
        </table>
      </div>

      {/* Side Panel - Receipt Preview */}
      {selectedEntry && (
        <div className="w-full lg:w-80 flex-shrink-0 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden lg:sticky lg:top-4 h-fit lg:max-h-[calc(100vh-2rem)] flex flex-col">
          <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{selectedEntry.store}</p>
              <p className="text-xs text-gray-500">#{selectedEntry.invoiceNumber} • {selectedEntry.date}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEntry(null);
              }}
              className="ml-2 p-1 hover:bg-gray-200 rounded text-gray-500"
              title="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto bg-gray-900 p-4 flex items-center justify-center min-h-[400px] lg:min-h-0">
            {isPdf(selectedEntry.fileName) ? (
              <div className="w-full h-full flex items-center justify-center">
                <iframe 
                  src={selectedEntry.imageUrl} 
                  className="w-full h-[600px] border-0" 
                  title="PDF Preview"
                />
              </div>
            ) : (
              <img 
                src={selectedEntry.imageUrl} 
                alt="Receipt" 
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          <div className="p-3 border-t bg-gray-50">
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <span className="text-gray-500">Repairs:</span>
                <span className="ml-2 font-mono font-semibold text-gray-900">
                  {selectedEntry.repairs ? `$${selectedEntry.repairs.toFixed(2)}` : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Utilities:</span>
                <span className="ml-2 font-mono font-semibold text-gray-900">
                  {selectedEntry.utilities ? `$${selectedEntry.utilities.toFixed(2)}` : '-'}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-2 italic">{selectedEntry.explanation}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewFile({
                  url: selectedEntry.imageUrl,
                  type: isPdf(selectedEntry.fileName) ? 'pdf' : 'image'
                });
              }}
              className="w-full text-xs text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 py-1 hover:bg-indigo-50 rounded"
            >
              <ExternalLink className="w-3 h-3" />
              Open in full screen
            </button>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75" onClick={() => setPreviewFile(null)}>
          <div className="relative max-w-4xl w-full h-[85vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="p-2 border-b flex justify-between items-center bg-gray-100 shrink-0">
                <span className="text-sm font-medium text-gray-600 ml-2">
                    {previewFile.type === 'pdf' ? 'PDF Document' : 'Receipt Image'}
                </span>
                <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-gray-200 rounded-full">
                  <X className="w-5 h-5" />
                </button>
             </div>
             <div className="flex-1 bg-gray-900 flex items-center justify-center p-0 overflow-hidden">
                {previewFile.type === 'pdf' ? (
                     <iframe 
                        src={previewFile.url} 
                        className="w-full h-full" 
                        title="PDF Preview"
                     />
                ) : (
                    <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                        <img 
                            src={previewFile.url} 
                            alt="Full Receipt" 
                            className="max-w-full max-h-full object-contain" 
                        />
                    </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};