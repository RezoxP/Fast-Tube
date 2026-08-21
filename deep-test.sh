#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends ccache gperf generate-ninja gcc-multilib g++-multilib libc6-dev-i386 python3

if [ ! -d "depot_tools" ]; then
    git clone --depth 1 https://chromium.googlesource.com/chromium/tools/depot_tools.git
fi
export PATH=$PATH:$PWD/depot_tools

if [ ! -d "cobalt-src" ]; then
    mkdir cobalt-src
    cd cobalt-src
    gclient config --name=src https://github.com/youtube/cobalt.git
    gclient sync --revision src@25.lts.1+ --no-history --shallow -j 8
    cd ..
else
    cd cobalt-src
    gclient sync --revision src@25.lts.1+ --no-history --shallow --reset --force -j 8
    cd ..
fi

echo "Building userscript..."
cd scripts/src
npm install
npx rollup -c rollup.config.js
cd ../..




echo "Applying patches..."
cd cobalt-src/src
for patch in ../../patches/*.patch; do
    if [ -f "$patch" ]; then
        echo "Applying $patch..."
        git apply --verbose "$patch" || patch --batch -p1 < "$patch" || { echo "Failed to apply $patch"; exit 1; }
    fi
done

echo "Running GN gen check (without --no-check) to deeply verify dependencies..."
PYTHONPATH=$PWD python3 cobalt/build/gn.py -p android-arm -c gold

echo "Compiling document.cc to verify C++ syntax (including -Werror)..."
ninja -C out/android-arm_gold obj/cobalt/dom/dom/document.o

echo "DEEP TEST PASSED!"
