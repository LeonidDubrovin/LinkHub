# Smart Bookmark Manager - Technical Specification

## Overview
Smart Bookmark Manager is a web application designed to help users save, organize, and preview web links intelligently. It uses AI to automatically categorize and tag incoming links, extracts meaningful metadata (including YouTube-specific data), and provides a rich preview experience with dynamic covers and a distraction-free reader mode.

## Architecture
- **Frontend**: React 18+ with TypeScript, built using Vite.
- **Styling**: Tailwind CSS for utility-first styling.
- **Backend**: Node.js with Express.
- **Database**: SQLite (via `better-sqlite3`) for local, fast data storage.
- **AI Integration**: Google Gemini API (`@google/genai`) for automatic categorization and tag suggestion.

## Key Features
1. **Intelligent Categorization**: When a URL is added, the backend fetches the page content and uses Gemini AI to suggest relevant categories and tags.
2. **Dynamic Previews**: Extracts multiple images from the target page. The UI provides a hover-to-cycle slideshow of these images. Falls back to a generated screenshot (via `image.thum.io`) or the site's favicon.
3. **YouTube Integration**: Specifically detects YouTube URLs and uses the YouTube oEmbed API to fetch accurate titles, descriptions, and high-quality thumbnails.
4. **Reader Mode**: Extracts the readable content of an article (using `@mozilla/readability` and `jsdom`) and displays it in a clean, distraction-free view within the inspector panel.
5. **Bulk Actions**: Users can select multiple bookmarks to perform bulk operations like deletion.

## Database Schema
- **bookmarks**: Stores the core link data (`id`, `url`, `title`, `description`, `cover_image_url`, `content_text`, `category_id`, `domain`, `images_json`, `created_at`, `updated_at`, `is_deleted`).
- **categories**: Stores user-defined and AI-suggested categories (`id`, `name`, `color`, `parent_id`).
- **tags**: Stores individual tags (`id`, `name`).
- **bookmark_tags**: Many-to-many relationship mapping bookmarks to tags.
- **domains**: Stores unique domains extracted from bookmarks (`id`, `domain`).

## API Endpoints
- `GET /api/bookmarks`: Fetch all active bookmarks (supports filtering by category, tag, domain, and search query).
- `POST /api/bookmarks`: Add a new bookmark. Triggers metadata extraction and AI categorization.
- `POST /api/bookmarks/:id/refresh`: Re-fetches metadata and re-runs AI categorization for an existing bookmark.
- `DELETE /api/bookmarks/:id`: Soft-deletes a bookmark.
- `POST /api/bookmarks/bulk-delete`: Soft-deletes multiple bookmarks.
- `GET /api/categories`, `GET /api/tags`, `GET /api/domains`: Fetch metadata for filtering.
- `GET /api/reader`: Fetches and parses a URL for Reader Mode.

## Future Enhancements
- **Nested Categories UI**: Full support for displaying and managing nested categories in the sidebar.
- **Cloud Sync**: Synchronize bookmarks across devices.
- **Native Desktop App**: Wrap the application using Tauri for a native desktop experience with proxy and DPI bypass capabilities.
