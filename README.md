# App Builder - Devcontainer Definition

This repository contains the Devcontainer definition used to create isolated development environments for the website builder.

It defines:
- The base operating system and Node.js version.
- Required VS Code extensions (including `code-server` and `RooVeterinaryInc.roo-cline`).
- Necessary tools and configurations.
- A simple command listener (`command-listener.mjs`) that allows the main application backend to send `cline` commands for execution within the workspace.

This definition is intended to be used by Coder templates (specifically via `envbuilder`) to provision workspaces.