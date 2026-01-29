import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "child_process";

const homeDir = os.homedir();
const storageRoot = path.join(homeDir, ".local/share/opencode/storage");
const messageRoot = path.join(storageRoot, "message");
const partRoot = path.join(storageRoot, "part");
const sessionRoot = path.join(storageRoot, "session");
const snapshotRoot = path.join(homeDir, ".local/share/opencode/snapshot");

export interface Entry {
  name: string;
  path: string;
  stat: fs.Stats;
}

export interface Session {
  id: string;
  title: string;
  modified: string;
  messageCount: number;
}

export interface Message {
  id: string;
  timestamp: string;
  hash: string;
  hasSnapshot: boolean;
}

export interface FileHistoryEntry {
  messageId: string;
  sessionId: string;
  sessionTitle: string;
  timestamp: string;
  hash: string;
}

export function listDirectories(dir: string): Entry[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const entryPath = path.join(dir, entry.name);
        return {
          name: entry.name,
          path: entryPath,
          stat: fs.statSync(entryPath),
        };
      });
  } catch {
    return [];
  }
}

export function listFiles(dir: string): Entry[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const entryPath = path.join(dir, entry.name);
        return {
          name: entry.name,
          path: entryPath,
          stat: fs.statSync(entryPath),
        };
      });
  } catch {
    return [];
  }
}

export function sortByMtimeDesc(entries: Entry[]): Entry[] {
  return entries.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
}

export function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function formatDate(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimestamp(timestamp: unknown): string {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric)) {
    return "(unknown)";
  }
  return formatDate(new Date(numeric));
}

export function runGit(args: string[], cwd?: string): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    cwd,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function getPatchHash(msgId: string): string | null {
  const partDir = path.join(partRoot, msgId);
  const partFiles = listFiles(partDir).filter((file) => file.name.endsWith(".json"));

  for (const file of partFiles) {
    const data = safeReadJson(file.path);
    if (data?.type === "patch" && typeof data.hash === "string") {
      return data.hash;
    }
  }

  return null;
}

export function getSessionTitle(sessionId: string): string {
  const projectDirs = listDirectories(sessionRoot);
  let title = "(no title)";

  for (const projectDir of projectDirs) {
    const sessionFile = path.join(projectDir.path, `${sessionId}.json`);
    if (!fs.existsSync(sessionFile)) {
      continue;
    }

    const data = safeReadJson(sessionFile);
    if (typeof data?.title === "string") {
      title = data.title;
      if (title !== "(no title)") {
        return title;
      }
    }
  }

  return title;
}

export function getProjectIdFromSession(sessionId: string): string | null {
  if (!sessionId) {
    return null;
  }

  const projectDirs = listDirectories(sessionRoot);
  for (const projectDir of projectDirs) {
    const sessionFile = path.join(projectDir.path, `${sessionId}.json`);
    if (!fs.existsSync(sessionFile)) {
      continue;
    }

    const data = safeReadJson(sessionFile);
    if (typeof data?.projectID === "string" && data.projectID.length > 0) {
      return data.projectID;
    }
  }

  return null;
}

export function findMessageFile(msgId: string): { path: string; sessionId: string } | null {
  const sessionDirs = sortByMtimeDesc(
    listDirectories(messageRoot).filter((dir) => dir.name.startsWith("ses_"))
  );

  for (const sessionDir of sessionDirs) {
    const msgPath = path.join(sessionDir.path, `${msgId}.json`);
    if (!fs.existsSync(msgPath)) {
      continue;
    }

    const data = safeReadJson(msgPath);
    const sessionId =
      typeof data?.sessionID === "string" ? data.sessionID : sessionDir.name;

    return { path: msgPath, sessionId };
  }

  return null;
}

export function getProjectIdFromMessage(msgId: string): string | null {
  if (!msgId) {
    return null;
  }

  const messageInfo = findMessageFile(msgId);
  if (!messageInfo) {
    return null;
  }

  return getProjectIdFromSession(messageInfo.sessionId);
}

export function getProjectDirectory(projectId: string): string | null {
  const projectDir = path.join(sessionRoot, projectId);
  const candidateFiles: string[] = [];

  if (fs.existsSync(projectDir)) {
    candidateFiles.push(
      ...listFiles(projectDir)
        .filter((file) => file.name.endsWith(".json"))
        .map((file) => file.path)
    );
  }

  if (candidateFiles.length === 0) {
    for (const dir of listDirectories(sessionRoot)) {
      candidateFiles.push(
        ...listFiles(dir.path)
          .filter((file) => file.name.endsWith(".json"))
          .map((file) => file.path)
      );
    }
  }

  for (const sessionFile of candidateFiles) {
    const data = safeReadJson(sessionFile);
    if (data?.projectID === projectId && typeof data?.directory === "string") {
      return data.directory;
    }
  }

  return null;
}

export function gitCatFileExists(snapshotDir: string, hash: string): boolean {
  const result = runGit(["--git-dir", snapshotDir, "cat-file", "-e", hash]);
  return result.status === 0;
}

export function getRecentSessions(limit: number = 10): Session[] {
  const sessionDirs = sortByMtimeDesc(
    listDirectories(messageRoot).filter((dir) => dir.name.startsWith("ses_"))
  ).slice(0, limit);

  const sessions: Session[] = [];

  for (const sessionDir of sessionDirs) {
    const sessionId = sessionDir.name;
    const messageFiles = listFiles(sessionDir.path).filter((file) =>
      file.name.endsWith(".json")
    );
    const msgCount = messageFiles.length;
    const modified = formatDate(sessionDir.stat.mtime);
    const title = getSessionTitle(sessionId);

    sessions.push({
      id: sessionId,
      title,
      modified,
      messageCount: msgCount,
    });
  }

  return sessions;
}

