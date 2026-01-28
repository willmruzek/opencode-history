#!/bin/bash

# _get_project_id_from_session - Internal helper to get project ID from session
#
# Arguments:
#   session_id - The session ID to lookup
#
# Returns:
#   Prints the project ID to stdout
#
_get_project_id_from_session() {
    local session_id=$1
    
    # Try to find the session metadata file in any project
    for session_file in ~/.local/share/opencode/storage/session/*/$session_id.json; do
        if [ -f "$session_file" ]; then
            jq -r '.projectID // empty' "$session_file" 2>/dev/null
            return 0
        fi
    done
    
    return 1
}

# _get_project_id_from_message - Internal helper to get project ID from message
#
# Arguments:
#   msg_id - The message ID to lookup
#
# Returns:
#   Prints the project ID to stdout
#
_get_project_id_from_message() {
    local msg_id=$1
    
    # Look for the message file
    local msg_file=$(find ~/.local/share/opencode/storage/message/ses_* -name "$msg_id.json" 2>/dev/null | head -1)
    
    if [ -n "$msg_file" ]; then
        local session_id=$(jq -r '.sessionID' "$msg_file" 2>/dev/null)
        if [ -n "$session_id" ]; then
            _get_project_id_from_session "$session_id"
            return 0
        fi
    fi
    
    return 1
}

# agent_message_diff - View file changes from a specific message
#
# Usage:
#   agent_message_diff <message_id> [file_path]
#
# Arguments:
#   message_id - The message ID to inspect (required)
#   file_path  - Optional path to a specific file to show diff for
#
# Description:
#   Displays the git diff for file changes from a specific message.
#   This allows viewing changes from any message, not just the latest
#   in a session.
#
#   The diff is retrieved from OpenCode's git snapshot storage and compared
#   against the current working tree.
#
#   Works from any directory - does not require being in the project repository.
#
# Examples:
#   agent_message_diff msg_bfd445c49001pyukn7ARR2RvWo
#   agent_message_diff msg_bfd445c49001pyukn7ARR2RvWo src/index.ts
#
# Notes:
#   - Message IDs can be found using agent_session_changes
#   - If no file changes exist, reports "No file changes in message"
#   - If snapshot is missing, reports "Snapshot not available"
#   - File path should be relative to project root
#
agent_message_diff() {
    local msg_id=$1
    local file_path=$2
    
    if [ -z "$msg_id" ]; then
        echo "Usage: agent_message_diff <message_id> [file_path]"
        return 1
    fi
    
    local hash=$(find ~/.local/share/opencode/storage/part/$msg_id -name "*.json" -exec jq -r 'select(.type == "patch") | .hash' {} \; 2>/dev/null | head -1)
    
    if [ -z "$hash" ] || [ "$hash" = "null" ]; then
        echo "No file changes in message: $msg_id"
        echo ""
        
        # Show what the agent did instead
        echo "=== Tools Used ==="
        find ~/.local/share/opencode/storage/part/$msg_id -name "*.json" -exec jq -r 'select(.type == "tool") | "- \(.tool)"' {} \; 2>/dev/null
        return 0
    fi
    
    # Get project ID from message metadata
    local project_id=$(_get_project_id_from_message "$msg_id")
    
    if [ -z "$project_id" ]; then
        echo "Error: Could not determine project ID for message"
        return 1
    fi
    
    local snapshot_dir=~/.local/share/opencode/snapshot/$project_id
    
    if ! [ -d "$snapshot_dir" ]; then
        echo "Error: Snapshot directory not found: $snapshot_dir"
        return 1
    fi
    
    if git --git-dir $snapshot_dir cat-file -e $hash 2>/dev/null; then
        # Get the project directory for work-tree
        local project_dir=$(find ~/.local/share/opencode/storage/session -name "*.json" -exec jq -r "select(.projectID == \"$project_id\") | .directory" {} \; 2>/dev/null | head -1)
        
        if [ -n "$project_dir" ] && [ -d "$project_dir" ]; then
            if [ -n "$file_path" ]; then
                git --git-dir $snapshot_dir --work-tree "$project_dir" diff $hash -- "$file_path"
            else
                git --git-dir $snapshot_dir --work-tree "$project_dir" diff $hash
            fi
        else
            # Fallback: just show the diff without work-tree
            if [ -n "$file_path" ]; then
                git --git-dir $snapshot_dir diff $hash -- "$file_path"
            else
                git --git-dir $snapshot_dir diff $hash
            fi
        fi
    else
        echo "Snapshot not available for hash: $hash"
    fi
}

# agent_session_diff - View file changes from the latest message in a session
#
# Usage:
#   agent_session_diff <session_id> [file_path]
#
# Arguments:
#   session_id - The session ID to inspect (required)
#   file_path  - Optional path to a specific file to show diff for
#
# Description:
#   Displays the git diff for file changes from the most recent message
#   in the specified session. If no file changes exist, shows which tools
#   were used instead.
#
#   This is a convenience wrapper around agent_message_diff that automatically
#   finds the latest message in a session.
#
#   Works from any directory - does not require being in the project repository.
#
# Examples:
#   agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y
#   agent_session_diff ses_40cf936b4ffejsss3IluzE3n6Y src/index.ts
#
# Notes:
#   - Shows the latest message's changes only
#   - Use agent_message_diff for specific messages
#   - File path should be relative to project root
#
agent_session_diff() {
    local session_id=$1
    local file_path=$2
    
    if [ -z "$session_id" ]; then
        echo "Usage: agent_session_diff <session_id> [file_path]"
        return 1
    fi
    
    # Get the latest message from this session
    local msg_id=$(ls -t ~/.local/share/opencode/storage/message/$session_id/*.json 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/.json$//')
    
    if [ -z "$msg_id" ]; then
        echo "No messages found in session: $session_id"
        return 1
    fi
    
    echo "Latest message: $msg_id"
    echo ""
    
    # Use agent_message_diff to show the changes
    agent_message_diff "$msg_id" "$file_path"
}

# agent_diff_latest - View file changes from the most recent session
#
# Usage:
#   agent_diff_latest [file_path]
#
# Arguments:
#   file_path - Optional path to a specific file to show diff for
#
# Description:
#   Convenience function that automatically finds the most recently modified
#   session and displays its latest message's file changes. Equivalent to
#   running agent_session_diff on the newest session.
#
#   Works from any directory - does not require being in the project repository.
#
# Examples:
#   agent_diff_latest
#   agent_diff_latest src/index.ts
#
# Notes:
#   - Shows changes from the latest message in the latest session
#   - If no sessions exist, reports "No sessions found"
#   - File path should be relative to project root
#
agent_diff_latest() {
    local file_path=$1
    local session_id=$(find ~/.local/share/opencode/storage/message -maxdepth 1 -type d -name "ses_*" 2>/dev/null | xargs ls -td 2>/dev/null | head -1 | xargs basename)
    
    if [ -z "$session_id" ]; then
        echo "No sessions found"
        return 1
    fi
    
    echo "Using session: $session_id"
    echo ""
    agent_session_diff $session_id "$file_path"
}

# agent_file_history - Show all changes to a specific file across sessions
#
# Usage:
#   agent_file_history <file_path> [limit]
#
# Arguments:
#   file_path - Path to the file to track (required, relative to project root)
#   limit     - Number of sessions to search (default: 10)
#
# Description:
#   Searches through recent sessions to find all messages that modified
#   the specified file. Shows a chronological history of changes.
#
#   Works from any directory.
#
# Examples:
#   agent_file_history src/index.ts
#   agent_file_history package.json 20
#
# Notes:
#   - File path should be relative to project root
#   - Shows changes in reverse chronological order (newest first)
#   - Press Enter to see diffs, 'q' to quit
#
agent_file_history() {
    local file_path=$1
    local limit=${2:-10}
    
    if [ -z "$file_path" ]; then
        echo "Usage: agent_file_history <file_path> [limit]"
        return 1
    fi
    
    echo "File history for: $file_path"
    echo "Searching last $limit sessions..."
    echo ""
    
    local count=0
    
    # Search through recent sessions
    for session_dir in $(find ~/.local/share/opencode/storage/message -maxdepth 1 -type d -name "ses_*" 2>/dev/null | xargs ls -td 2>/dev/null | head -n $limit); do
        local session_id=$(basename "$session_dir")
        
        # Get session title
        local title=""
        for session_file in ~/.local/share/opencode/storage/session/*/$session_id.json; do
            if [ -f "$session_file" ]; then
                title=$(jq -r '.title // "(no title)"' "$session_file" 2>/dev/null)
                [ "$title" != "(no title)" ] && break
            fi
        done
        
        # Check each message in this session
        for msg_file in $(ls -t $session_dir/*.json 2>/dev/null); do
            local msg_id=$(basename "$msg_file" .json)
            
            # Check if this message has a patch
            local hash=$(find ~/.local/share/opencode/storage/part/$msg_id -name "*.json" -exec jq -r 'select(.type == "patch") | .hash' {} \; 2>/dev/null | head -1)
            
            if [ -n "$hash" ] && [ "$hash" != "null" ]; then
                # Get project ID to check the diff
                local project_id=$(_get_project_id_from_message "$msg_id")
                
                if [ -n "$project_id" ]; then
                    local snapshot_dir=~/.local/share/opencode/snapshot/$project_id
                    
                    # Check if this hash touches our file
                    if git --git-dir $snapshot_dir cat-file -e $hash 2>/dev/null; then
                        local files_changed=$(git --git-dir $snapshot_dir diff --name-only $hash 2>/dev/null)
                        
                        if echo "$files_changed" | grep -q "^${file_path}$"; then
                            local timestamp=$(jq -r '.time.created' "$msg_file" 2>/dev/null)
                            local date=$(date -r $(echo "$timestamp / 1000" | bc) "+%Y-%m-%d %H:%M" 2>/dev/null)
                            
                            echo "[$msg_id]"
                            echo "  Session: $session_id"
                            echo "  Title: $title"
                            echo "  Time: $date"
                            echo ""
                            
                            printf "  Show diff? (Enter/s to skip/q to quit): "
                            read -r response
                            
                            if [ "$response" = "q" ]; then
                                echo ""
                                echo "Stopped at $count change(s)"
                                return 0
                            elif [ "$response" != "s" ]; then
                                echo ""
                                agent_message_diff "$msg_id" "$file_path"
                                echo ""
                            fi
                            
                            ((count++))
                            echo ""
                        fi
                    fi
                fi
            fi
        done
    done
    
    if [ $count -eq 0 ]; then
        echo "No changes found for: $file_path"
    else
        echo "Total: $count change(s) found"
    fi
}

# agent_revert_file - Interactively revert changes to a file from a message
#
# Usage:
#   agent_revert_file <message_id> <file_path>
#
# Arguments:
#   message_id - The message ID containing the changes
#   file_path  - Path to the file to revert (relative to project root)
#
# Description:
#   Shows the changes made to a file in a message and allows you to
#   revert them (reverse apply the patch).
#
#   This modifies your working tree directly, so make sure you have
#   any important uncommitted work saved first.
#
#   Works from any directory - does not require being in the project repository.
#
# Examples:
#   agent_revert_file msg_bfd445c49001pyukn7ARR2RvWo src/index.ts
#
# Notes:
#   - Shows the diff before reverting
#   - Asks for confirmation
#   - Applies the reverse patch to your working tree
#   - If conflicts occur, use git status to see what needs resolution
#
agent_revert_file() {
    local msg_id=$1
    local file_path=$2
    
    if [ -z "$msg_id" ] || [ -z "$file_path" ]; then
        echo "Usage: agent_revert_file <message_id> <file_path>"
        return 1
    fi
    
    # Get the hash
    local hash=$(find ~/.local/share/opencode/storage/part/$msg_id -name "*.json" -exec jq -r 'select(.type == "patch") | .hash' {} \; 2>/dev/null | head -1)
    
    if [ -z "$hash" ] || [ "$hash" = "null" ]; then
        echo "No file changes in message: $msg_id"
        return 0
    fi
    
    # Get project ID and directory
    local project_id=$(_get_project_id_from_message "$msg_id")
    
    if [ -z "$project_id" ]; then
        echo "Error: Could not determine project ID for message"
        return 1
    fi
    
    local snapshot_dir=~/.local/share/opencode/snapshot/$project_id
    
    if [ ! -d "$snapshot_dir" ]; then
        echo "Error: Snapshot directory not found for project: $project_id"
        return 1
    fi
    
    local project_dir=$(find ~/.local/share/opencode/storage/session -name "*.json" -exec jq -r "select(.projectID == \"$project_id\") | .directory" {} \; 2>/dev/null | head -1)
    
    if [ -z "$project_dir" ] || [ ! -d "$project_dir" ]; then
        echo "Error: Could not find project directory"
        return 1
    fi
    
    if ! git --git-dir "$snapshot_dir" cat-file -e "$hash" 2>/dev/null; then
        echo "Error: Snapshot does not contain hash: $hash"
        return 1
    fi
    
    # Check if this hash touches our file
    local files_changed=$(git --git-dir "$snapshot_dir" diff --name-only "$hash" 2>/dev/null)
    
    if ! echo "$files_changed" | grep -Fxq "$file_path"; then
        echo "Error: File '$file_path' was not modified in message $msg_id"
        return 1
    fi
    
    # Show the diff first
    echo "Changes to revert in: $file_path"
    echo ""
    git --git-dir "$snapshot_dir" --work-tree "$project_dir" diff "$hash" -- "$file_path"
    echo ""
    
    printf "Revert these changes? (y/N): "
    read -r response
    
    case "$response" in
        y|Y)
            # Revert changes to this file
            if ( cd "$project_dir" && git --git-dir "$snapshot_dir" --work-tree "$project_dir" diff "$hash" -- "$file_path" | git apply -R 2>/dev/null ); then
                echo "✓ Successfully reverted changes to $file_path"
            else
                echo "✗ Failed to apply reverse patch cleanly"
                echo ""
                echo "Try one of these:"
                echo "  1. Resolve conflicts manually"
                echo "  2. Use: git --git-dir \"$snapshot_dir\" --work-tree \"$project_dir\" diff \"$hash\" -- \"$file_path\" | git apply -R --reject"
                echo "     (Creates .rej files for conflicts)"
                return 1
            fi
            ;;
        *)
            echo "Cancelled"
            return 0
            ;;
    esac
}
