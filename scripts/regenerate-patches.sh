#!/bin/bash
set -e

echo "=========================================="
echo "  Fast-Tube Reliable Patch Generator"
echo "=========================================="

if [ ! -d "cobalt-src/src" ]; then
    echo "[!] Error: cobalt-src/src not found."
    echo "[i] Please run ./deep-test.sh first so the Cobalt source is downloaded."
    exit 1
fi

cd cobalt-src/src

echo "[1/3] Resetting Cobalt source tree to pristine state..."
git reset --hard HEAD > /dev/null
git clean -fd > /dev/null

echo "[2/3] Applying existing patches for editing..."
for patch in ../../patches/*.patch; do
    if [ -f "$patch" ]; then
        git apply "$patch"
    fi
done

echo ""
echo "✅ Environment Ready!"
echo "------------------------------------------------"
echo "You (or the AI) can now safely edit the C++ files inside 'cobalt-src/src'."
echo "When you are completely finished with your edits, press [ENTER] here."
echo "------------------------------------------------"
read -p "Press ENTER to generate the new perfectly-formatted patch..."

echo "[3/3] Generating clean, perfectly-formatted patch file..."
# Assuming most active feature development goes into 02-tizentube-features.patch
# We exclude the optimize patch changes if possible, or just bundle them. 
# For safety, we just regenerate the 02 patch based on the diff.
git diff > ../../patches/02-tizentube-features.patch

echo "🎉 Success! patches/02-tizentube-features.patch has been regenerated with exact line numbers and headers."
echo "You can now safely commit the updated patch to git."