export function getSessionMessages(sessionId: string): Message[] {
  if (!/^ses_[A-Za-z0-9_-]+$/.test(sessionId)) {
    return [];
  }

  const sessionDir = path.join(messageRoot, sessionId);
  if (!fs.existsSync(sessionDir)) {
    return [];
  }

  const projectId = getProjectIdFromSession(sessionId);
  const snapshotDir = projectId ? path.join(snapshotRoot, projectId) : "";

  const messageFiles = sortByMtimeDesc(
    listFiles(sessionDir).filter((file) => file.name.endsWith(".json"))
  );

  const messages: Message[] = [];

  for (const msgFile of messageFiles) {
    const msgId = msgFile.name.replace(/\.json$/, "");
    const hash = getPatchHash(msgId);

    if (hash) {
      const data = safeReadJson(msgFile.path);
      const timestamp = data?.time && typeof data.time === "object"
        ? (data.time as { created?: number }).created
        : undefined;
      const date = formatTimestamp(timestamp);

      const hasSnapshot = snapshotDir ? gitCatFileExists(snapshotDir, hash) : false;

      messages.push({
        id: msgId,
        timestamp: date,
        hash,
        hasSnapshot,
      });
    }
  }

  return messages;
}

/**
 * Get the git diff for a specific message.
 * 
 * @param messageId - The message ID to get diff for
 * @param filePath - Optional path to filter diff to specific file
 * @returns Diff string or null if not found
 * 
 * Returns null in the following cases:
 * - Invalid message ID format
 * - Message has no associated patch hash
 * - Cannot determine project ID from message
 * - Snapshot directory doesn't exist for project
 * - Git hash doesn't exist in snapshot
 */
export function getMessageDiff(messageId: string, filePath?: string): string | null {
  // Validate message ID format (alphanumeric, periods, underscores, hyphens only)
  if (!/^[A-Za-z0-9._-]+$/.test(messageId)) {
    return null;
  }

  const hash = getPatchHash(messageId);
  if (!hash) {
    return null;
  }

  const projectId = getProjectIdFromMessage(messageId);
  if (!projectId) {
    return null;
  }

  const snapshotDir = path.join(snapshotRoot, projectId);
  if (!fs.existsSync(snapshotDir)) {
    return null;
  }

  if (!gitCatFileExists(snapshotDir, hash)) {
    return null;
  }

  const projectDir = getProjectDirectory(projectId);
  const args: string[] = ["--git-dir", snapshotDir];
  if (projectDir && fs.existsSync(projectDir)) {
    args.push("--work-tree", projectDir);
  }
  args.push("diff", hash);
  if (filePath) {
    args.push("--", filePath);
  }

  const result = runGit(args);
  return result.stdout || null;
}

/**
 * Get all changes to a specific file across recent sessions.
 * 
 * @param filePath - The file path to search for
 * @param limit - Maximum number of recent sessions to search (default: 10)
 * @returns Array of file history entries
 * 
 * Performance note: This function has O(n*m) complexity, where n is the number 
 * of sessions and m is the average number of messages per session. For each 
 * message with a hash, it spawns a git process to get changed files. Consider 
 * batching git operations or caching results for better performance in large 
 * repositories.
 */
export function getFileHistory(filePath: string, limit: number = 10): FileHistoryEntry[] {
  const history: FileHistoryEntry[] = [];

  const sessionDirs = sortByMtimeDesc(
    listDirectories(messageRoot).filter((dir) => dir.name.startsWith("ses_"))
  ).slice(0, limit);

  for (const sessionDir of sessionDirs) {
    const sessionId = sessionDir.name;
    const title = getSessionTitle(sessionId);

    const messageFiles = sortByMtimeDesc(
      listFiles(sessionDir.path).filter((file) => file.name.endsWith(".json"))
    );

    for (const msgFile of messageFiles) {
      const msgId = msgFile.name.replace(/\.json$/, "");
      const hash = getPatchHash(msgId);

      if (!hash) {
        continue;
      }

      const projectId = getProjectIdFromMessage(msgId);
      if (!projectId) {
        continue;
      }

      const snapshotDir = path.join(snapshotRoot, projectId);
      if (!gitCatFileExists(snapshotDir, hash)) {
        continue;
      }

      const projectDir = getProjectDirectory(projectId);
      const args: string[] = ["--git-dir", snapshotDir];
      if (projectDir && fs.existsSync(projectDir)) {
        args.push("--work-tree", projectDir);
      }
      args.push("diff", "--name-only", hash);

      const diffResult = runGit(args);

      const filesChanged = diffResult.stdout
        .split(/\r?\n/)
        .filter(Boolean);

      if (!filesChanged.includes(filePath)) {
        continue;
      }

      const data = safeReadJson(msgFile.path);
      const timestamp = data?.time && typeof data.time === "object"
        ? (data.time as { created?: number }).created
        : undefined;
      const date = formatTimestamp(timestamp);

      history.push({
        messageId: msgId,
        sessionId,
        sessionTitle: title,
        timestamp: date,
        hash,
      });
    }
  }

  return history;
}
