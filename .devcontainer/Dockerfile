# Use a standard Microsoft dev container image with Node.js 18 (or choose 20, etc.)
# Check https://mcr.microsoft.com/en-us/product/devcontainers/typescript-node/about for variants
# The VARIANT ARG allows overriding the Node version if needed when building manually,
# but devcontainer.json might specify the full image tag directly.
ARG VARIANT="18-bullseye"
FROM mcr.microsoft.com/devcontainers/typescript-node:${VARIANT}

# Install common dependencies and clean up apt cache
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    curl \
    wget \
    git \
    # Add any other essential OS-level packages here (e.g., build-essential if compiling native modules)
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Optional: Install pnpm globally if you plan to use it
RUN su vscode -c "umask 0002 && . /usr/local/share/nvm/nvm.sh && nvm install-latest-npm && npm install -g pnpm"

# Copy the internal command listener script into a standard location in the image
COPY command-listener.mjs /usr/local/share/command-listener.mjs

# Ensure the script is executable by the container user
RUN chmod +x /usr/local/share/command-listener.mjs && \
    chown vscode:vscode /usr/local/share/command-listener.mjs # Or node:node if that's the user

# [Optional] Add other setup steps, e.g., installing global CLIs needed by your frameworks

# Switch back to the non-root user if you needed root permissions above
# USER vscode