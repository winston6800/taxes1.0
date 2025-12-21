# Preserving Data When Making Changes

## Quick Answer: How to Preserve Data

**Before making any changes to the app:**

1. Click the **database icon (🗄️)** in the header
2. Click **"Export Backup"** 
3. Save the downloaded JSON file somewhere safe (external drive, cloud storage, etc.)
4. Make your changes to the app
5. After changes, click the database icon again and **"Import Backup"** to restore your data

## Why IndexedDB is Perfect for Your Mom's Tax App

### ✅ **Reliable & Permanent**
- IndexedDB is built into every modern browser
- Data persists until you explicitly delete it
- Survives browser updates and restarts
- Much more reliable than localStorage (which has size limits)

### ✅ **No Setup Required**
- Works immediately - no database server needed
- No MongoDB, Supabase, or cloud services required
- Everything runs locally in the browser
- Perfect for personal use

### ✅ **Fast & Efficient**
- Stores images directly (no conversion needed)
- Fast read/write operations
- Handles large amounts of data

### ✅ **Private & Secure**
- Data never leaves the computer
- No internet connection required
- Password protection keeps it secure

## About MongoDB

MongoDB would require:
- Setting up a backend server (Node.js, Express, etc.)
- Deploying to a hosting service (Heroku, AWS, etc.)
- Managing database connections
- Handling authentication
- Much more complex setup

**For a personal tax app, IndexedDB is the perfect choice!** It's simpler, faster, and more private.

## Data Storage Location

Your data is stored in:
- **Windows**: `C:\Users\[YourUsername]\AppData\Local\[Browser]\IndexedDB\`
- **Mac**: `~/Library/Application Support/[Browser]/IndexedDB/`
- **Linux**: `~/.config/[Browser]/IndexedDB/`

The database name is: `receipt2sheet-db`

## Backup Strategy

### Regular Backups
- Export a backup monthly or before tax season
- Store backups in multiple places:
  - External hard drive
  - Cloud storage (Google Drive, Dropbox, etc.)
  - USB drive

### Before Major Changes
Always export a backup before:
- Updating the app code
- Clearing browser data
- Reinstalling the browser
- Switching computers

### Restoring Data
1. Open the app
2. Click the database icon (🗄️)
3. Click "Import Backup"
4. Select your backup JSON file
5. The app will reload with your restored data

## What's Included in Backups

✅ All receipt metadata (dates, amounts, stores, etc.)
✅ All batch information
❌ Receipt images (stored separately in IndexedDB)

**Note:** Images are stored in IndexedDB separately. To fully backup images, you'd need to backup the entire browser profile or use browser export features.

## If Something Goes Wrong

1. **Check browser console** for errors (F12 → Console tab)
2. **Use Data Integrity Check** in Backup Manager
3. **Try Auto-Recover** to fix common issues
4. **Restore from backup** if needed

Your data is safe! IndexedDB is very reliable, and with regular backups, you'll never lose your tax receipts.

