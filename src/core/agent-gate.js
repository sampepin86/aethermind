const path = require('path');
const BlastRadiusAnalyzer = require('./blast-radius');
const RealityProbeMatrix = require('./reality-probe');
const GitObserver = require('./git-observer');
const UserIntentEngine = require('./intent-engine');
const PolicyEngine = require('./policy-engine');

class AgentGate {
  constructor(stateEngine, workspaceDir = process.cwd(), intentEngine = null, policyEngine = null) {
    this.workspaceDir = workspaceDir;
    this.stateEngine = stateEngine;
    this.intentEngine = intentEngine || new UserIntentEngine(workspaceDir);
    this.policyEngine = policyEngine || new PolicyEngine(workspaceDir);
    this.gitObserver = new GitObserver(workspaceDir);
    this.blastAnalyzer = new BlastRadiusAnalyzer(workspaceDir);
    this.checkedBlastFiles = new Set();
  }

  evaluatePreflight({
    targetFiles = [],
    targetSymbols = [],
    scope = null,
    agent = { name: 'agent', model: 'unknown' }
  }) {
    const checks = [];
    const requiredActions = [];
    let allowed = true;
    let status = 'PASSED';

    const normalizedTargets = (Array.isArray(targetFiles) ? targetFiles : [targetFiles]).filter(Boolean);

    // 1. Target Specification Check
    if (normalizedTargets.length === 0) {
      checks.push({
        id: 'target_files_specified',
        name: 'Target Files Declared',
        passed: false,
        severity: 'CRITICAL',
        message: 'No target file(s) specified for modification.'
      });
      requiredActions.push('Specify the exact file(s) you intend to modify before entering gate.');
      allowed = false;
    } else {
      checks.push({
        id: 'target_files_specified',
        name: 'Target Files Declared',
        passed: true,
        severity: 'INFO',
        message: `Target files declared: ${normalizedTargets.join(', ')}`
      });
    }

    // 2. User Intent & Scope Check
    if (scope && scope.length > 0) {
      this.intentEngine.declareIntent({
        scope: Array.isArray(scope) ? scope : [scope],
        agent
      });
    }

    const intentValidation = this.intentEngine.validateChangeSurface(normalizedTargets);
    if (!intentValidation.compliant) {
      checks.push({
        id: 'intent_scope_compliance',
        name: 'Intent Scope Compliance',
        passed: false,
        severity: 'CRITICAL',
        message: intentValidation.violations.map(v => v.message).join(' | ')
      });
      requiredActions.push('Align target files with declared user intent scope or request scope expansion.');
      allowed = false;
    } else {
      checks.push({
        id: 'intent_scope_compliance',
        name: 'Intent Scope Compliance',
        passed: true,
        severity: 'INFO',
        message: intentValidation.declared
          ? `Targets conform to declared intent scope [${intentValidation.scope.join(', ')}]`
          : 'No explicit scope constraint declared (open scope).'
      });
    }

    // 3. Blast Radius Assessment
    const blastResults = [];
    let highestRiskScore = 0;
    let highestRiskLevel = 'LOW';

    for (const target of normalizedTargets) {
      this.checkedBlastFiles.add(target);
      const sym = targetSymbols[0] || null;
      const blast = this.blastAnalyzer.analyze(target, sym);
      blastResults.push(blast);

      if (blast.metrics.riskScore > highestRiskScore) {
        highestRiskScore = blast.metrics.riskScore;
        highestRiskLevel = blast.metrics.riskLevel;
      }
    }

    if (highestRiskLevel === 'CRITICAL') {
      checks.push({
        id: 'blast_radius_safety',
        name: 'Blast Radius Risk Level',
        passed: false,
        severity: 'HIGH',
        message: `Blast radius analysis identified CRITICAL risk (score: ${highestRiskScore}/100). High number of downstream consumers or coupled test suites.`
      });
      requiredActions.push('Inspect direct downstream consumers and test suites prior to making edits.');
      status = 'WARNING';
    } else {
      checks.push({
        id: 'blast_radius_safety',
        name: 'Blast Radius Risk Level',
        passed: true,
        severity: 'INFO',
        message: `Blast risk level: ${highestRiskLevel} (${highestRiskScore}/100)`
      });
    }

    // 4. Unverified High-Risk Assumptions in Epistemic Graph
    const state = this.stateEngine.getState();
    const highRiskUnverified = state.assumptions.filter(
      a => !a.verified && ['HIGH', 'CRITICAL'].includes(a.riskLevel)
    );

    if (highRiskUnverified.length > 0) {
      checks.push({
        id: 'unverified_high_risk_assumptions',
        name: 'Assumption Reality Verification',
        passed: false,
        severity: 'HIGH',
        message: `${highRiskUnverified.length} high-risk assumptions have NOT been empirically verified (e.g. "${highRiskUnverified[0].premise}").`
      });
      requiredActions.push(`Run reality probe to verify premise: "${highRiskUnverified[0].premise}"`);
      if (highRiskUnverified.some(a => a.riskLevel === 'CRITICAL')) {
        allowed = false;
      } else {
        status = 'WARNING';
      }
    } else {
      checks.push({
        id: 'unverified_high_risk_assumptions',
        name: 'Assumption Reality Verification',
        passed: true,
        severity: 'INFO',
        message: 'No critical unverified premises pending in telemetry ledger.'
      });
    }

    // 5. Pre-edit Git Baseline Snapshot
    const snapshot = this.gitObserver.takeSnapshot('preflight_' + Date.now().toString(36));
    checks.push({
      id: 'git_baseline_snapshot',
      name: 'Workspace Baseline Snapshot',
      passed: true,
      severity: 'INFO',
      message: `Captured baseline commit: ${snapshot.head || 'N/A'}, existing modified files: ${snapshot.fileList.length}`
    });

    if (!allowed) {
      status = 'BLOCKED';
    }

    const report = {
      gate: 'PREFLIGHT',
      allowed,
      status,
      timestamp: new Date().toISOString(),
      agent,
      targetFiles: normalizedTargets,
      highestRiskLevel,
      highestRiskScore,
      checks,
      requiredActions,
      blastResults
    };

    this.stateEngine.recordTimelineEvent(
      allowed ? 'gate_preflight_passed' : 'gate_preflight_blocked',
      `Gate Preflight: ${status} for [${normalizedTargets.join(', ')}]`,
      { status, allowed, requiredActionsCount: requiredActions.length }
    );

    return report;
  }

