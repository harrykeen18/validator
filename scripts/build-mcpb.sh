#!/bin/bash
set -e

echo "Building MCPB bundle..."

# Clean previous bundle
rm -rf bundle validator.mcpb

# Compile TypeScript
echo "→ Compiling TypeScript..."
npm run build

# Create bundle directory
echo "→ Assembling bundle..."
mkdir -p bundle/server

# Copy compiled server code
cp -r dist/* bundle/server/

# Copy package files and install production deps
cp package.json package-lock.json bundle/
cd bundle
npm ci --omit=dev --ignore-scripts 2>/dev/null
cd ..

# Copy manifest and icon
cp manifest.json bundle/
[ -f icon.png ] && cp icon.png bundle/

# Pack the bundle
echo "→ Packing .mcpb file..."
npx @anthropic-ai/mcpb pack bundle validator.mcpb

echo ""
echo "✓ Built validator.mcpb"
echo "  Install by double-clicking or dragging into Claude Desktop"
