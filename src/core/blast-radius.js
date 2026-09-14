const fs = require('fs');
const path = require('path');

class BlastRadiusAnalyzer {
  constructor(workspaceDir = process.cwd()) {
    this.workspaceDir = workspaceDir;
  }

  // Scan workspace for code files (excluding node_modules, .git, dist, etc.)
  collectWorkspaceFiles(dir = this.workspaceDir, fileList = []) {
    const ignored = new Set(['node_modules', '.git', '.aethermind', 'dist', 'build', '.DS_Store', 'vendor', '.next', 'archive', 'coverage', 'logs', 'storage']);
    if (!fs.existsSync(dir)) return fileList;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.collectWorkspaceFiles(fullPath, fileList);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.py', '.json', '.html', '.php'].includes(ext)) {
          fileList.push(fullPath);
        }
      }
    }
    return fileList;
  }

  extractExports(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const exportsList = new Set();

    // JS/TS exports
    const exportMatches = [
      ...content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([a-zA-Z0-9_$]+)/g),
      ...content.matchAll(/module\.exports\s*=\s*{\s*([^}]+)\s*}/g),
      ...content.matchAll(/exports\.([a-zA-Z0-9_$]+)\s*=/g),
      ...content.matchAll(/function\s+([a-zA-Z0-9_$]+)\s*\(/g)
    ];

    for (const m of exportMatches) {
      if (m[1]) {
        // if multiple comma separated in module.exports = { a, b, c }
        if (m[1].includes(',')) {
          m[1].split(',').forEach(item => {
            const clean = item.trim().split(':')[0].trim();
            if (clean && /^[a-zA-Z0-9_$]+$/.test(clean)) exportsList.add(clean);
          });
        } else {
          exportsList.add(m[1].trim());
        }
      }
    }

    // Python & PHP def/class/function
    if (filePath.endsWith('.py')) {
      const pyMatches = [
        ...content.matchAll(/def\s+([a-zA-Z0-9_]+)\s*\(/g),
        ...content.matchAll(/class\s+([a-zA-Z0-9_]+)\s*[:\(]/g)
      ];
      for (const pm of pyMatches) {
        if (pm[1]) exportsList.add(pm[1]);
      }
    } else if (filePath.endsWith('.php')) {
      const phpMatches = [
        ...content.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(/g),
        ...content.matchAll(/class\s+([a-zA-Z0-9_]+)\s*[{]/g)
      ];
      for (const pm of phpMatches) {
        if (pm[1]) exportsList.add(pm[1]);
      }
    }

    return Array.from(exportsList);
  }

  detectDynamicCaveats(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const caveats = [];

    if (/import\s*\(/g.test(content)) {
      caveats.push({
        type: 'DYNAMIC_IMPORT',
        message: 'Dynamic import() detected. Runtime-resolved dependencies may not be fully mapped statically.'
      });
    }

    if (/require\s*\(\s*[^'"\s\)]+\s*\)/g.test(content)) {
      caveats.push({
        type: 'DYNAMIC_REQUIRE',
        message: 'Dynamic require(variable) expression detected. Target cannot be resolved statically.'
      });
    }

    if (/\b(?:emit|dispatchEvent|trigger)\s*\(/g.test(content)) {
      caveats.push({
        type: 'EVENT_DISPATCH',
        message: 'Event emission patterns detected. Subscribers in decoupled modules may be indirectly impacted.'
      });
    }

    if (/\b(?:eval|Function)\s*\(/g.test(content)) {
      caveats.push({
        type: 'EVAL_EXECUTION',
        message: 'Dynamic code execution (eval / Function) detected.'
      });
    }

    if (/\[\s*[a-zA-Z0-9_$]+\s*\]\s*\(/g.test(content)) {
      caveats.push({
        type: 'DYNAMIC_DISPATCH',
        message: 'Dynamic method invocation obj[key]() detected.'
      });
    }

    return caveats;
  }

  analyze(targetFile, targetSymbol = null) {
    const absTarget = path.resolve(this.workspaceDir, targetFile);
    const relTarget = path.relative(this.workspaceDir, absTarget).split(path.sep).join('/');
    const targetBase = path.basename(absTarget, path.extname(absTarget));
    const targetExt = path.extname(absTarget).toLowerCase();
    
    const allFiles = this.collectWorkspaceFiles();
    const directConsumers = [];
    const testSuites = [];
    const targetExports = this.extractExports(absTarget);
    const targetCaveats = this.detectDynamicCaveats(absTarget);
    const globalCaveats = [...targetCaveats];

    // Check a file to see if it imports absTarget directly
    const checksImport = (file, content) => {
      const dir = path.dirname(file);
      const importMatches = [
        ...content.matchAll(/(?:from|require(?:_once)?\s*\(?|include(?:_once)?\s*\(?|import)\s*['"]([^'"]+)['"]/g),
        ...content.matchAll(/export\s+(?:\*|\{[^}]+\})\s+from\s*['"]([^'"]+)['"]/g)
      ];

      for (const m of importMatches) {
        const specifier = m[1];
        if (!specifier) continue;

        if (specifier.startsWith('.')) {
          const resolved = path.resolve(dir, specifier);
          // Check exact match or match with common extensions
          if (resolved === absTarget ||
              resolved + targetExt === absTarget ||
              resolved + '.js' === absTarget ||
              resolved + '.ts' === absTarget ||
              resolved + '.jsx' === absTarget ||
              resolved + '.tsx' === absTarget ||
              resolved + '.mjs' === absTarget ||
              path.join(resolved, 'index' + targetExt) === absTarget ||
              path.join(resolved, 'index.js') === absTarget) {
            return true;
          }
        } else {
          // Monorepo or root-relative package import
          if (specifier === relTarget || specifier.endsWith('/' + targetBase) || specifier === targetBase) {
            return true;
          }
        }
      }

      // Python / PHP fallback
      if (file.endsWith('.py')) {
        const pyRegex = new RegExp(`(?:from\\s+.*${targetBase}\\s+import|import\\s+.*${targetBase})`, 'i');
        if (pyRegex.test(content)) return true;
      }
      return false;
    };

    for (const file of allFiles) {
      if (path.resolve(file) === absTarget) continue;
      const relPath = path.relative(this.workspaceDir, file).split(path.sep).join('/');
      let content = '';
      try {
        content = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }

      const hasFileImport = checksImport(file, content);

      // Check for symbol reference if specified
      let hasSymbolRef = false;
      if (targetSymbol) {
        const symRegex = new RegExp(`\\b${targetSymbol}\\b`);
        hasSymbolRef = symRegex.test(content);
      }

      if (hasFileImport || (targetSymbol && hasSymbolRef)) {
        const isTest = /test|spec|__test__/i.test(relPath);
        const matchData = {
          file: relPath,
          isTest,
          matchedImport: hasFileImport,
          matchedSymbol: hasSymbolRef,
          symbolsFound: targetExports.filter(sym => new RegExp(`\\b${sym}\\b`).test(content))
        };

        if (isTest) {
          testSuites.push(matchData);
        } else {
          directConsumers.push(matchData);
        }
      }
    }

    // Transitive (indirect) consumers
    const indirectConsumers = [];
    const directSet = new Set(directConsumers.map(c => path.resolve(this.workspaceDir, c.file)));
    const visitedTransitive = new Set([...directSet, absTarget]);

    for (const direct of directConsumers) {
      const directAbs = path.resolve(this.workspaceDir, direct.file);
      const directBase = path.basename(directAbs, path.extname(directAbs));
      for (const candidate of allFiles) {
        const candAbs = path.resolve(candidate);
        if (visitedTransitive.has(candAbs)) continue;
        let candContent = '';
        try {
          candContent = fs.readFileSync(candidate, 'utf8');
        } catch {
          continue;
        }

        const importsDirect = candContent.includes(directBase);
        if (importsDirect) {
          visitedTransitive.add(candAbs);
          const relCand = path.relative(this.workspaceDir, candidate).split(path.sep).join('/');
          indirectConsumers.push({
            file: relCand,
            isTest: /test|spec|__test__/i.test(relCand),
            via: direct.file
          });
        }
      }
    }

    // Calculate risk score based on blast coverage
    const totalWorkspaceCodeFiles = Math.max(1, allFiles.length);
    const affectedRatio = (directConsumers.length + testSuites.length + indirectConsumers.length * 0.5) / totalWorkspaceCodeFiles;
    let riskScore = Math.min(100, Math.round(affectedRatio * 150) + (directConsumers.length * 12) + (indirectConsumers.length * 6));
    if (directConsumers.length === 0 && testSuites.length === 0) riskScore = 0;

    let riskLevel = 'LOW';
    if (riskScore > 65) riskLevel = 'CRITICAL';
    else if (riskScore > 40) riskLevel = 'HIGH';
    else if (riskScore > 20) riskLevel = 'MEDIUM';

    // Static confidence rating
    let confidenceScore = 95;
    if (globalCaveats.length > 0) {
      confidenceScore = Math.max(50, 95 - globalCaveats.length * 15);
    }

    return {
      target: {
        file: relTarget,
        exists: fs.existsSync(absTarget),
        symbol: targetSymbol || null,
        detectedExports: targetExports
      },
      metrics: {
        riskScore,
        riskLevel,
        confidenceScore,
        directConsumersCount: directConsumers.length,
        indirectConsumersCount: indirectConsumers.length,
        testSuitesCount: testSuites.length,
        totalWorkspaceFilesScanned: allFiles.length
      },
      caveats: globalCaveats,
      directConsumers,
      indirectConsumers,
      testSuites,
      recommendedVerificationCommands: [
        testSuites.length > 0
          ? `npm test -- ${testSuites.map(t => t.file).join(' ')}`
          : `node --check ${relTarget}`,
        `git diff --stat ${relTarget}`
      ]
    };
  }
}

module.exports = BlastRadiusAnalyzer;
