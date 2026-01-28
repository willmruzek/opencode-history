# OpenCode Agent Tools

Shell functions for exploring OpenCode agent session history and viewing file changes.

## Functions

### agent_sessions

List recent OpenCode agent sessions with titles and metadata.

**Usage:**
```bash
agent_sessions [limit]
```

**Arguments:**
- `limit` - Number of sessions to display (default: 5)

**Examples:**
```bash
agent_sessions          # Show last 5 sessions
agent_sessions 10       # Show last 10 sessions
```

**Output:**
```
Recent sessions:

[ses_40cf936b4ffejsss3IluzE3n6Y]
  Title: Bloomington Arts Today
  Modified: 2026-01-27 12:37 | Messages: 2358

[ses_402bbe799ffeElKmZq843zHFDw]
  Title: Explore admin framework relations
  Modified: 2026-01-26 21:24 | Messages: 9
```

**Notes:**
- Works from any directory
- Shows sessions from all projects

---

### agent_session_changes

List messages with file changes in a session (paginated).

**Usage:**
```bash
agent_session_changes <session_id> [page_size]
```

**Arguments:**
- `session_id` - The session ID to inspect (required)
- `page_size` - Number of messages to show per page (default: 10)

**Examples:**
```bash
agent_session_changes ses_40cf936b4ffejsss3IluzE3n6Y
agent_session_changes ses_40cf936b4ffejsss3IluzE3n6Y 20
```

**Output:**
```
Messages with file changes in session: ses_40cf936b4ffejsss3IluzE3n6Y

[msg_bfd445c49001pyukn7ARR2RvWo]
  Time: 2026-01-26 21:20
  Hash: a1b2c3d4e5f6
  Status: ✓ snapshot available

--- Showing 10 so far. Press Enter to continue (or 'q' to quit):
```

**Notes:**
- Works from any directory
- Only shows messages that have associated file patches
- Press Enter to see more, 'q' to quit

---

### agent_session_diff

View file changes from the latest message in a session.

**Usage:**
```bash
agent_session_diff <session_id> [file_path]
```

**Arguments:**
- `session_id` - The session ID to inspect (required)
- `file_path` - Optional path to a specific file (relative to project root)

**Examples:**
```bash
agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y
agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y src/index.ts
```

**Output:**
Shows a git diff of file changes, or lists tools used if no file changes exist.

**Notes:**
- Works from any directory
- Shows the latest message's changes only
- Uses `agent_message_diff` internally
- File path filters to show only changes to that specific file

---

### agent_message_diff

View file changes from a specific message.

**Usage:**
```bash
agent_message_diff <message_id> [file_path]
```

**Arguments:**
- `message_id` - The message ID to inspect (required)
- `file_path` - Optional path to a specific file (relative to project root)

**Examples:**
```bash
agent_message_diff msg_bfd445c49001pyukn7ARR2RvWo
agent_message_diff msg_bfd445c49001pyukn7ARR2RvWo src/index.ts
```

**Output:**
Shows a git diff of file changes from that specific message.

**Notes:**
- Works from any directory
- Message IDs can be found using `agent_session_changes`
- Shows tools used if no file changes exist
- File path filters to show only changes to that specific file

---

### agent_diff_latest

View file changes from the most recent session.

**Usage:**
```bash
agent_diff_latest [file_path]
```

**Arguments:**
- `file_path` - Optional path to a specific file (relative to project root)

**Examples:**
```bash
agent_diff_latest
agent_diff_latest src/index.ts
```

**Output:**
Automatically finds and displays changes from the latest session.

**Notes:**
- Works from any directory
- Convenience wrapper around `agent_session_diff`
- File path filters to show only changes to that specific file

---

### agent_file_history

Show all changes to a specific file across sessions.

**Usage:**
```bash
agent_file_history <file_path> [limit]
```

**Arguments:**
- `file_path` - Path to the file to track (required, relative to project root)
- `limit` - Number of sessions to search (default: 10)

**Examples:**
```bash
agent_file_history src/index.ts
agent_file_history package.json 20
```

**Output:**
```
File history for: src/index.ts
Searching last 10 sessions...

[msg_bfd445c49001pyukn7ARR2RvWo]
  Session: ses_40cf936b4ffejsss3IluzE3n6Y
  Title: Bloomington Arts Today
  Time: 2026-01-26 21:20

  Show diff? (Enter/s to skip/q to quit):
```

**Notes:**
- Works from any directory
- Shows changes in reverse chronological order (newest first)
- Press Enter to see each diff, 's' to skip, 'q' to quit
- Great for tracking evolution of a specific file

---

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

### 3. Review Session History
```bash
# See many sessions
agent_sessions 20

# Deep dive into one
agent_session_changes ses_40cf936b4ffejsss3IluzE3n6Y 50
```

### 4. Track a File's Evolution
```bash
# See all changes to a specific file
agent_file_history src/components/Header.tsx

# Search more sessions
agent_file_history package.json 30
```

### 5. Filter Changes in a Session
```bash
# See only changes to specific files
agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y src/index.ts
agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y README.md
```

### 6. Work From Anywhere
```bash
# All commands work regardless of current directory
cd /tmp
agent_sessions
agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y
agent_file_history src/index.ts
```

---

## Requirements

- **jq** - JSON parsing (`brew install jq` on macOS)
- **OpenCode** - Agent storage at `~/.local/share/opencode/storage/`

---

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

---

## Troubleshooting

**"No sessions found"**
- Check that OpenCode has created sessions in `~/.local/share/opencode/storage/message/`

**"Could not determine project ID for message"**
- The session metadata file may be missing
- Try running from the project directory as a fallback

**"Snapshot not available"**
- The git snapshot for this change may have been cleaned up
- The message exists but the diff cannot be reconstructed

**"No changes found for: \<file>"**
- The file wasn't modified in the searched sessions
- Try increasing the limit: `agent_file_history src/index.ts 50`
- Check that the file path is correct (relative to project root)

**"command not found: jq"**
- Install jq: `brew install jq` (macOS) or `apt install jq` (Linux)

**Diffs show wrong files or paths**
- Ensure the project directory hasn't moved
- The `directory` field in session metadata may be outdated