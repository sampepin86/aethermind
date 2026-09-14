const path = require('path');

class UserIntentEngine {
  constructor(workspaceDir = process.cwd()) {
    this.workspaceDir = workspaceDir;
    this.currentIntent = null;
  }

  declareIntent({
    requestId = 'req_' + Date.now().toString(36),
    prompt = '',
    scope = [], // array of relative or absolute file paths
    allowedRelatedChanges = false,
    testsAllowed = true,
    dependenciesAllowed = false,
    maxFilesAllowed = 5,
    agent = { name: 'agent', model: 'unknown' }
  }) {
    const normalizedScope = (scope || []).map(f => this.normalizePath(f));

    this.currentIntent = {
      requestId,
      prompt,
      scope: normalizedScope,
      allowedRelatedChanges,
      testsAllowed,
      dependenciesAllowed,
      maxFilesAllowed,
      agent,
      declaredAt: new Date().toISOString()
    };

    return this.currentIntent;
  }

  getIntent() {
    return this.currentIntent;
  }

  normalizePath(filePath) {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.workspaceDir, filePath);
    return path.relative(this.workspaceDir, abs).split(path.sep).join('/');
  }

  validateChangeSurface(modifiedFiles = []) {
    if (!this.currentIntent) {
      return {
        compliant: true,
        declared: false,
        violations: [],
        warnings: ['No user intent declared. All changes permitted by default.']
      };
    }

    const violations = [];
    const warnings = [];
    const normalizedModified = modifiedFiles.map(f => this.normalizePath(f));

    for (const file of normalizedModified) {
      const isExplicitlyScoped = this.currentIntent.scope.some(s => s === file || file.startsWith(s + '/'));
      const isTestFile = /test|spec|__test__|tests/i.test(file);
      const isDependencyFile = /package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|requirements\.txt|composer\.json/i.test(file);

      if (isDependencyFile && !this.currentIntent.dependenciesAllowed) {
        violations.push({
          file,
          type: 'DEPENDENCY_MODIFICATION_BLOCKED',
          message: `File '${file}' modifies project dependencies or lockfiles, which is forbidden for this intent.`
        });
        continue;
      }

      if (isTestFile && !this.currentIntent.testsAllowed) {
        violations.push({
          file,
          type: 'TEST_MODIFICATION_BLOCKED',
          message: `Test file '${file}' modified, but testsAllowed is set to false.`
        });
        continue;
      }

      if (!isExplicitlyScoped) {
        if (isTestFile && this.currentIntent.testsAllowed) {
          warnings.push(`Test file '${file}' modified as coupled verification.`);
        } else if (this.currentIntent.allowedRelatedChanges) {
          warnings.push(`File '${file}' modified outside direct scope (allowed_related_changes enabled).`);
        } else {
          violations.push({
            file,
            type: 'OUT_OF_SCOPE_MODIFICATION',
            message: `File '${file}' was modified but is NOT inside the declared scope: [${this.currentIntent.scope.join(', ')}]`
          });
        }
      }
    }

    if (normalizedModified.length > this.currentIntent.maxFilesAllowed) {
      violations.push({
        file: '*',
        type: 'MAX_FILES_EXCEEDED',
        message: `Modified ${normalizedModified.length} files, exceeding max allowed limit of ${this.currentIntent.maxFilesAllowed}.`
      });
    }

    return {
      compliant: violations.length === 0,
      declared: true,
      scope: this.currentIntent.scope,
      modifiedCount: normalizedModified.length,
      violations,
      warnings
    };
  }
}

module.exports = UserIntentEngine;
