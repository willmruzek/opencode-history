interface PluginContext {
  project?: { name?: string };
  directory: string;
  worktree: string;
}

interface EventPayload {
  event: {
    type: string;
    sessionId?: string;
  };
}

export const MinimalPlugin = async ({
  project,
  directory,
  worktree,
}: PluginContext) => {
  console.log('OpenCode plugin loaded.');
  console.log(`Project: ${project?.name ?? 'unknown'}`);
  console.log(`Directory: ${directory}`);
  console.log(`Worktree: ${worktree}`);

  return {
    event: async ({ event }: EventPayload) => {
      if (event.type === 'session.created') {
        console.log(`Session created: ${event.sessionId}`);
      }
    },
  };
};
