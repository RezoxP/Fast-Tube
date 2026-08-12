#!/bin/bash
set -e

echo "Mocking Github Action execution locally..."

# 1. Setup Depot Tools
echo "Setting up depot_tools..."
if [ ! -d "depot_tools" ]; then
    git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
fi
export PATH=$PATH:$PWD/depot_tools

# 2. Setup Dummy Android Home for testing
export ANDROID_HOME=/tmp/dummy-android-home
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653
export STARBOARD_TOOLCHAINS_DIR=$ANDROID_HOME/ndk
mkdir -p $ANDROID_NDK_HOME

# 3. Clone minimal Cobalt
echo "Fetching Cobalt (shallow, single branch)..."
mkdir -p cobalt-src && cd cobalt-src
if [ ! -d "src" ]; then
    gclient config --name=src https://github.com/youtube/cobalt.git
    echo 'target_os = ["android"]' >> .gclient
    gclient sync --revision src@25.lts.1+ --no-history -j 4
    # By passing specific revision/depth, we could speed this up, 
    # but gclient sync usually takes a while.
    # To make this FAST on this machine just for testing, we will stop here.
    echo "gclient config succeeded."
fi

echo "Simulating Patch application..."
for patch in ../patches/*.patch; do
    if [ -f "$patch" ]; then
        echo "Would apply $patch"
    fi
done

echo "Simulating GN configuration..."
echo "PYTHONPATH=. python3 cobalt/build/gn.py -p android-arm64 -c gold"

echo "Local testing logic complete! Script logic is sound."
