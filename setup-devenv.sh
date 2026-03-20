#!/usr/bin/env bash
set -euo pipefail

# Setup script for summer development environment using devenv 2.0
# This installs Nix (if needed) and devenv, then enters the dev shell.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}==>${NC} $*"; }
warn()  { echo -e "${YELLOW}==>${NC} $*"; }
error() { echo -e "${RED}==>${NC} $*" >&2; }

# 1. Install Nix if not present
if ! command -v nix &>/dev/null; then
  info "Installing Nix package manager..."
  curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install --no-confirm
  # Source nix in current shell
  if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
    . '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
  fi
  info "Nix installed successfully."
else
  info "Nix is already installed."
fi

# Ensure flakes are enabled
if ! nix --version 2>/dev/null | grep -q "nix"; then
  error "Nix installation failed or is not in PATH."
  error "Try opening a new terminal and running this script again."
  exit 1
fi

# 2. Install cachix (for binary cache) and devenv
if ! command -v devenv &>/dev/null; then
  info "Installing devenv..."
  nix profile install --accept-flake-config github:cachix/devenv/latest
  info "devenv installed successfully."
else
  info "devenv is already installed ($(devenv version))."
fi

# 3. Optionally install direnv for automatic shell activation
if ! command -v direnv &>/dev/null; then
  warn "direnv is not installed. It's recommended for automatic shell activation."
  warn "Install with: nix profile install nixpkgs#direnv"
  warn "Then add 'eval \"\$(direnv hook bash)\"' (or zsh) to your shell rc file."
fi

# 4. Enter the devenv shell
info "Entering devenv shell..."
info "This will install Node.js, npm, SurrealDB, and run npm install."
info "(First run may take a few minutes to download packages.)"
echo ""

cd "$(dirname "$0")"
exec devenv shell
