#!/bin/bash
# Install git
apt-get update && apt-get install -y git

# Your build commands
bun run build
