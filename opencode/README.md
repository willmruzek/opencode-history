# OpenCode History Viewer

View file edits made by OpenCode agents in each message.

## Features

- **History Tree View**: Browse recent sessions and messages with file changes
- **Message Diff Viewer**: View file changes from specific messages
- **Session Changes**: List all messages with file changes in a session
- **File History**: Track all changes to a specific file across sessions

## Commands

- `OpenCode: Show Message File Changes` - View diff for a specific message
- `OpenCode: Show Session File Changes` - List messages with changes in a session
- `OpenCode: Show File History` - Show all changes to the current file

## Usage

1. Open the OpenCode History view in the Explorer sidebar
2. Expand a session to see messages with file changes
3. Click on a message to view the diff
4. Use the command palette to search by file or session

## Development

```bash
npm install
npm run compile
```

## Requirements

- OpenCode storage at `~/.local/share/opencode/storage/`
- Git installed and available on PATH
