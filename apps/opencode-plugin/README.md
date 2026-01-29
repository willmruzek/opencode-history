# OpenCode Minimal Plugin

This is a minimal OpenCode plugin that logs when it loads and when a session is
created, so you can verify the plugin hook is working.

## Usage

1. Build the plugin:

```bash
npm install
npm run build
```

2. Load the plugin from a local file by copying the built output to your
   plugin directory, or by pointing OpenCode at the compiled file.

Example local plugin location:

```
~/.config/opencode/plugins/minimal-plugin.js
```

The plugin exports a single function:

```ts
export const MinimalPlugin = async ({ project, directory, worktree }) => {
  console.log('OpenCode plugin loaded.');
  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        console.log(`Session created: ${event.sessionId}`);
      }
    },
  };
};
```