  evaluateEditGate({ file, symbol = null, agent = { name: 'agent', model: 'unknown' } }) {
    if (!file) {
      return {
        gate: 'EDIT_GATE',
        allowed: false,
        reason: 'no_target_file_specified',
        required: ['target_file']
      };
    }

    const relFile = path.isAbsolute(file)
      ? path.relative(this.workspaceDir, file).split(path.sep).join('/')
      : file.split(path.sep).join('/');

    // 1. Check if blast radius scan was conducted on this target
    const isBlastChecked = this.checkedBlastFiles.has(file) || this.checkedBlastFiles.has(relFile);
    if (!isBlastChecked && this.policyEngine.rules.requireBlastCheck) {
      return {
        gate: 'EDIT_GATE',
        allowed: false,
        reason: 'blast_radius_not_checked',
        required: ['blast', 'reality_check'],
        message: `Blast radius analysis has not been performed on '${relFile}'. Pre-edit scan mandatory.`
      };
    }

    // 2. Evaluate Policy Engine
    const blastResult = this.blastAnalyzer.analyze(file, symbol);
    this.checkedBlastFiles.add(file);
    this.checkedBlastFiles.add(relFile);

    const intent = this.intentEngine.getIntent();
    const state = this.stateEngine.getState();
    const policyResult = this.policyEngine.evaluateEditPolicy({
      file: relFile,
      intent,
      blastResult,
      state
    });

    if (!policyResult.allowed) {
      const topViolation = policyResult.violations[0];
      return {
        gate: 'EDIT_GATE',
        allowed: false,
        reason: topViolation.policy,
        severity: topViolation.severity,
        required: topViolation.policy === 'strictScope'
          ? ['request_scope_expansion']
          : (topViolation.policy === 'blockOnCriticalAssumptions' ? ['reality_probe'] : ['policy_override']),
        message: topViolation.message,
        violations: policyResult.violations,
        warnings: policyResult.warnings
      };
    }

    return {
      gate: 'EDIT_GATE',
      allowed: true,
      status: 'ALLOWED',
      file: relFile,
      riskScore: blastResult.metrics.riskScore,
      riskLevel: blastResult.metrics.riskLevel,
      warnings: policyResult.warnings,
      message: `Modification allowed for ${relFile}. Blast risk: ${blastResult.metrics.riskLevel} (${blastResult.metrics.riskScore}/100)`
    };
  }

  evaluateTestGate({ modifiedFiles = [], executedTests = [], agent = { name: 'agent', model: 'unknown' } }) {
    const delta = this.gitObserver.computeDelta();
    const actualModifiedFiles = modifiedFiles.length > 0
      ? modifiedFiles
      : delta.rawFiles.map(f => f.file);

    const coupledTestSuites = new Set();
    for (const file of actualModifiedFiles) {
      const blast = this.blastAnalyzer.analyze(file);
      blast.testSuites.forEach(t => coupledTestSuites.add(t.file));
    }

    const testPolicy = this.policyEngine.evaluateTestPolicy({
      modifiedFiles: actualModifiedFiles,
      coupledTests: Array.from(coupledTestSuites),
      executedTests
    });

    return {
      gate: 'TEST_GATE',
      allowed: testPolicy.allowed,
      passed: testPolicy.passed,
      modifiedFiles: actualModifiedFiles,
      coupledCount: testPolicy.coupledCount,
      executedCount: testPolicy.executedCount,
      missingTests: testPolicy.missingTests,
      status: testPolicy.allowed ? (testPolicy.passed ? 'PASSED' : 'ALLOWED_WITH_WARNINGS') : 'BLOCKED',
      message: testPolicy.passed
        ? `All coupled test suites (${testPolicy.coupledCount}) verified.`
        : `${testPolicy.missingTests.length} coupled test suite(s) require execution: ${testPolicy.missingTests.join(', ')}`
    };
  }

