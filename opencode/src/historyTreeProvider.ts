import * as opencode from 'opencode';
import { getRecentSessions, getSessionMessages, Session, Message } from 'opencode-history-shared';

export class HistoryTreeDataProvider implements opencode.TreeDataProvider<HistoryItem> {
  private _onDidChangeTreeData: opencode.EventEmitter<HistoryItem | undefined | null | void> = 
    new opencode.EventEmitter<HistoryItem | undefined | null | void>();
  readonly onDidChangeTreeData: opencode.Event<HistoryItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HistoryItem): opencode.TreeItem {
    return element;
  }

  async getChildren(element?: HistoryItem): Promise<HistoryItem[]> {
    if (!element) {
      // Root level - show recent sessions
      const sessions = await getRecentSessions(10);
      return sessions.map(session => new SessionItem(session));
    } else if (element instanceof SessionItem) {
      // Show messages with file changes in this session
      const messages = await getSessionMessages(element.sessionId);
      return messages.map(msg => new MessageItem(msg, element.sessionId));
    }
    return [];
  }
}

class SessionItem extends opencode.TreeItem {
  constructor(public readonly session: Session) {
    super(session.title || '(no title)', opencode.TreeItemCollapsibleState.Collapsed);
    this.sessionId = session.id;
    this.description = `${session.messageCount} messages`;
    this.tooltip = `Session: ${session.id}\nModified: ${session.modified}`;
    this.contextValue = 'session';
  }

  sessionId: string;
}

class MessageItem extends opencode.TreeItem {
  constructor(public readonly message: Message, public readonly sessionId: string) {
    super(`Message ${message.id.substring(0, 12)}...`, opencode.TreeItemCollapsibleState.None);
    this.description = message.timestamp;
    this.tooltip = `Message: ${message.id}\nHash: ${message.hash}`;
    this.contextValue = 'message';
    this.command = {
      command: 'opencode-history.showMessageDiff',
      title: 'Show Diff',
      arguments: [message.id]
    };
  }
}

type HistoryItem = SessionItem | MessageItem;
