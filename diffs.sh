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
#   interactively revert them (reverse apply the patch).
#
#   Uses git apply to reverse the changes. You can choose to revert all
#   changes or cancel.
#
# Examples:
#   agent_revert_file msg_bfd445c49001pyukn7ARR2RvWo src/index.ts
#
# Notes:
#   - Changes the working directory to the project directory
#   - Applies changes directly to your working tree
#   - Use with caution - make sure you have uncommitted work saved
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
    local project_dir=$(find ~/.local/share/opencode/storage/session -name "*.json" -exec jq -r "select(.projectID == \"$project_id\") | .directory" {} \; 2>/dev/null | head -1)
    
    if [ -z "$project_dir" ] || [ ! -d "$project_dir" ]; then
        echo "Error: Could not find project directory"
        return 1
    fi
    
    # Show the diff first
    echo "Changes to revert in: $file_path"
    echo "Project: $project_dir"
    echo ""
    git --git-dir $snapshot_dir --work-tree "$project_dir" diff $hash -- "$file_path"
    echo ""
    
    printf "Revert these changes? (y/N): "
    read -r response
    
    case "$response" in
        y|Y)
            # Save current directory
            local orig_dir=$(pwd)
            
            # Go to project directory and apply reverse patch
            cd "$project_dir"
            
            if git --git-dir $snapshot_dir diff $hash -- "$file_path" | git apply -R 2>/dev/null; then
                echo "✓ Successfully reverted changes to $file_path"
            else
                echo "✗ Failed to revert changes (there may be conflicts)"
                echo ""
                echo "You can try manually:"
                echo "  cd $project_dir"
                echo "  git --git-dir $snapshot_dir diff $hash -- $file_path | git apply -R --reject"
            fi
            
            # Return to original directory
            cd "$orig_dir"
            ;;
        *)
            echo "Cancelled"
            ;;
    esac
}