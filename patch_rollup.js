const fs = require('fs');
const content = fs.readFileSync('/workspaces/Fast-Tube/scripts/src/rollup.config.js', 'utf8');
const newContent = content.replace(
    'output: { file: "../userScript.js", format: "iife" },',
    `output: [
        { file: "../userScript.js", format: "iife" },
        { file: "../userScript.min.js", format: "iife", plugins: [terser({ format: { ecma: 2020 }, compress: true, mangle: true })] }
    ],`
);
fs.writeFileSync('/workspaces/Fast-Tube/scripts/src/rollup.config.js', newContent);
