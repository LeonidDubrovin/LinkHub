# LinkHub

LinkHub is a smart bookmark manager that uses AI to automatically categorize your saved links, generate descriptions, and extract content for a clean reading experience.

## Features

- **AI Categorization**: Automatically categorizes links using Gemini AI.
- **Smart Tags**: Generates relevant tags for each bookmark.
- **Reader View**: Extracts the main content of articles for distraction-free reading.
- **Search & Filter**: Find your bookmarks easily by title, description, URL, domain, or content type.
- **Bulk Actions**: Delete or refresh multiple bookmarks at once.

## Getting Started

### Prerequisites

- Node.js 20 or higher
- A Gemini API Key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Windows 10 Release & Data Storage

### Where is the data stored on Windows?

When running in **production mode** (e.g., using the release build), the application data (including the `bookmarks.db` SQLite database) is stored in your user's `AppData` folder:

```
C:\Users\<YourUsername>\AppData\Roaming\LinkHub\bookmarks.db
```

*(If you run the app in development mode using `npm run dev`, the database is stored locally in the project folder as `bookmarks.db`)*.

### How to make a standalone .exe for Windows

This project uses **Electron** to package the entire application (Node.js server, React frontend, and SQLite database) into a single, standalone `.exe` file.

1. **Create a Release Tag**: Push a new tag starting with `v` to your GitHub repository (e.g., `v1.0.0`).
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. **GitHub Actions**: The `Build Electron App` workflow will automatically start.
3. **Download**: Once the workflow finishes, a new Release will be created on your GitHub repository containing the `LinkHub Setup.exe` installer.
4. **Run**: Download and install the application. It will run as a native desktop app.

Alternatively, you can manually trigger the build from the **Actions** tab in your GitHub repository by clicking "Run workflow".

### Manual Local Build

If you want to build the `.exe` on your own Windows machine:

1. Ensure you have Node.js installed.
2. Run `npm install`
3. Run `npm run build:electron`
4. The installer will be generated in the `release/` folder.