  evaluatePostflight({
    modifiedFiles = [],
    executedTests = [],
    agent = { name: 'agent', model: 'unknown' }
  }) {
    const checks = [];
    const violations = [];
    const recommendations = [];
    let allowed = true;
    let status = 'PASSED';

    // 1. Gather all modified files from Git delta if not provided explicitly
    const delta = this.gitObserver.computeDelta();
    const actualModifiedFiles = modifiedFiles.length > 0
      ? modifiedFiles
      : delta.rawFiles.map(f => f.file);

    // 2. Syntax Validation on all modified files
    const syntaxFailures = [];
    for (const relFile of actualModifiedFiles) {
      const fullPath = path.resolve(this.workspaceDir, relFile);
      const syntaxResult = RealityProbeMatrix.checkSyntax(fullPath);
      if (!syntaxResult.passed) {
        syntaxFailures.push({ file: relFile, error: syntaxResult.message });
      }
    }

    if (syntaxFailures.length > 0) {
      checks.push({
        id: 'ast_syntax_integrity',
        name: 'Code Syntax Validation',
        passed: false,
        severity: 'CRITICAL',
        message: `Syntax validation failed on ${syntaxFailures.length} file(s): ${syntaxFailures.map(s => s.file).join(', ')}`
      });
      violations.push(...syntaxFailures.map(s => `Syntax error in ${s.file}: ${s.error}`));
      allowed = false;
    } else {
      checks.push({
        id: 'ast_syntax_integrity',
        name: 'Code Syntax Validation',
        passed: true,
        severity: 'INFO',
        message: `All ${actualModifiedFiles.length} modified files passed AST syntax checks.`
      });
    }

    // 3. User Intent & Unexpected File Modifications Check
    const intentValidation = this.intentEngine.validateChangeSurface(actualModifiedFiles);
    if (!intentValidation.compliant) {
      checks.push({
        id: 'unexpected_file_modifications',
        name: 'Scope & Unexpected Files Check',
        passed: false,
        severity: 'CRITICAL',
        message: `${intentValidation.violations.length} unexpected file modifications detected outside scope!`
      });
      violations.push(...intentValidation.violations.map(v => v.message));
      allowed = false;
    } else {
      checks.push({
        id: 'unexpected_file_modifications',
        name: 'Scope & Unexpected Files Check',
        passed: true,
        severity: 'INFO',
        message: 'No unexpected file modifications found outside declared scope.'
      });
    }

    // 4. Coupled Test Suite Execution Verification
    const executedNormalized = (executedTests || []).map(t => t.split(path.sep).join('/'));
    const coupledTestSuites = new Set();

    for (const file of actualModifiedFiles) {
      const blast = this.blastAnalyzer.analyze(file);
      blast.testSuites.forEach(t => coupledTestSuites.add(t.file));
    }

    const missingTests = Array.from(coupledTestSuites).filter(
      testFile => !executedNormalized.some(e => e.includes(testFile) || testFile.includes(e))
    );

    if (missingTests.length > 0) {
      checks.push({
        id: 'coupled_test_execution',
        name: 'Coupled Test Suites Verified',
        passed: false,
        severity: 'HIGH',
        message: `${missingTests.length} coupled test suite(s) were NOT run: ${missingTests.join(', ')}`
      });
      recommendations.push(`Execute coupled test suites: npm test -- ${missingTests.join(' ')}`);
      status = 'WARNING';
    } else if (coupledTestSuites.size > 0) {
      checks.push({
        id: 'coupled_test_execution',
        name: 'Coupled Test Suites Verified',
        passed: true,
        severity: 'INFO',
        message: `Coupled test suites executed: ${Array.from(coupledTestSuites).join(', ')}`
      });
    } else {
      checks.push({
        id: 'coupled_test_execution',
        name: 'Coupled Test Suites Verified',
        passed: true,
        severity: 'INFO',
        message: 'No coupled test suites were directly bound to modified files.'
      });
    }

    // 5. Git Diff Statistics
    const diffStat = this.gitObserver.getDiffStat();
    checks.push({
      id: 'diff_statistics',
      name: 'Git Diff Metrics',
      passed: true,
      severity: 'INFO',
      message: `${diffStat.filesChanged} file(s) changed, +${diffStat.insertions} / -${diffStat.deletions} lines`
    });

    if (!allowed) {
      status = 'BLOCKED';
    }

    const report = {
      gate: 'POSTFLIGHT',
      allowed,
      status,
      timestamp: new Date().toISOString(),
      agent,
      actualModifiedFiles,
      diffStat,
      checks,
      violations,
      recommendations
    };

    this.stateEngine.recordTimelineEvent(
      allowed ? 'gate_postflight_passed' : 'gate_postflight_blocked',
      `Gate Postflight: ${status} (${actualModifiedFiles.length} files modified, ${violations.length} violations)`,
      { status, allowed, violationsCount: violations.length }
    );

    return report;
  }
}

module.exports = AgentGate;
