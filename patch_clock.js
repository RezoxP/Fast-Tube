const fs = require('fs');
const path = '/workspaces/Fast-Tube/scripts/src/ui/clock.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('let actualClock;', 'let actualClock;\nlet clockInterval;');

content = content.replace(
    'existingClock.remove();\n        return;',
    'existingClock.remove();\n        if (clockInterval) clearInterval(clockInterval);\n        return;'
);

content = content.replace(
    'setInterval(updateClock, 1000);',
    'if (clockInterval) clearInterval(clockInterval);\n        clockInterval = setInterval(updateClock, 1000);'
);

fs.writeFileSync(path, content);
