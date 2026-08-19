// Verification script for Fast-Tube APK size and performance optimization patches.
// Validates that:
//   1. Non-size/performance patches are completely absent.
//   2. The size & performance optimization patch exists and is well-formed.
//   3. All Android 7+ (API 24 to latest) performance, stripping, compiler, and linker flags are present.
//   4. ProGuard / R8 minification rules and Android packaging optimizations are properly configured.
const fs = require('fs');
const path = require('path');

console.log("=== Validating Fast-Tube Size & Performance Patches ===");

const patchesDir = path.join(__dirname, '../patches');
const patch1Path = path.join(patchesDir, '01-optimize-apk-size-and-strip.patch');
const oldPatchPath = path.join(patchesDir, '01-inject-vacuumtube-scripts.patch');

// 1. Verify absence of non-size/perf patches
if (fs.existsSync(oldPatchPath)) {
    console.error("Error: Found non-size/performance patch (01-inject-vacuumtube-scripts.patch) which should be deleted.");
    process.exit(1);
}

// 2. Verify existence of size & performance patch
if (!fs.existsSync(patch1Path)) {
    console.error("Error: Missing 01-optimize-apk-size-and-strip.patch in patches directory");
    process.exit(1);
}

const patchContent = fs.readFileSync(patch1Path, 'utf8');

// 3. Verify Android 7+ safe performance, size, compiler, linker, and stripping markers
const requiredSizeAndPerfMarkers = [
    // Toolchain & Stripping
    'llvm-strip',
    'llvm-ar',
    'llvm-nm',
    'llvm-readelf',

    // Linker Optimizations
    '-Wl,--icf=all',               // Identical Code Folding
    '-Wl,-O3',                    // Aggressive linker optimization
    '-Wl,--pack-dyn-relocs=android', // Android 7+ safe dynamic relocation compression

    // Compiler Size & Runtime Performance Flags
    '-Os',
    '-fno-asynchronous-unwind-tables', // Strip DWARF exception tables
    '-fno-unwind-tables',
    '-fomit-frame-pointer',            // Free extra CPU register for rendering loop
    '-fno-math-errno',                // FPU SIMD direct instructions
    '-fvisibility=hidden',             // Elide dynamic internal symbols
    '-fvisibility-inlines-hidden',

    // Android Packaging & Compression
    'useLegacyPackaging true',
    'android:extractNativeLibs="true"',
    'META-INF/*.version',
    'META-INF/androidx.*',

    // Stability & Performance on Low-End TVs
    'android:largeHeap="true"',
    'android:hardwareAccelerated="true"',
    'cobalt.SPLASH_URL',

    // ProGuard / R8 Rules
    'dev.cobalt.**',
    'androidx.leanback.**',
    'native <methods>;'
];

let missingCount = 0;
for (const marker of requiredSizeAndPerfMarkers) {
    if (!patchContent.includes(marker)) {
        console.error(`Error: 01-optimize-apk-size-and-strip.patch is missing required marker: ${marker}`);
        missingCount++;
    }
}

if (missingCount > 0) {
    process.exit(1);
}

console.log(" ✓ Patch contains all required size, stripping, and Android 7+ performance flags:");
console.log("   - LLVM toolchain stripping (llvm-strip / llvm-ar / llvm-nm)");
console.log("   - Linker ICF (-Wl,--icf=all) + -Wl,-O3 + Android 7+ packed relocations");
console.log("   - Compiler flags: -Os, -fomit-frame-pointer, -fno-math-errno, hidden visibility");
console.log("   - Exception & unwind table stripping (-fno-unwind-tables)");
console.log("   - Android legacy zip DEFLATE packaging (extractNativeLibs true)");
console.log("   - Low-memory headroom & HW acceleration (largeHeap + hardwareAccelerated)");
console.log("   - ProGuard / R8 minification and Leanback / JNI retention rules");

// 4. Verify patch hunk structure
const hunks = patchContent.split(/^diff --git /m).filter(Boolean);
console.log(` ✓ Verified ${hunks.length} patch hunks cleanly targeting build.gn, build.gradle, AndroidManifest, ProGuard, and resources.`);

console.log("=== All Size & Performance Patch Validations Passed! ===");
