import * as vscode from 'vscode';
import {
  getMessageDiff,
  getSessionMessages,
  getFileHistory,
} from '@oc-hist/shared';

interface MessageQuickPickItem extends vscode.QuickPickItem {
  messageId: string;
}

export async function showMessageDiff(messageId?: string) {
  if (!messageId) {
    messageId = await vscode.window.showInputBox({
      prompt: 'Enter message ID',
      placeHolder: 'msg_...',
    });
  }

  if (!messageId) {
    return;
  }

  const diff = await getMessageDiff(messageId);
  if (!diff) {
    vscode.window.showInformationMessage(
      'No file changes found for this message',
    );
    return;
  }

  // Create a new document with the diff
  const doc = await vscode.workspace.openTextDocument({
    content: diff,
    language: 'diff',
  });
  await vscode.window.showTextDocument(doc);
}

export async function showSessionChanges(sessionId?: string) {
  if (!sessionId) {
    sessionId = await vscode.window.showInputBox({
      prompt: 'Enter session ID',
      placeHolder: 'ses_...',
    });
  }

  if (!sessionId) {
    return;
  }

  const changes = await getSessionMessages(sessionId);
  if (!changes || changes.length === 0) {
    vscode.window.showInformationMessage(
      'No file changes found for this session',
    );
    return;
  }

  // Show quick pick to select a message
  const selected = await vscode.window.showQuickPick<MessageQuickPickItem>(
    changes.map((msg) => ({
      label: msg.id,
      description: msg.timestamp,
      detail: `Hash: ${msg.hash}`,
      messageId: msg.id,
    })),
    { placeHolder: 'Select a message to view changes' },
  );

  if (selected) {
    await showMessageDiff(selected.messageId);
  }
}

export async function showFileHistory(filePath?: string) {
  if (!filePath) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      filePath = vscode.workspace.asRelativePath(editor.document.uri);
    } else {
      filePath = await vscode.window.showInputBox({
        prompt: 'Enter file path',
        placeHolder: 'src/index.ts',
      });
    }
  }

  if (!filePath) {
    return;
  }

  const history = await getFileHistory(filePath, 20);
  if (!history || history.length === 0) {
    vscode.window.showInformationMessage(`No history found for: ${filePath}`);
    return;
  }

  // Show quick pick to select a change
  const selected = await vscode.window.showQuickPick<MessageQuickPickItem>(
    history.map((entry) => ({
      label: entry.sessionTitle,
      description: entry.timestamp,
      detail: `Message: ${entry.messageId}`,
      messageId: entry.messageId,
    })),
    { placeHolder: `Select a change to view for ${filePath}` },
  );

  if (selected) {
    const diff = await getMessageDiff(selected.messageId, filePath);
    if (diff) {
      const doc = await vscode.workspace.openTextDocument({
        content: diff,
        language: 'diff',
      });
      await vscode.window.showTextDocument(doc);
    }
  }
}
