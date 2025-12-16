import React from 'react';
import { ClipboardList, UploadCloud } from 'lucide-react';

export const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-500">
      <div className="flex space-x-4 mb-4">
        <div className="p-3 bg-white rounded-full shadow-sm">
          <UploadCloud className="w-8 h-8 text-blue-500" />
        </div>
        <div className="p-3 bg-white rounded-full shadow-sm">
          <ClipboardList className="w-8 h-8 text-green-500" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-gray-700">No receipts processed yet</h3>
      <p className="text-sm mt-1 max-w-sm text-center">
        Upload a receipt image to automatically extract details into the spreadsheet.
      </p>
    </div>
  );
};
