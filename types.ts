export interface ReceiptEntry {
  id: string; // Unique ID for React keys
  invoiceNumber: number; // Sequential number for the sheet
  date: string;
  explanation: string;
  store: string;
  repairs: number;
  utilities: number;
  imageUrl: string; // Blob URL for preview
  fileName: string; // Original filename for reference
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface QueueItem {
  id: string;
  file: File;
  status: 'PENDING' | 'PROCESSING' | 'ERROR' | 'COMPLETE';
  error?: string;
  assignedInvoiceNumber: number;
}