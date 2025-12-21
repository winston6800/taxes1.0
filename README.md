<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/10ihoQvbmj-n1f_KDpyQnv3HMUhuJ_SAc

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file and set:
   - `GEMINI_API_KEY` - Your Gemini API key
   - `VITE_APP_PASSWORD` - (Optional) Custom password to protect the app. If not set, defaults to "mom2024"
3. Run the app:
   `npm run dev`

**Note:** The app is password-protected. On first load, you'll be prompted to enter the password. Authentication persists for the browser session.

## Database & Data Storage

The app uses **IndexedDB** for reliable, persistent data storage with the following features:

### Storage Architecture
- **Images Store**: Receipt images are stored in IndexedDB for efficient blob storage
- **Metadata Store**: Receipt entry data (dates, amounts, stores, etc.) stored in IndexedDB
- **Batches Store**: Batch information stored separately for organization
- **Backups Store**: Automatic backups stored locally (keeps last 5 backups)

### Reliability Features
- ✅ **Automatic Retries**: All database operations retry up to 3 times with exponential backoff
- ✅ **Data Validation**: All data is validated before saving to prevent corruption
- ✅ **Automatic Backups**: Backups are created automatically every 10 entries and after batch changes
- ✅ **Data Integrity Checks**: Built-in integrity checking to detect orphaned data or missing images
- ✅ **Auto-Recovery**: Automatic recovery system to fix common data issues
- ✅ **Transaction-like Operations**: Atomic operations ensure data consistency

### Backup & Recovery
Access the **Backup Manager** via the database icon (🗄️) in the header to:
- **Export Backup**: Download a complete JSON backup of all your data
- **Import Backup**: Restore from a previously exported backup file
- **Check Integrity**: Verify data integrity and detect issues
- **Auto-Recover**: Automatically fix detected data issues

### Data Persistence & Backup
- All data is stored locally in your browser's IndexedDB
- Data persists across browser sessions
- No data is sent to external servers (except Gemini API for receipt processing)
- **Important:** Export backups regularly to preserve data when making app changes
- Use the Backup Manager (🗄️ icon) to export/import your data
- Backups include all receipt metadata and can be restored on any device

### Preserving Data When Making Changes
Before making changes to the app:
1. Click the database icon (🗄️) in the header
2. Click "Export Backup" to download a JSON file
3. Save this file somewhere safe (external drive, cloud storage, etc.)
4. After making changes, you can import the backup to restore your data

**Note:** Receipt images are stored separately in IndexedDB. The backup includes metadata only. For complete backup including images, use browser's backup/export features or copy the entire browser profile.
