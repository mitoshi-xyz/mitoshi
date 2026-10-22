#!/usr/bin/env bash
# Builds the wallet core for the browser (wasm32-wasip1) and copies it next to the TS client.
# Needs: rustup target wasm32-wasip1, Homebrew `llvm` and `wasi-libc` (C toolchain for bundled SQLite).
set -euo pipefail
cd "$(dirname "$0")"
SYSROOT="$(brew --prefix wasi-libc)/share/wasi-sysroot"
export CC_wasm32_wasip1="$(brew --prefix llvm)/bin/clang"
export AR_wasm32_wasip1="$(brew --prefix llvm)/bin/llvm-ar"
export CFLAGS_wasm32_wasip1="--sysroot=${SYSROOT}"
cargo build --release --target wasm32-wasip1
mkdir -p ../generated
cp target/wasm32-wasip1/release/mitoshi_zwallet.wasm ../generated/zwallet.wasm
ls -la ../generated/zwallet.wasm
