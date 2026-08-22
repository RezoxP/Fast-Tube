// High-performance zero-dependency method & property extractor for Fast-Tube
// Replaces heavy Esprima/Estraverse AST parser with a microsecond-fast tokenizer

export function extractAssignedFunctions(code) {
    if (!code || typeof code !== 'string') return [];

    const results = [];
    const assignRegex = /this\.([a-zA-Z0-9_$]+)\s*=\s*/g;
    let match;

    while ((match = assignRegex.exec(code)) !== null) {
        const propName = match[1];
        const startIdx = match.index + match[0].length;
        let depthParen = 0;
        let depthBrace = 0;
        let depthBracket = 0;
        let endIdx = startIdx;
        let inString = false;
        let strChar = '';

        for (let i = startIdx; i < code.length; i++) {
            const c = code[i];
            if (inString) {
                if (c === '\\') {
                    i++; // skip escaped char
                    continue;
                }
                if (c === strChar) inString = false;
            } else if (c === '"' || c === "'" || c === '`') {
                inString = true;
                strChar = c;
            } else if (c === '(') {
                depthParen++;
            } else if (c === ')') {
                depthParen--;
            } else if (c === '{') {
                depthBrace++;
            } else if (c === '}') {
                depthBrace--;
            } else if (c === '[') {
                depthBracket++;
            } else if (c === ']') {
                depthBracket--;
            } else if (c === ';' && depthParen <= 0 && depthBrace <= 0 && depthBracket <= 0) {
                endIdx = i;
                break;
            } else if (c === '\n' && depthParen <= 0 && depthBrace <= 0 && depthBracket <= 0) {
                // If followed by next this. assignment or class method
                const remaining = code.slice(i).trim();
                if (/^(?:this\.[a-zA-Z0-9_$]+\s*=|return\b|if\b|[a-zA-Z0-9_$]+\s*\()/.test(remaining)) {
                    endIdx = i;
                    break;
                }
            }
        }

        if (endIdx === startIdx) endIdx = code.length;
        const rhs = code.slice(startIdx, endIdx).trim();

        results.push({
            left: 'this.' + propName,
            rhs: rhs,
            returned: rhs
        });
    }

    return results;
}