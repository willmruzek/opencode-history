#!/bin/bash

# agent_sessions - List recent OpenCode agent sessions with titles and metadata
#
# Usage:
#   agent_sessions [limit]
#
# Arguments:
#   limit - Number of sessions to display (default: 5)
#
# Description:
#   Lists recent agent sessions in reverse chronological order, showing:
#   - Session ID
#   - Session title (from metadata)
#   - Last modified timestamp
#   - Number of messages in the session
#
# Examples:
#   agent_sessions          # Show last 5 sessions
#   agent_sessions 10       # Show last 10 sessions
#
agent_sessions() {
    local limit=${1:-5}
    
    echo "Recent sessions:"
    echo ""
    
    for session_dir in $(find ~/.local/share/opencode/storage/message -maxdepth 1 -type d -name "ses_*" 2>/dev/null | xargs ls -td 2>/dev/null | head -n $limit); do
        local session_id=$(basename "$session_dir")
        local msg_count=$(find "$session_dir" -maxdepth 1 -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
        
        # Portable way to get modification time (works on both Linux and macOS)
        if command -v stat >/dev/null 2>&1; then
            # Try BSD stat first (macOS)
            local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$session_dir" 2>/dev/null)
            # If that failed, try GNU stat (Linux)
            if [ -z "$modified" ]; then
                modified=$(stat -c "%y" "$session_dir" 2>/dev/null | sed 's/\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}\).*/\1/')
            fi
        else
            # Fallback to ls if stat is not available
            modified=$(ls -ld "$session_dir" 2>/dev/null | awk '{print $6, $7, $8}')
        fi
        
        # Try to find the session metadata file in any project
        local title="(no title)"
        for session_file in ~/.local/share/opencode/storage/session/*/$session_id.json; do
            if [ -f "$session_file" ]; then
                title=$(jq -r '.title // "(no title)"' "$session_file" 2>/dev/null)
                [ "$title" != "(no title)" ] && break
            fi
        done
        
        echo "[$session_id]"
        echo "  Title: $title"
        echo "  Modified: $modified | Messages: $msg_count"
        echo ""
    done
}

# agent_session_changes - List messages with file changes in a session
#
# Usage:
#   agent_session_changes <session_id> [page_size]
#
# Arguments:
#   session_id - The session ID to inspect (required)
#   page_size  - Number of messages to show per page (default: 10)
#
# Description:
#   Lists all messages in a session that contain file changes (patches).
#   Results are paginated and displayed in reverse chronological order.
#   For each message with changes, shows:
#   - Message ID
#   - Timestamp
#   - Git snapshot hash
#   - Snapshot availability status
#
#   Press Enter to see more results, or 'q' to quit early.
#
# Examples:
#   agent_session_changes ses_40cf936b4ffejsss3IluzE3n6Y
#   agent_session_changes ses_40cf936b4ffejsss3IluzE3n6Y 20
#
# Notes:
#   - Only shows messages that have associated file patches
#   - Requires being in a git repository to check snapshot availability
#   - Snapshots are stored in ~/.local/share/opencode/snapshot/<project_id>
#
agent_session_changes() {
    local session_id=$1
    local page_size=10
    
    if [ -z "$session_id" ]; then
        echo "Usage: agent_session_changes <session_id> [page_size]"
        return 1
    fi
    
    # Allow custom page size
    if [ -n "$2" ]; then
        page_size=$2
    fi
    
    if [ ! -d ~/.local/share/opencode/storage/message/$session_id ]; then
        echo "Session not found: $session_id"
        return 1
    fi
    
    echo "Messages with file changes in session: $session_id"
    echo ""
    
    local count=0
    
    # Get project ID once
    local project_id=$(git rev-list --max-parents=0 --all 2>/dev/null | sort | head -n1)
    local snapshot_dir=""
    if [ -n "$project_id" ]; then
        snapshot_dir=~/.local/share/opencode/snapshot/$project_id
    fi
    
    # Process messages in reverse chronological order
    for msg_file in $(ls -t ~/.local/share/opencode/storage/message/$session_id/*.json); do
        local msg_id=$(basename "$msg_file" .json)
        
        # Check if this message has a patch
        local hash=$(find ~/.local/share/opencode/storage/part/$msg_id -name "*.json" -exec jq -r 'select(.type == "patch") | .hash' {} \; 2>/dev/null | head -1)
        
        if [ -n "$hash" ] && [ "$hash" != "null" ]; then
            local timestamp=$(jq -r '.time.created' "$msg_file" 2>/dev/null)
            local date=$(date -r $(echo "$timestamp / 1000" | bc) "+%Y-%m-%d %H:%M" 2>/dev/null)
            
            echo "[$msg_id]"
            echo "  Time: $date"
            echo "  Hash: $hash"
            
            # Check if snapshot exists
            if [ -n "$snapshot_dir" ]; then
                if git --git-dir $snapshot_dir cat-file -e $hash 2>/dev/null; then
                    echo "  Status: ✓ snapshot available"
                else
                    echo "  Status: ✗ snapshot missing"
                fi
            fi
            
            echo ""
            ((count++))
            
            # Paginate
            if [ $((count % page_size)) -eq 0 ]; then
                printf "--- Showing $count so far. Press Enter to continue (or 'q' to quit): "
                read -r response
                echo ""
                if [ "$response" = "q" ]; then
                    echo "Stopped at $count message(s)"
                    return 0
                fi
            fi
        fi
    done
    
    if [ $count -eq 0 ]; then
        echo "No messages with file changes found"
    else
        echo "Total: $count message(s) with file changes"
    fi
}