# OpenCode History Viewer (VSCode Extension)

View file edits made by OpenCode agents in each message.

## Features

- **History Tree View**: Browse recent sessions and messages with file changes
- **Message Diff Viewer**: View file changes from specific messages
- **Session Changes**: List all messages with file changes in a session
- **File History**: Track all changes to a specific file across sessions
- **Context Menu Integration**: Right-click in editor to view file history

## Commands

- `OpenCode: Show Message File Changes` - View diff for a specific message
- `OpenCode: Show Session File Changes` - List messages with changes in a session
- `OpenCode: Show File History` - Show all changes to the current file
- `OpenCode: Refresh History` - Refresh the history tree view

## Usage

1. Open the OpenCode History view in the Explorer sidebar
2. Expand a session to see messages with file changes
3. Click on a message to view the diff
4. Use the command palette or right-click in an editor to search by file

## Installation

1. Install dependencies: `npm install`
2. Build: `npm run compile`
3. Package: `vsce package`
4. Install the .vsix file in VSCode

## Requirements

- OpenCode storage at `~/.local/share/opencode/storage/`
- Git installed and available on PATH

## Development

```bash
npm install
npm run watch
```

Press F5 to open a new VSCode window with the extension loaded.
