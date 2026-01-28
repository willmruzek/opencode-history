# OpenCode History Shared Utilities

Shared TypeScript utilities for accessing OpenCode agent session history and viewing file changes.

## Overview

This module provides a common API for both the OpenCode and VSCode extensions to interact with OpenCode's storage system.

## Functions

### `getRecentSessions(limit?: number): Promise<Session[]>`

Get recent agent sessions with metadata.

**Returns:**
```typescript
interface Session {
  id: string;
  title: string;
  modified: string;
  messageCount: number;
}
```

### `getSessionMessages(sessionId: string): Promise<Message[]>`

Get all messages with file changes from a session.

**Returns:**
```typescript
interface Message {
  id: string;
  timestamp: string;
  hash: string;
  hasSnapshot: boolean;
}
```

### `getMessageDiff(messageId: string, filePath?: string): Promise<string | null>`

Get the git diff for a specific message.

**Parameters:**
- `messageId` - The message ID to get diff for
- `filePath` - Optional path to filter diff to specific file

**Returns:** Diff string or null if not found

### `getFileHistory(filePath: string, limit?: number): Promise<FileHistoryEntry[]>`

Get all changes to a specific file across recent sessions.

**Returns:**
```typescript
interface FileHistoryEntry {
  messageId: string;
  sessionId: string;
  sessionTitle: string;
  timestamp: string;
  hash: string;
}
```

## Requirements

- Node.js
- Git on PATH
- OpenCode storage at `~/.local/share/opencode/storage/`

## Storage Layout

```
~/.local/share/opencode/storage/
├── message/           # Message metadata by session
│   └── ses_*/
│       └── msg_*.json
├── part/              # Message parts (patches, tools, text)
│   └── msg_*/
│       └── *.json
├── session/           # Session metadata by project
│   └── <project_id>/
│       └── ses_*.json
└── snapshot/          # Git snapshots of file changes
    └── <project_id>/
```

## Usage in Extensions

Both OpenCode and VSCode extensions import these utilities:

```typescript
import { getRecentSessions, getMessageDiff, getFileHistory } from '../../../shared/history';

// Get recent sessions
const sessions = await getRecentSessions(10);

// Get diff for a message
const diff = await getMessageDiff('msg_abc123');

// Get file history
const history = await getFileHistory('src/index.ts', 20);
```
