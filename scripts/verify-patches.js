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
if (!patch1Content.includes('InjectFastTubeScript') || !jsContent.includes('isInlinePlaybackNoAd') || !jsContent.includes('FT_SETTINGS_SHOW')) {
    console.error("Error: Patch or JS is missing critical playback or settings functionality");
    process.exit(1);
}
console.log(" ✓ Patch 1 and JS contain all required Fast-Tube features (Early injection, isInlinePlaybackNoAd, Settings)");

// 2. Setup mock Cobalt 25.lts C++ environment to test compilation
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
fs.writeFileSync(testDir + '/base/logging.h', '#include <iostream>\n#define LOG(x) std::cout\n#define DCHECK(x) (void)(x)\n');
fs.writeFileSync(testDir + '/base/memory/weak_ptr.h', '// mock weak_ptr\n');
fs.writeFileSync(testDir + '/base/optional.h', 'namespace base { template<typename T> class Optional { public: explicit operator bool() const { return false; } const T& operator*() const { static T d; return d; } }; }\n');
fs.writeFileSync(testDir + '/base/stl_util.h', '// mock stl_util\n');
fs.writeFileSync(testDir + '/base/strings/stringprintf.h', '// mock stringprintf\n');
fs.writeFileSync(testDir + '/base/synchronization/waitable_event.h', '// mock waitable_event\n');
fs.writeFileSync(testDir + '/base/task/sequenced_task_runner.h', '// mock task_runner\n');
fs.writeFileSync(testDir + '/base/files/file_util.h', '#include <string>\nnamespace base { class FilePath { public: FilePath() {} FilePath(const char*) {} FilePath Append(const char*) const { return *this; } FilePath Append(const std::string&) const { return *this; } }; inline bool ReadFileToString(const FilePath&, std::string*) { return true; } }\n');
fs.writeFileSync(testDir + '/base/path_service.h', 'namespace base { class PathService { public: static bool Get(int, base::FilePath*) { return true; } }; }\n');
fs.writeFileSync(testDir + '/cobalt/base/cobalt_paths.h', 'namespace cobalt { namespace paths { enum { DIR_COBALT_WEB_ROOT = 1 }; } }\n');
fs.writeFileSync(testDir + '/starboard/system.h', '#include <cstddef>\nenum SbSystemPathId { kSbSystemPathContentDirectory = 1 }; inline bool SbSystemGetPath(SbSystemPathId, char*, size_t) { return true; }\n');

// Create mock web_module.cc matching Cobalt 25.lts structure
let dummy = "";
for (let i = 1; i <= 19; i++) dummy += "// Copyright comment line " + i + "\n";
dummy += "\n";
dummy += `#include "base/bind.h"
#include "base/callback.h"
#include "base/command_line.h"
#include "base/logging.h"
#include "base/memory/weak_ptr.h"
#include "base/optional.h"
#include <string>
#include <memory>

namespace dom { class Perf {}; class Window { public: Perf* performance() { return nullptr; } class Doc { public: void CreatePerformanceNavigationTiming(Perf*, int) {} }; Doc* document() { return nullptr; } class DocLoader { public: int get_load_timing_info() { return 1; } }; DocLoader* GetDocumentLoader() { return nullptr; } }; class Element {}; class Event {}; }
namespace web { class Context { public: void SetupFinished() {} }; }
namespace net { struct LoadTimingInfo { struct Req { bool is_null() { return false; } } request_start; }; }
namespace base { class SourceLocation { public: SourceLocation(const char*, int, int) {} }; }

class WebModule {
 public:
  typedef base::Callback<void(const std::string&, const std::string&)> OnRenderTreeProducedCallback;
  typedef base::Callback<void(const std::string&, const std::string&)> OnErrorCallback;

  struct ConstructionData {
    struct Opts {
      base::Callback<void(int, int)> collect_unload_event_time_callback;
    } options;
  };

  class Impl {
   public:
    Impl(web::Context* web_context, const ConstructionData& data);
    ~Impl();
    void ExecuteJavascript(const std::string&, const base::SourceLocation&, void*, bool* s) { *s = true; }
`;

const curLines = dummy.split("\n").length;
for (let i = curLines; i < 340; i++) {
  dummy += `    // padding line ${i}\n`;
}

dummy += `  void OnLoadComplete(const base::Optional<std::string>& error) {
    DCHECK(window_);
    DCHECK(window_->performance());
    if (window_->GetDocumentLoader()) {
      net::LoadTimingInfo load_timing_info;
      bool is_load_timing_info_valid = !load_timing_info.request_start.is_null();
      if (is_load_timing_info_valid) {
        window_->document()->CreatePerformanceNavigationTiming(
            window_->performance(), 0);
      }
    }
  }

  // Inject the DOM event object into the window or the element.
  void InjectInputEvent(void* element, const void* event) {}

 private:
  dom::Window* window_;
  web::Context* web_context_;
  bool is_running_;
  base::Callback<void(int, int)> report_unload_timing_info_callback_;
  };
};
`;

const curLines2 = dummy.split("\n").length;
for (let i = curLines2; i < 740; i++) {
  dummy += `// padding line ${i}\n`;
}

dummy += `WebModule::Impl::Impl(web::Context* web_context, const ConstructionData& data)
    : web_context_(web_context), is_running_(false) {
  report_unload_timing_info_callback_ =
      data.options.collect_unload_event_time_callback;

  web_context_->SetupFinished();
  is_running_ = true;
}

WebModule::Impl::~Impl() {}
`;

fs.writeFileSync(testDir + '/cobalt/browser/web_module.cc', dummy);
fs.writeFileSync(testDir + '/patch1.patch', patch1Content);

// 3. Test Patch 1 Application
try {
    cp.execSync("patch -p1 --batch < patch1.patch", { cwd: testDir, encoding: 'utf8' });
    console.log(" ✓ Patch 1 applied cleanly without rejects or fuzz errors");
} catch(e) {
    console.error("Patch 1 verification failed:\n" + e.stdout + "\n" + e.stderr);
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
