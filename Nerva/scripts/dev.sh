#!/bin/bash

# Development script for Nerva
# Usage: ./scripts/dev.sh [command]

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
  echo -e "${BLUE}==>${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Commands

cmd_install() {
  print_step "Installing dependencies..."
  
  if command -v pnpm &> /dev/null; then
    pnpm install
  elif command -v npm &> /dev/null; then
    npm install
  else
    echo "Error: Neither pnpm nor npm found"
    exit 1
  fi
  
  print_success "Dependencies installed"
}

cmd_build() {
  print_step "Building TypeScript..."
  
  if command -v pnpm &> /dev/null; then
    pnpm build
  else
    npm run build
  fi
  
  print_success "Build complete"
}

cmd_test() {
  print_step "Running tests..."
  
  if command -v pnpm &> /dev/null; then
    pnpm test
  else
    npm test
  fi
  
  print_success "Tests passed"
}

cmd_lint() {
  print_step "Running linter..."
  
  if command -v pnpm &> /dev/null; then
    pnpm lint
  else
    npm run lint
  fi
  
  print_success "Linting complete"
}

cmd_format() {
  print_step "Formatting code..."
  
  if command -v pnpm &> /dev/null; then
    pnpm format
  else
    npm run format
  fi
  
  print_success "Formatting complete"
}

cmd_watch() {
  print_step "Starting watch mode..."
  
  if command -v pnpm &> /dev/null; then
    pnpm watch
  else
    npm run watch
  fi
}

cmd_clean() {
  print_step "Cleaning build artifacts..."
  
  rm -rf dist/
  rm -rf build/
  rm -rf node_modules/.cache/
  find . -name "*.tsbuildinfo" -delete
  
  print_success "Clean complete"
}

cmd_help() {
  echo "Nerva Development Script"
  echo ""
  echo "Usage: ./scripts/dev.sh [command]"
  echo ""
  echo "Commands:"
  echo "  install   Install dependencies"
  echo "  build     Build TypeScript"
  echo "  test      Run tests"
  echo "  lint      Run linter"
  echo "  format    Format code"
  echo "  watch     Start watch mode"
  echo "  clean     Clean build artifacts"
  echo "  help      Show this help"
}

# Main

COMMAND=${1:-help}

case $COMMAND in
  install)
    cmd_install
    ;;
  build)
    cmd_build
    ;;
  test)
    cmd_test
    ;;
  lint)
    cmd_lint
    ;;
  format)
    cmd_format
    ;;
  watch)
    cmd_watch
    ;;
  clean)
    cmd_clean
    ;;
  help)
    cmd_help
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo "Run './scripts/dev.sh help' for usage"
    exit 1
    ;;
esac

