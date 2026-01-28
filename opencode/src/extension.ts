import * as opencode from 'opencode';
import { HistoryTreeDataProvider } from './historyTreeProvider';
import { showMessageDiff, showSessionChanges, showFileHistory } from './commands';

export function activate(context: opencode.ExtensionContext) {
  console.log('OpenCode History Viewer extension is now active');

  // Register tree view
  const historyProvider = new HistoryTreeDataProvider();
  opencode.window.registerTreeDataProvider('opencodeHistory', historyProvider);

  // Register commands
  context.subscriptions.push(
    opencode.commands.registerCommand('opencode-history.showMessageDiff', showMessageDiff)
  );

  context.subscriptions.push(
    opencode.commands.registerCommand('opencode-history.showSessionChanges', showSessionChanges)
  );

  context.subscriptions.push(
    opencode.commands.registerCommand('opencode-history.showFileHistory', showFileHistory)
  );

  context.subscriptions.push(
    opencode.commands.registerCommand('opencode-history.refresh', () => {
      historyProvider.refresh();
    })
  );
}

export function deactivate() {}
