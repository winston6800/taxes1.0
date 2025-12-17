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
    <>
      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
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
              <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
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
    </>
  );
};