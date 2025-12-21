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
