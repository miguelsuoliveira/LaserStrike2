#!/bin/sh
# For a Mac or Linux computer with no Node.js (or one that is too old). The AI runs this, never the kids:
#   sh scripts/bootstrap.sh
# It puts Node.js 22 inside this project (.tools/node: no password or admin rights needed, nothing else on
# the computer changes) and then runs the normal setup (scripts/setup.mjs) with the same options.
# With a good Node.js already on the computer it only runs the setup.
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)
TOOLS="$ROOT/.tools"

good_node() {
  command -v node >/dev/null 2>&1 || return 1
  command -v npm >/dev/null 2>&1 || return 1
  [ "$(node -p 'Number(process.versions.node.split(".")[0]) >= 20' 2>/dev/null)" = "true" ]
}

fetch() { # fetch <url> [file]: to a file, or to the screen
  if command -v curl >/dev/null 2>&1; then
    if [ -n "$2" ]; then curl -fsSL "$1" -o "$2"; else curl -fsSL "$1"; fi
  elif command -v wget >/dev/null 2>&1; then
    if [ -n "$2" ]; then wget -q "$1" -O "$2"; else wget -q "$1" -O -; fi
  else
    echo "This computer has neither curl nor wget. NEXT, for the AI: ask a mentor to install Node.js 22 (nodejs.org)."
    exit 1
  fi
}

# The computer's own Node.js if it is good; else the one this script put into the project earlier.
if ! good_node && [ -x "$TOOLS/node/bin/node" ]; then
  PATH="$TOOLS/node/bin:$PATH"
  export PATH
fi

if ! good_node; then
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) echo "Unknown system $(uname -s). NEXT, for the AI: on Windows run scripts\\bootstrap.ps1 with PowerShell; otherwise ask a mentor to install Node.js 22."; exit 1 ;;
  esac
  case "$(uname -m)" in
    arm64 | aarch64) arch=arm64 ;;
    x86_64 | amd64) arch=x64 ;;
    *) echo "Unknown processor $(uname -m). NEXT, for the AI: ask a mentor to install Node.js 22 (nodejs.org)."; exit 1 ;;
  esac
  base=https://nodejs.org/dist/latest-v22.x
  echo "No usable Node.js on this computer: getting Node.js 22 into this project (about 30 MB, needs the internet)..."
  sums=$(fetch "$base/SHASUMS256.txt") || { echo "Could not reach nodejs.org. NEXT, for the AI: tell the team in one sentence to ask a mentor to check the internet."; exit 1; }
  line=$(printf '%s\n' "$sums" | grep "node-v[0-9.]*-$os-$arch\.tar\.gz\$" | head -1)
  want=${line%% *}
  file=${line##* }
  [ -n "$file" ] || { echo "No Node.js download for $os $arch. NEXT, for the AI: ask a mentor to install Node.js 22 (nodejs.org)."; exit 1; }
  mkdir -p "$TOOLS"
  fetch "$base/$file" "$TOOLS/$file"
  if command -v shasum >/dev/null 2>&1; then got=$(shasum -a 256 "$TOOLS/$file"); else got=$(sha256sum "$TOOLS/$file"); fi
  got=${got%% *}
  if [ "$got" != "$want" ]; then
    rm -f "$TOOLS/$file"
    echo "The Node.js download is damaged (wrong checksum). NEXT, for the AI: run this once more; if it fails again, ask a mentor."
    exit 1
  fi
  rm -rf "$TOOLS/node" "$TOOLS/node-unpack"
  mkdir -p "$TOOLS/node-unpack"
  tar -xzf "$TOOLS/$file" -C "$TOOLS/node-unpack"
  mv "$TOOLS/node-unpack"/node-v* "$TOOLS/node"
  rm -rf "$TOOLS/node-unpack" "$TOOLS/$file"
  PATH="$TOOLS/node/bin:$PATH"
  export PATH
  good_node || { echo "The downloaded Node.js does not run here. NEXT, for the AI: ask a mentor to install Node.js 22 (nodejs.org)."; exit 1; }
  echo "Node.js $(node -v) is ready inside this project."
fi

exec node scripts/setup.mjs "$@"
