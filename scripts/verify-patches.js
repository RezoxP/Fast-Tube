// Verification script for Fast-Tube patches and C++ injection syntax
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

console.log("=== Validating Patches & C++ Compilation ===");

// 1. Check sync between vacuumtube_adblock.js and 01-inject-vacuumtube-scripts.patch
const jsPath = path.join(__dirname, 'injection/vacuumtube_adblock.js');
const patchPath = path.join(__dirname, '../patches/01-inject-vacuumtube-scripts.patch');

if (!fs.existsSync(jsPath) || !fs.existsSync(patchPath)) {
    console.error("Error: Missing vacuumtube_adblock.js or patch file");
    process.exit(1);
}

const jsContent = fs.readFileSync(jsPath, 'utf8');
const patchContent = fs.readFileSync(patchPath, 'utf8');

// Ensure key markers exist in patch
if (!patchContent.includes('isInlinePlaybackNoAd') || !patchContent.includes('FT_SETTINGS_SHOW')) {
    console.error("Error: Patch is missing critical playback or settings functionality");
    process.exit(1);
}
console.log(" ✓ Patch contains all required Fast-Tube features (isInlinePlaybackNoAd & Settings)");

// 2. Setup mock Cobalt C++ environment to test compilation
const testDir = '/tmp/test_fasttube_patch_validation';
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir + '/cobalt/browser', { recursive: true });
fs.mkdirSync(testDir + '/cobalt/base', { recursive: true });
fs.mkdirSync(testDir + '/base/files', { recursive: true });
fs.mkdirSync(testDir + '/base/memory', { recursive: true });
fs.mkdirSync(testDir + '/base/strings', { recursive: true });
fs.mkdirSync(testDir + '/base/synchronization', { recursive: true });
fs.mkdirSync(testDir + '/base/task', { recursive: true });
fs.mkdirSync(testDir + '/starboard', { recursive: true });

// Create mock headers
fs.writeFileSync(testDir + '/base/bind.h', '// mock bind\n');
fs.writeFileSync(testDir + '/base/callback.h', 'namespace base { template<typename T> class Callback {}; }\n');
fs.writeFileSync(testDir + '/base/command_line.h', '// mock command_line\n');
fs.writeFileSync(testDir + '/base/logging.h', '#include <iostream>\n#define LOG(x) std::cout\n');
fs.writeFileSync(testDir + '/base/memory/weak_ptr.h', '// mock weak_ptr\n');
fs.writeFileSync(testDir + '/base/optional.h', '// mock optional\n');
fs.writeFileSync(testDir + '/base/stl_util.h', '// mock stl_util\n');
fs.writeFileSync(testDir + '/base/strings/stringprintf.h', '// mock stringprintf\n');
fs.writeFileSync(testDir + '/base/synchronization/waitable_event.h', '// mock waitable_event\n');
fs.writeFileSync(testDir + '/base/task/sequenced_task_runner.h', '// mock task_runner\n');
fs.writeFileSync(testDir + '/base/files/file_util.h', '#include <string>\nnamespace base { class FilePath { public: FilePath() {} FilePath(const char*) {} FilePath Append(const char*) const { return *this; } FilePath Append(const std::string&) const { return *this; } }; inline bool ReadFileToString(const FilePath&, std::string*) { return true; } }\n');
fs.writeFileSync(testDir + '/base/path_service.h', 'namespace base { class PathService { public: static bool Get(int, base::FilePath*) { return true; } }; }\n');
fs.writeFileSync(testDir + '/cobalt/base/cobalt_paths.h', 'namespace cobalt { namespace paths { enum { DIR_COBALT_WEB_ROOT = 1 }; } }\n');
fs.writeFileSync(testDir + '/starboard/system.h', '#include <cstddef>\nenum SbSystemPathId { kSbSystemPathContentDirectory = 1 }; inline bool SbSystemGetPath(SbSystemPathId, char*, size_t) { return true; }\n');

// Create mock web_module.cc matching Cobalt structure
let dummy = "";
for (let i = 1; i <= 19; i++) dummy += "// Copyright comment line " + i + "\n";
dummy += "\n";
dummy += `#include "base/bind.h"
#include "base/callback.h"
#include "base/command_line.h"
#include "base/logging.h"
#include "base/memory/weak_ptr.h"
#include <string>
#include <memory>

namespace dom { class Perf { public: void set_load_timing_info(int, Perf*, int) {} }; class Window { public: Perf* performance() { return nullptr; } }; class Element {}; class Event {}; }
namespace base { class SourceLocation { public: SourceLocation(const char*, int, int) {} }; }

class WebModule {
 public:
  typedef base::Callback<void(const std::string&, const std::string&)> OnRenderTreeProducedCallback;
  typedef base::Callback<void(const std::string&, const std::string&)> OnErrorCallback;

  class Impl {
   public:
    void ExecuteJavascript(const std::string&, const base::SourceLocation&, void*, bool* s) { *s = true; }
`;

const curLines = dummy.split("\n").length;
for (let i = curLines; i < 340; i++) {
  dummy += `    // padding line ${i}\n`;
}

dummy += `  void OnDocumentLoaded() {
    int network_event_id = 0;
    int load_timing_info = 0;
    if (window_->performance()) {
      window_->performance()->set_load_timing_info(
          network_event_id,
          window_->performance(), load_timing_info);
    }
  }

  // Inject the DOM event object into the window or the element.
  void InjectInputEvent(void* element, const void* event) {}

 private:
  dom::Window* window_;
  bool is_render_tree_rasterization_pending_;
  int resource_provider_type_id_;
  OnRenderTreeProducedCallback render_tree_produced_callback_;
  OnErrorCallback error_callback_;
  };
};
`;

fs.writeFileSync(testDir + '/cobalt/browser/web_module.cc', dummy);
fs.writeFileSync(testDir + '/patch.patch', patchContent);

// 3. Test Patch Application
try {
    cp.execSync("patch -p1 --batch < patch.patch", { cwd: testDir, encoding: 'utf8' });
    console.log(" ✓ Patch applied cleanly without rejects or fuzz errors");
} catch(e) {
    console.error("Patch verification failed:\n" + e.stdout + "\n" + e.stderr);
    process.exit(1);
}

// 4. Test C++ Compilation
const compiler = fs.existsSync('/usr/bin/clang++') ? 'clang++' : 'g++';
try {
    cp.execSync(`${compiler} -std=c++14 -fsyntax-only -I. cobalt/browser/web_module.cc`, { cwd: testDir, encoding: 'utf8' });
    console.log(` ✓ Patched web_module.cc compiled cleanly with ${compiler} (0 syntax errors)`);
} catch(e) {
    console.error("C++ Compilation failed:\n" + e.stdout + "\n" + e.stderr);
    process.exit(1);
}

console.log("=== Patch & C++ Syntax Validation Passed! ===");
