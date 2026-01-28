# OpenCode Agent Tools

Shell functions and plugins for exploring OpenCode agent session history and viewing file changes.

## Repository Layout

- **`script-zsh/`** - Zsh shell functions (`diffs.sh`, `sessions.sh`)
- **`script-ts/`** - TypeScript versions of the shell functions
- **`shared/`** - Shared utilities for history access (used by plugins)
- **`opencode/`** - OpenCode plugin for viewing file edits
- **`vscode/`** - VSCode extension for viewing file edits

## Quick Start

### Shell Functions (Zsh)

Source the shell functions in your `.zshrc`:

```bash
source /path/to/script-zsh/sessions.sh
source /path/to/script-zsh/diffs.sh
```

Then use commands like:

```bash
agent_sessions              # List recent sessions
agent_diff_latest          # View latest changes
agent_file_history src/index.ts  # Track file history
```

### TypeScript Functions

Import the TypeScript module in your Node.js projects:

```typescript
import { agent_sessions, agent_message_diff } from './script-ts/index';

await agent_sessions(10);
await agent_message_diff('msg_abc123');
```

### OpenCode Plugin

The OpenCode plugin provides a UI for viewing file changes:

```bash
cd opencode
npm install
npm run compile
```

Features:
- History tree view in the sidebar
- Click messages to view diffs
- Search file history across sessions

### VSCode Extension

The VSCode extension provides similar functionality in VSCode:

```bash
cd vscode
npm install
npm run compile
```

Features:
- History tree view in Explorer
- Command palette integration
- Right-click context menu for file history

## Features

### Shell Functions

#### `agent_sessions [limit]`

List recent OpenCode agent sessions with titles and metadata.

```bash
agent_sessions          # Show last 5 sessions
agent_sessions 10       # Show last 10 sessions
```

#### `agent_session_changes <session_id> [page_size]`

List messages with file changes in a session (paginated).

```bash
agent_session_changes ses_40cf936b4ffejsss3IluzE3n6Y
```

#### `agent_session_diff <session_id> [file_path]`

View file changes from the latest message in a session.

```bash
agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y
agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y src/index.ts
```

#### `agent_message_diff <message_id> [file_path]`

View file changes from a specific message.

```bash
agent_message_diff msg_bfd445c49001pyukn7ARR2RvWo
agent_message_diff msg_bfd445c49001pyukn7ARR2RvWo src/index.ts
```

#### `agent_diff_latest [file_path]`

View file changes from the most recent session.

```bash
agent_diff_latest
agent_diff_latest src/index.ts
```

#### `agent_file_history <file_path> [limit]`

Show all changes to a specific file across sessions.

```bash
agent_file_history src/index.ts
agent_file_history package.json 20
```

#### `agent_revert_file <message_id> <file_path>`

Interactively revert changes to a file from a message.

```bash
agent_revert_file msg_bfd445c49001pyukn7ARR2RvWo src/index.ts
```

## Common Workflows

### 1. Browse Recent Sessions

```bash
# List sessions
agent_sessions

# Pick one and see all changes
agent_session_changes ses_40cf936b4ffejsss3IluzE3n6Y

# View a specific message's diff
agent_message_diff msg_bfd445c49001pyukn7ARR2RvWo
```

### 2. Quick Check Latest Changes

```bash
# See what the agent just did
agent_diff_latest

# See changes to a specific file only
agent_diff_latest src/index.ts
```

### 3. Track a File's Evolution

```bash
# See all changes to a specific file
agent_file_history src/components/Header.tsx

# Search more sessions
agent_file_history package.json 30
```

### 4. Revert Unwanted Changes

```bash
# Find the message with unwanted changes
agent_session_changes ses_40cf936b4ffejsss3IluzE3n6Y

# View what will be reverted
agent_message_diff msg_bfd445c49001pyukn7ARR2RvWo src/index.ts

# Revert the changes (will ask for confirmation)
agent_revert_file msg_bfd445c49001pyukn7ARR2RvWo src/index.ts
```

## Requirements

- **Node.js** - Required for TypeScript modules and plugins
- **git** - Required to read OpenCode snapshots
- **OpenCode** - Agent storage at `~/.local/share/opencode/storage/`
- **jq** - JSON parsing for the shell versions (Zsh functions)

## How It Works

### Storage Layout

OpenCode stores agent data in:

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

### Project ID Resolution

All diff functions work from any directory by:

1. Looking up the session metadata to get `projectID` and `directory`
2. Using the project ID to find the git snapshot at `~/.local/share/opencode/snapshot/<projectID>`
3. Using the directory path as the git work-tree
4. Comparing the snapshot hash against the project files

This means you don't need to be in the project directory to view diffs!

### File Filtering

When you specify a file path, the functions use git's `--` path filter:

```bash
git diff <hash> -- <file_path>
```

This shows only changes to that specific file, making it easy to focus on what you care about.

## Plugin Architecture

Both the OpenCode and VSCode plugins share the same core utilities from the `shared/` directory:

```
shared/history.ts          # Core history access functions
    ↓
├── opencode/src/         # OpenCode plugin
│   ├── extension.ts
│   ├── historyTreeProvider.ts
│   └── commands.ts
│
└── vscode/src/           # VSCode extension
    ├── extension.ts
    ├── historyTreeProvider.ts
    └── commands.ts
```

This architecture ensures consistency between both plugins while allowing platform-specific UI implementations.

## Development

### Shell Scripts

The Zsh scripts can be modified directly and sourced immediately.

### TypeScript Modules

```bash
cd script-ts
npm install
# Edit index.ts
# Use directly with ts-node or compile
```

### Plugins

```bash
# OpenCode plugin
cd opencode
npm install
npm run watch  # Auto-compile on changes

# VSCode extension
cd vscode
npm install
npm run watch  # Auto-compile on changes
# Press F5 in VSCode to launch extension development host
```

## Troubleshooting

**"No sessions found"**
- Check that OpenCode has created sessions in `~/.local/share/opencode/storage/message/`

**"Could not determine project ID for message"**
- The session metadata file may be missing
- Try running from the project directory as a fallback

**"Snapshot not available"**
- The git snapshot for this change may have been cleaned up
- The message exists but the diff cannot be reconstructed

**"command not found: jq"**
- Install jq: `brew install jq` (macOS) or `apt install jq` (Linux)

## License

ISC
