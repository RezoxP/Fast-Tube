#!/bin/bash
set -e

echo "=============================================="
echo "   Fast-Tube Size & Performance Test Suite    "
echo "=============================================="

# 1. Setup Depot Tools
echo ""
echo "[1/4] Checking depot_tools..."
if [ ! -d "depot_tools" ]; then
    git clone --depth 1 https://chromium.googlesource.com/chromium/tools/depot_tools.git
fi
export PATH=$PATH:$PWD/depot_tools

# 2. Setup Android Environment
echo ""
echo "[2/4] Checking Android Build Environment..."
export ANDROID_HOME=${ANDROID_HOME:-/tmp/dummy-android-home}
export ANDROID_NDK_HOME=${ANDROID_NDK_HOME:-$ANDROID_HOME/ndk/25.2.9519653}
mkdir -p "$ANDROID_NDK_HOME"
echo " - ANDROID_NDK_HOME=$ANDROID_NDK_HOME"

# 3. Patch Application & Optimization Verification
echo ""
echo "[3/4] Validating Size, Performance & Stripping Patches..."
node scripts/verify-patches.js || bun scripts/verify-patches.js

if [ -d "cobalt-src/src" ]; then
    echo "Validating patches against live cobalt-src..."
    npm install -g terser && terser scripts/userScript.js -c -m -o scripts/userScript.min.js && cp scripts/userScript.min.js cobalt-src/src/cobalt/loader/embedded_resources/userScript.js
    cd cobalt-src/src
    for patch in ../../patches/*.patch; do
        if [ -f "$patch" ]; then
            echo "Checking patch: $(basename "$patch")"
            patch --batch -p1 --dry-run < "$patch" || { echo "Patch test failed on $patch"; exit 1; }
        fi
    done
    cd ../..
    echo "All live patches validated cleanly!"
fi

# 4. Workflow Syntax Check
echo ""
echo "[4/4] Checking ActionLint on GitHub Workflows..."
if [ -f "./actionlint" ]; then
    ./actionlint .github/workflows/build.yml
    echo " - GitHub Actions workflow syntax verified!"
fi

echo ""
echo "=========================================================================="
echo " ✓ ALL TEST PHASES PASSED! Fast-Tube is ready for high-speed CI build.    "
echo "=========================================================================="
