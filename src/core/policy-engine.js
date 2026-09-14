const path = require('path');

class PolicyEngine {
  constructor(workspaceDir = process.cwd(), rules = {}) {
    this.workspaceDir = workspaceDir;
    this.rules = {
      strictScope: true,               // Only files explicitly in scope can be modified
      requireBlastCheck: true,         // Blast radius scan must occur before edit
      blockOnCriticalAssumptions: true,// Block if any CRITICAL risk assumption is unverified
      requireTestExecution: true,      // Coupled tests must run after edits
      blockDependencyDrift: true,      // package.json / lockfiles blocked unless explicit
      maxBlastRiskThreshold: 75,       // High blast risk triggers warning or requirement
      maxConsecutiveInterventions: 3,  // Thrashing limit
      ...rules
    };
  }

  setRule(key, value) {
    this.rules[key] = value;
  }

  getRules() {
    return { ...this.rules };
  }

  evaluateEditPolicy({ file, intent, blastResult = null, state = null }) {
    const violations = [];
    const warnings = [];

    // 1. Strict Scope Enforcement
    if (this.rules.strictScope && intent && intent.scope && intent.scope.length > 0) {
      const relFile = path.isAbsolute(file)
        ? path.relative(this.workspaceDir, file).split(path.sep).join('/')
        : file.split(path.sep).join('/');

      const inScope = intent.scope.some(s => s === relFile || relFile.startsWith(s + '/'));
      if (!inScope) {
        if (intent.allowedRelatedChanges) {
          warnings.push({
            policy: 'strictScope',
            message: `File '${relFile}' is outside direct scope, but allowedRelatedChanges is enabled.`
          });
        } else {
          violations.push({
            policy: 'strictScope',
            severity: 'CRITICAL',
            file: relFile,
            message: `Scope Violation: Modification of '${relFile}' is forbidden. Declared scope is [${intent.scope.join(', ')}]`
          });
        }
      }
    }

    // 2. Dependency drift policy
    if (this.rules.blockDependencyDrift && intent && !intent.dependenciesAllowed) {
      const isDep = /package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|requirements\.txt|composer\.json/i.test(file);
      if (isDep) {
        violations.push({
          policy: 'blockDependencyDrift',
          severity: 'CRITICAL',
          file,
          message: `Dependency Drift Blocked: Modifying '${file}' is disallowed without explicit permission.`
        });
      }
    }

    // 3. Blast radius threshold
    if (blastResult && blastResult.metrics) {
      if (blastResult.metrics.riskScore > this.rules.maxBlastRiskThreshold) {
        warnings.push({
          policy: 'maxBlastRiskThreshold',
          severity: 'HIGH',
          message: `Blast risk score (${blastResult.metrics.riskScore}/100) exceeds threshold of ${this.rules.maxBlastRiskThreshold}. Coupled tests mandatory.`
        });
      }
    }

    // 4. Critical assumptions policy
    if (this.rules.blockOnCriticalAssumptions && state && Array.isArray(state.assumptions)) {
      const criticalUnverified = state.assumptions.filter(a => !a.verified && a.riskLevel === 'CRITICAL');
      if (criticalUnverified.length > 0) {
        violations.push({
          policy: 'blockOnCriticalAssumptions',
          severity: 'CRITICAL',
          message: `Blocked by Policy: ${criticalUnverified.length} CRITICAL assumption(s) unverified (e.g. "${criticalUnverified[0].premise}").`
        });
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
      warnings,
      evaluatedPolicies: Object.keys(this.rules)
    };
  }

  evaluateTestPolicy({ modifiedFiles = [], coupledTests = [], executedTests = [] }) {
    const missingTests = [];
    const executedSet = new Set((executedTests || []).map(t => t.split(path.sep).join('/')));

    for (const test of coupledTests) {
      const normTest = test.split(path.sep).join('/');
      const wasRun = Array.from(executedSet).some(e => e.includes(normTest) || normTest.includes(e));
      if (!wasRun) {
        missingTests.push(normTest);
      }
    }

    const passed = missingTests.length === 0;

    return {
      passed,
      allowed: !this.rules.requireTestExecution || passed,
      missingTests,
      executedCount: executedTests.length,
      coupledCount: coupledTests.length
    };
  }
}

module.exports = PolicyEngine;
