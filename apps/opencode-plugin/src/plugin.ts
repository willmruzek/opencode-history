export const MinimalPlugin = async ({ project, directory, worktree }) => {
  console.log('OpenCode plugin loaded.');
  console.log(`Project: ${project?.name ?? 'unknown'}`);
  console.log(`Directory: ${directory}`);
  console.log(`Worktree: ${worktree}`);

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        console.log(`Session created: ${event.sessionId}`);
      }
    },
  };
};
