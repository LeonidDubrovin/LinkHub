# LinkHub Documentation

## Quick Links

- [Architecture](./ARCHITECTURE.md) - System design and patterns
- [API Reference](./API.md) - All API endpoints
- [Configuration](./CONFIGURATION.md) - Settings and config files
- [LLM Categorization](./LLM_CATEGORIZATION.md) - AI-powered bookmark categorization

## Overview

LinkHub is a smart bookmark manager with AI-powered automatic categorization, tag generation, and content extraction. Built with Electron, React, Node.js, and SQLite.

## Key Features

- **AI Categorization**: Uses OpenRouter to automatically categorize bookmarks
- **Local Heuristics Fallback**: Domain-based rules when AI is unavailable
- **Reader View**: Clean article extraction using Mozilla Readability
- **Search & Filter**: Find bookmarks by title, description, URL, domain, category, or tags
- **Bulk Actions**: Delete, refresh, and categorize multiple bookmarks at once
- **Electron Desktop**: Native desktop app with portable .exe builder

## Quick Start

```bash
# Install dependencies
npm install

# Configure (optional: settings via UI)
# Database auto-initializes

# Development
npm run dev          # Start server
npm run dev:electron # Start Electron app

# Build for production
npm run build
npm run build:electron
```

See [Configuration](./CONFIGURATION.md) for details on settings.
