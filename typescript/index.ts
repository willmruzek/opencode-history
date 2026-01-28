import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "child_process";
import * as readline from "node:readline";

type Entry = {
  name: string;
  path: string;
  stat: fs.Stats;
};

type GitResult = {
  status: number;
  stdout: string;
  stderr: string;
};

const homeDir = os.homedir();
const storageRoot = path.join(homeDir, ".local/share/opencode/storage");
const messageRoot = path.join(storageRoot, "message");
const partRoot = path.join(storageRoot, "part");
const sessionRoot = path.join(storageRoot, "session");
const snapshotRoot = path.join(homeDir, ".local/share/opencode/snapshot");

function listDirectories(dir: string): Entry[] {
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

function listFiles(dir: string): Entry[] {
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

function sortByMtimeDesc(entries: Entry[]): Entry[] {
  return entries.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
}

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatDate(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimestamp(timestamp: unknown): string {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric)) {
    return "(unknown)";
  }
  return formatDate(new Date(numeric));
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function runGit(args: string[], cwd?: string): GitResult {
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

function getPatchHash(msgId: string): string | null {
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

function getMessageTools(msgId: string): string[] {
  const partDir = path.join(partRoot, msgId);
  const partFiles = listFiles(partDir).filter((file) => file.name.endsWith(".json"));
  const tools: string[] = [];

  for (const file of partFiles) {
    const data = safeReadJson(file.path);
    if (data?.type === "tool" && typeof data.tool === "string") {
      tools.push(data.tool);
    }
  }

  return tools;
}

function findMessageFile(msgId: string): { path: string; sessionId: string } | null {
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

function getSessionTitle(sessionId: string): string {
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

function getProjectDirectory(projectId: string): string | null {
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

function getGitProjectId(): string | null {
  const result = runGit(["rev-list", "--max-parents=0", "--all"]);
  if (result.status !== 0) {
    return null;
  }

  const commits = result.stdout.split(/\r?\n/).filter(Boolean).sort();
  return commits[0] ?? null;
}

function gitCatFileExists(snapshotDir: string, hash: string): boolean {
  const result = runGit(["--git-dir", snapshotDir, "cat-file", "-e", hash]);
  return result.status === 0;
}

function runGitDiff(
  snapshotDir: string,
  hash: string,
  filePath?: string,
  workTree?: string
): void {
  const args: string[] = ["--git-dir", snapshotDir];
  if (workTree) {
    args.push("--work-tree", workTree);
  }
  args.push("diff", hash);
  if (filePath) {
    args.push("--", filePath);
  }

  const result = runGit(args);
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function isValidMessageId(msgId: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(msgId);
}

function isValidSessionId(sessionId: string): boolean {
  return /^ses_[A-Za-z0-9_-]+$/.test(sessionId);
}

export function _get_project_id_from_session(sessionId: string): string | null {
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

export function _get_project_id_from_message(msgId: string): string | null {
  if (!msgId) {
    return null;
  }

  const messageInfo = findMessageFile(msgId);
  if (!messageInfo) {
    return null;
  }

  return _get_project_id_from_session(messageInfo.sessionId);
}

export async function agent_message_diff(
  msgId: string,
  filePath?: string
): Promise<void> {
  if (!msgId) {
    console.log("Usage: agent_message_diff <message_id> [file_path]");
    return;
  }

  if (!isValidMessageId(msgId)) {
    console.log("Error: Invalid message ID format");
    return;
  }

  const hash = getPatchHash(msgId);
  if (!hash) {
    console.log(`No file changes in message: ${msgId}`);
    console.log("");
    console.log("=== Tools Used ===");
    const tools = getMessageTools(msgId);
    for (const tool of tools) {
      console.log(`- ${tool}`);
    }
    return;
  }

  const projectId = _get_project_id_from_message(msgId);
  if (!projectId) {
    console.log("Error: Could not determine project ID for message");
    return;
  }

  const snapshotDir = path.join(snapshotRoot, projectId);
  if (!fs.existsSync(snapshotDir)) {
    console.log(`Error: Snapshot directory not found: ${snapshotDir}`);
    return;
  }

  if (!gitCatFileExists(snapshotDir, hash)) {
    console.log(`Snapshot not available for hash: ${hash}`);
    return;
  }

  const projectDir = getProjectDirectory(projectId);
  if (projectDir && fs.existsSync(projectDir)) {
    runGitDiff(snapshotDir, hash, filePath, projectDir);
  } else {
    runGitDiff(snapshotDir, hash, filePath);
  }
}

export async function agent_session_diff(
  sessionId: string,
  filePath?: string
): Promise<void> {
  if (!sessionId) {
    console.log("Usage: agent_session_diff <session_id> [file_path]");
    return;
  }

  // Validate sessionId to prevent path traversal and enforce expected format.
  // Session IDs must start with "ses_" and contain only safe characters.
  if (!isValidSessionId(sessionId)) {
    console.log("Error: Invalid session ID format");
    return;
  }

  const sessionDir = path.join(messageRoot, sessionId);
  const messageFiles = sortByMtimeDesc(
    listFiles(sessionDir).filter((file) => file.name.endsWith(".json"))
  );

  if (messageFiles.length === 0) {
    console.log(`No messages found in session: ${sessionId}`);
    return;
  }

  const latestMessage = messageFiles[0];
  const msgId = latestMessage.name.replace(/\.json$/, "");

  console.log(`Latest message: ${msgId}`);
  console.log("");

  await agent_message_diff(msgId, filePath);
}

export async function agent_diff_latest(filePath?: string): Promise<void> {
  const sessionDirs = sortByMtimeDesc(
    listDirectories(messageRoot).filter((dir) => dir.name.startsWith("ses_"))
  );

  if (sessionDirs.length === 0) {
    console.log("No sessions found");
    return;
  }

  const sessionId = sessionDirs[0].name;
  console.log(`Using session: ${sessionId}`);
  console.log("");

  await agent_session_diff(sessionId, filePath);
}

export async function agent_sessions(limit = 5): Promise<void> {
  const parsedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 5;
  const sessionDirs = sortByMtimeDesc(
    listDirectories(messageRoot).filter((dir) => dir.name.startsWith("ses_"))
  ).slice(0, parsedLimit);

  console.log("Recent sessions:");
  console.log("");

  for (const sessionDir of sessionDirs) {
    const sessionId = sessionDir.name;
    const messageFiles = listFiles(sessionDir.path).filter((file) =>
      file.name.endsWith(".json")
    );
    const msgCount = messageFiles.length;
    const modified = formatDate(sessionDir.stat.mtime);
    const title = getSessionTitle(sessionId);

    console.log(`[${sessionId}]`);
    console.log(`  Title: ${title}`);
    console.log(`  Modified: ${modified} | Messages: ${msgCount}`);
    console.log("");
  }
}

export async function agent_session_changes(
  sessionId: string,
  pageSize = 10
): Promise<void> {
  if (!sessionId) {
    console.log("Usage: agent_session_changes <session_id> [page_size]");
    return;
  }

  // Validate sessionId to prevent path traversal and enforce expected format.
  // Session IDs must start with "ses_" and contain only safe characters.
  if (!isValidSessionId(sessionId)) {
    console.log("Error: Invalid session ID format");
    return;
  }
  const sessionDir = path.join(messageRoot, sessionId);
  if (!fs.existsSync(sessionDir)) {
    console.log(`Session not found: ${sessionId}`);
    return;
  }

  const parsedPageSize = Number.isFinite(Number(pageSize))
    ? Number(pageSize)
    : 10;

  console.log(`Messages with file changes in session: ${sessionId}`);
  console.log("");

  let count = 0;

  const projectId = getGitProjectId();
  const snapshotDir = projectId ? path.join(snapshotRoot, projectId) : "";

  const messageFiles = sortByMtimeDesc(
    listFiles(sessionDir).filter((file) => file.name.endsWith(".json"))
  );

  for (const msgFile of messageFiles) {
    const msgId = msgFile.name.replace(/\.json$/, "");
    const hash = getPatchHash(msgId);

    if (hash) {
      const data = safeReadJson(msgFile.path);
      const timestamp = data?.time && typeof data.time === "object"
        ? (data.time as { created?: number }).created
        : undefined;
      const date = formatTimestamp(timestamp);

      console.log(`[${msgId}]`);
      console.log(`  Time: ${date}`);
      console.log(`  Hash: ${hash}`);

      if (snapshotDir) {
        if (gitCatFileExists(snapshotDir, hash)) {
          console.log("  Status: ✓ snapshot available");
        } else {
          console.log("  Status: ✗ snapshot missing");
        }
      }

      console.log("");
      count += 1;

      if (count % parsedPageSize === 0) {
        const response = await prompt(
          `--- Showing ${count} so far. Press Enter to continue (or 'q' to quit): `
        );
        console.log("");
        if (response === "q") {
          console.log(`Stopped at ${count} message(s)`);
          return;
        }
      }
    }
  }

  if (count === 0) {
    console.log("No messages with file changes found");
  } else {
    console.log(`Total: ${count} message(s) with file changes`);
  }
}

export async function agent_file_history(
  filePath: string,
  limit = 10
): Promise<void> {
  if (!filePath) {
    console.log("Usage: agent_file_history <file_path> [limit]");
    return;
  }

  const parsedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 10;

  console.log(`File history for: ${filePath}`);
  console.log(`Searching last ${parsedLimit} sessions...`);
  console.log("");

  let count = 0;

  const sessionDirs = sortByMtimeDesc(
    listDirectories(messageRoot).filter((dir) => dir.name.startsWith("ses_"))
  ).slice(0, parsedLimit);

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

      const projectId = _get_project_id_from_message(msgId);
      if (!projectId) {
        continue;
      }

      const snapshotDir = path.join(snapshotRoot, projectId);
      if (!gitCatFileExists(snapshotDir, hash)) {
        continue;
      }

      const diffResult = runGit([
        "--git-dir",
        snapshotDir,
        "diff",
        "--name-only",
        hash,
      ]);

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

      console.log(`[${msgId}]`);
      console.log(`  Session: ${sessionId}`);
      console.log(`  Title: ${title}`);
      console.log(`  Time: ${date}`);
      console.log("");

      const response = await prompt(
        "  Show diff? (Enter/s to skip/q to quit): "
      );

      if (response === "q") {
        console.log("");
        console.log(`Stopped at ${count} change(s)`);
        return;
      }

      if (response !== "s") {
        console.log("");
        await agent_message_diff(msgId, filePath);
        console.log("");
      }

      count += 1;
      console.log("");
    }
  }

  if (count === 0) {
    console.log(`No changes found for: ${filePath}`);
  } else {
    console.log(`Total: ${count} change(s) found`);
  }
}

export async function agent_revert_file(
  msgId: string,
  filePath: string
): Promise<void> {
  if (!msgId || !filePath) {
    console.log("Usage: agent_revert_file <message_id> <file_path>");
    return;
  }

  if (!isValidMessageId(msgId)) {
    console.log("Error: Invalid message ID format");
    return;
  }

  const hash = getPatchHash(msgId);
  if (!hash) {
    console.log(`No file changes in message: ${msgId}`);
    return;
  }

  const projectId = _get_project_id_from_message(msgId);
  if (!projectId) {
    console.log("Error: Could not determine project ID for message");
    return;
  }

  const snapshotDir = path.join(snapshotRoot, projectId);
  if (!fs.existsSync(snapshotDir)) {
    console.log(`Error: Snapshot directory not found for project: ${projectId}`);
    return;
  }

  const projectDir = getProjectDirectory(projectId);
  if (!projectDir || !fs.existsSync(projectDir)) {
    console.log("Error: Could not find project directory");
    return;
  }

  if (!gitCatFileExists(snapshotDir, hash)) {
    console.log(`Error: Snapshot does not contain hash: ${hash}`);
    return;
  }

  const filesChanged = runGit([
    "--git-dir",
    snapshotDir,
    "--work-tree",
    projectDir,
    "diff",
    "--name-only",
    hash,
  ]).stdout
    .split(/\r?\n/)
    .filter(Boolean);

  if (!filesChanged.includes(filePath)) {
    console.log(
      `Error: File '${filePath}' was not modified in message ${msgId}`
    );
    return;
  }

  const diffResult = runGit([
    "--git-dir",
    snapshotDir,
    "--work-tree",
    projectDir,
    "diff",
    hash,
    "--",
    filePath,
  ]);

  // Fail fast if the diff command failed or produced no patch.
  if ((diffResult.status ?? 1) !== 0) {
    console.log("Error: Failed to compute diff for file revert.");
    if (diffResult.stderr) {
      process.stderr.write(diffResult.stderr);
    }
    return;
  }

  if (!diffResult.stdout || !diffResult.stdout.trim()) {
    console.log("Error: No changes found to revert for this file.");
    return;
  }
  console.log(`Changes to revert in: ${filePath}`);
  console.log("");
  if (diffResult.stdout) {
    process.stdout.write(diffResult.stdout);
  }
  if (diffResult.stderr) {
    process.stderr.write(diffResult.stderr);
  }
  console.log("");

  const response = await prompt("Revert these changes? (y/N): ");
  if (!["y", "Y"].includes(response)) {
    console.log("Cancelled");
    return;
  }

  const applyResult = spawnSync("git", ["apply", "-R"], {
    encoding: "utf8",
    cwd: projectDir,
    input: diffResult.stdout,
  });

  if ((applyResult.status ?? 1) === 0) {
    console.log(`✓ Successfully reverted changes to ${filePath}`);
    return;
  }

  console.log("✗ Failed to apply reverse patch cleanly");
  console.log("");
  if (applyResult.stderr) {
    process.stderr.write(applyResult.stderr);
  }
  console.log("Try one of these:");
  console.log("  1. Resolve conflicts manually");
  console.log(
    `  2. Use: git --git-dir "${snapshotDir}" --work-tree "${projectDir}" diff "${hash}" -- "${filePath}" | git apply -R --reject`
  );
  console.log("     (Creates .rej files for conflicts)");
}
