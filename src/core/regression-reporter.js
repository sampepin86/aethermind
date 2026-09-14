class RegressionReporter {
  constructor(stateEngine) {
    this.stateEngine = stateEngine;
  }

  generateReport() {
    const state = this.stateEngine.getState();
    const events = state.observabilityLedger || [];
    const nodes = state.nodes || [];
    const assumptions = state.assumptions || [];
    const timeline = state.timeline || [];

    // 1. Which modifications most often cause regressions?
    // A regression is defined as an intervention node followed by a refuted observation or test failure
    const regressions = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      if (nodes[i].type === 'intervention') {
        const next = nodes[i + 1];
        if (next && next.type === 'observation' && next.status === 'refuted') {
          regressions.push({
            interventionId: nodes[i].id,
            interventionTitle: nodes[i].title,
            observationTitle: next.title,
            timestamp: next.timestamp
          });
        }
      }
    }

    // 2. Which assumptions are most often wrong?
    // Assumptions where verification failed (verified === false with proof)
    const falseAssumptions = assumptions.filter(a => a.verified === false && a.proof);
    const unverifiedAssumptions = assumptions.filter(a => !a.verified);
    const verifiedAssumptions = assumptions.filter(a => a.verified);

    // 3. Which files are repeatedly problematic?
    const fileIssueCounts = {};
    events.forEach(e => {
      (e.files || []).forEach(f => {
        if (e.result === 'failed' || e.actionType === 'assumption_failed') {
          fileIssueCounts[f] = (fileIssueCounts[f] || 0) + 1;
        }
      });
    });

    // Also look at timeline events that mention files with failures
    timeline.forEach(t => {
      if (t.actionType && t.actionType.includes('failed') && t.payload?.file) {
        fileIssueCounts[t.payload.file] = (fileIssueCounts[t.payload.file] || 0) + 1;
      }
    });

    const problematicFiles = Object.entries(fileIssueCounts)
      .map(([file, failureCount]) => ({ file, failureCount }))
      .sort((a, b) => b.failureCount - a.failureCount);

    // 4. Which tests catch the most errors?
    const testCatchCounts = {};
    nodes.forEach(n => {
      if (n.type === 'observation' && n.status === 'refuted') {
        const testMatch = n.title.match(/(?:test|spec|suite)[:\s]+([^\s]+)/i);
        const testName = testMatch ? testMatch[1] : (n.metadata?.testSuite || 'Automated Regression Catch');
        testCatchCounts[testName] = (testCatchCounts[testName] || 0) + 1;
      }
    });

    const topDefensiveTests = Object.entries(testCatchCounts)
      .map(([testSuite, catchCount]) => ({ testSuite, catchCount }))
      .sort((a, b) => b.catchCount - a.catchCount);

    const metrics = {
      totalNodes: nodes.length,
      totalAssumptions: assumptions.length,
      verifiedCount: verifiedAssumptions.length,
      unverifiedCount: unverifiedAssumptions.length,
      falseAssumptionsCount: falseAssumptions.length,
      regressionsCount: regressions.length,
      problematicFilesCount: problematicFiles.length
    };

    return {
      generatedAt: new Date().toISOString(),
      sessionId: state.session?.id || 'unknown',
      metrics,
      regressions,
      falseAssumptions: falseAssumptions.map(a => ({
        premise: a.premise,
        category: a.category,
        riskLevel: a.riskLevel,
        proof: a.proof
      })),
      problematicFiles,
      topDefensiveTests
    };
  }

  generateMarkdown() {
    const r = this.generateReport();

    let md = `# 🛡️ AetherMind Observability & Regression Report\n\n`;
    md += `**Session:** \`${r.sessionId}\` | **Generated:** ${r.generatedAt}\n\n`;
    md += `| Total Steps | Verified Assumptions | False Premises | Regressions Caught |\n`;
    md += `|---|---|---|---|\n`;
    md += `| ${r.metrics.totalNodes} | ${r.metrics.verifiedCount} | ${r.metrics.falseAssumptionsCount} | ${r.metrics.regressionsCount} |\n\n`;

    md += `## 1. Modifications That Caused Regressions (${r.regressions.length})\n\n`;
    if (r.regressions.length === 0) {
      md += `*No code intervention caused a detected regression. Clean causal lineage.*\n\n`;
    } else {
      r.regressions.forEach((reg, idx) => {
        md += `### #${idx + 1}: ${reg.interventionTitle}\n`;
        md += `- **Refuting Evidence:** ${reg.observationTitle}\n`;
        md += `- **Timestamp:** ${reg.timestamp}\n\n`;
      });
    }

    md += `## 2. Assumptions Proven False (${r.falseAssumptions.length})\n\n`;
    if (r.falseAssumptions.length === 0) {
      md += `*No verified premises were falsified.*\n\n`;
    } else {
      r.falseAssumptions.forEach(a => {
        md += `- ❌ **${a.premise}** (\`${a.riskLevel} RISK\`, category: *${a.category}*)\n`;
        md += `  - *Empirical Falsification:* ${a.proof}\n`;
      });
      md += `\n`;
    }

    md += `## 3. Repeatedly Problematic Files\n\n`;
    if (r.problematicFiles.length === 0) {
      md += `*No files currently flagged as failure hotspots.*\n\n`;
    } else {
      r.problematicFiles.forEach(f => {
        md += `- 📄 **${f.file}** — ${f.failureCount} failure event(s)\n`;
      });
      md += `\n`;
    }

    md += `## 4. Tests Catching The Most Errors\n\n`;
    if (r.topDefensiveTests.length === 0) {
      md += `*All test suites passing nominally without active failure intercepts.*\n\n`;
    } else {
      r.topDefensiveTests.forEach(t => {
        md += `- 🧪 **${t.testSuite}** — caught ${t.catchCount} regression(s)\n`;
      });
      md += `\n`;
    }

    return md;
  }
}

module.exports = RegressionReporter;
