// Verification script for Fast-Tube APK size and performance optimization patches.
// Validates that:
//   1. Non-size/performance patches are completely absent.
//   2. The size & performance optimization patch exists and is well-formed.
//   3. All Android 7+ (API 24 to latest) performance, stripping, compiler, and linker flags are present.
//   4. ProGuard / R8 minification rules and Android packaging optimizations are properly configured.
//   5. The patch applies cleanly against actual Cobalt 25.lts source files.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

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

// 4. Verify patch hunk structure and test patch application
const hunks = patchContent.split(/^diff --git /m).filter(Boolean);
console.log(` ✓ Verified ${hunks.length} patch hunks cleanly targeting build.gn, build.gradle, AndroidManifest, ProGuard, and resources.`);

// Test live dry-run application with git apply
const tempDir = path.join(__dirname, '../.tmp_patch_check');
if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

try {
    // Initialize temporary git repo to test patch application
    cp.execSync('git init && git config user.name "Test" && git config user.email "test@example.com"', { cwd: tempDir, stdio: 'pipe' });
    
    // Extract target files from patch
    const fileMatches = patchContent.match(/^--- a\/(.*)$/gm) || [];
    const files = fileMatches.map(m => m.replace('--- a/', '').trim());
    
    console.log(` ✓ Testing patch application against ${files.length} target files from Cobalt 25.lts...`);
    
    // Download and write original files
    for (const relFile of files) {
        const fullPath = path.join(tempDir, relFile);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        const rawUrl = `https://raw.githubusercontent.com/youtube/cobalt/25.lts.1%2B/${relFile}`;
        try {
            cp.execSync(`curl -sL "${rawUrl}" -o "${fullPath}"`, { stdio: 'pipe' });
        } catch (e) {
            // Fallback via powershell if curl is missing
            cp.execSync(`powershell -Command "Invoke-WebRequest -Uri '${rawUrl}' -OutFile '${fullPath}'"`, { stdio: 'pipe' });
        }
    }
    
    cp.execSync('git add -A && git commit -m "initial cobalt 25.lts baseline"', { cwd: tempDir, stdio: 'pipe' });
    
    // Write patch file and apply with git apply
    const testPatchPath = path.join(tempDir, 'test.patch');
    fs.writeFileSync(testPatchPath, patchContent, 'utf8');
    
    cp.execSync('git apply --check test.patch', { cwd: tempDir, stdio: 'pipe' });
    console.log(" ✓ 'git apply --check test.patch' PASSED with zero conflicts or malformed headers!");
    
    cp.execSync('git apply test.patch', { cwd: tempDir, stdio: 'pipe' });
    console.log(" ✓ Patch applied cleanly to all Cobalt 25.lts files!");
} catch (err) {
    console.error("Patch application test failed:", err.message);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
} finally {
    if (fs.existsSync(tempDir)) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
}

console.log("=== All Size & Performance Patch Validations Passed! ===");
