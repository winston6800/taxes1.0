import React, { useState } from 'react';
import { Download, Upload, CheckCircle, AlertCircle, Database, RefreshCw } from 'lucide-react';
import { 
  exportBackup, 
  importBackup, 
  checkDataIntegrity, 
  autoRecover,
  getLatestBackup 
} from '../services/storageService';

interface BackupManagerProps {
  onClose: () => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const backupJson = await exportBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Backup exported successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: `Export failed: ${error}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      await importBackup(text);
      setMessage({ type: 'success', text: 'Backup imported successfully! Please refresh the page.' });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: `Import failed: ${error}` });
    } finally {
      setIsImporting(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleCheckIntegrity = async () => {
    setIsChecking(true);
    setMessage(null);
    try {
      const result = await checkDataIntegrity();
      setIntegrityResult(result);
      if (result.valid) {
        setMessage({ type: 'success', text: 'Data integrity check passed!' });
      } else {
        setMessage({ type: 'error', text: `Found ${result.issues.length} issue(s)` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Integrity check failed: ${error}` });
    } finally {
      setIsChecking(false);
    }
  };

  const handleAutoRecover = async () => {
    if (!window.confirm('This will attempt to fix data integrity issues. Continue?')) {
      return;
    }

    setIsRecovering(true);
    setMessage(null);
    try {
      const result = await autoRecover();
      setMessage({ 
        type: 'success', 
        text: `Recovery complete! Fixed ${result.fixed} issue(s). Please refresh the page.` 
      });
      if (result.errors.length > 0) {
        console.warn('Recovery errors:', result.errors);
      }
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: `Recovery failed: ${error}` });
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">Backup & Data Management</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-lg flex items-center space-x-2 ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800' 
                : 'bg-red-50 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Export Backup */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Export Backup</h3>
            <p className="text-sm text-gray-500 mb-4">
              Download a complete backup of all your receipts and batches as a JSON file.
            </p>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Backup'}
            </button>
          </div>

          {/* Import Backup */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Import Backup</h3>
            <p className="text-sm text-gray-500 mb-4">
              Restore your data from a previously exported backup file.
            </p>
            <label className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? 'Importing...' : 'Import Backup'}
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>

          {/* Data Integrity Check */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Data Integrity Check</h3>
            <p className="text-sm text-gray-500 mb-4">
              Verify the integrity of your stored data and detect any issues.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCheckIntegrity}
                disabled={isChecking}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking...' : 'Check Integrity'}
              </button>
              {integrityResult && (
                <button
                  onClick={handleAutoRecover}
                  disabled={isRecovering || integrityResult.valid}
                  className="inline-flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRecovering ? 'animate-spin' : ''}`} />
                  {isRecovering ? 'Recovering...' : 'Auto-Recover'}
                </button>
              )}
            </div>

            {integrityResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {integrityResult.valid ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-semibold ${integrityResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                    {integrityResult.valid ? 'All checks passed' : 'Issues found'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Entries: {integrityResult.entryCount}</p>
                  <p>Images: {integrityResult.imageCount}</p>
                  <p>Batches: {integrityResult.batchCount}</p>
                  {integrityResult.issues.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">Issues:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {integrityResult.issues.map((issue: string, idx: number) => (
                          <li key={idx} className="text-red-600">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

