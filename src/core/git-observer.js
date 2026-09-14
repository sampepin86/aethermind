const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class GitObserver {
  constructor(workspaceDir = process.cwd()) {
    this.workspaceDir = workspaceDir;
    this.snapshots = new Map();
  }

  isGitRepository() {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.workspaceDir,
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8'
      });
      return true;
    } catch {
      return false;
    }
  }

  getHeadCommit() {
    if (!this.isGitRepository()) return null;
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.workspaceDir,
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8'
      }).trim();
    } catch {
      return 'INITIAL_OR_EMPTY';
    }
  }

  getWorkingTreeStatus() {
    if (!this.isGitRepository()) {
      return {
        isGit: false,
        clean: true,
        files: []
      };
    }

    try {
      const output = execSync('git status --porcelain', {
        cwd: this.workspaceDir,
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8'
      }).trim();

      if (!output) {
        return { isGit: true, clean: true, files: [] };
      }

      const files = output.split('\n').filter(Boolean).map(line => {
        const statusCode = line.substring(0, 2).trim();
        const rawFile = line.substring(2).trim();
        // Handle renamed files like "R  foo -> bar"
        const filePath = rawFile.includes(' -> ') ? rawFile.split(' -> ')[1] : rawFile;
        return {
          statusCode,
          file: filePath.split(path.sep).join('/'),
          statusText: this.statusLabel(statusCode)
        };
      });

      return {
        isGit: true,
        clean: files.length === 0,
        files
      };
    } catch (err) {
      return { isGit: false, clean: false, error: err.message, files: [] };
    }
  }

  statusLabel(code) {
    if (code.includes('M')) return 'Modified';
    if (code.includes('A')) return 'Added';
    if (code.includes('D')) return 'Deleted';
    if (code.includes('R')) return 'Renamed';
    if (code.includes('?')) return 'Untracked';
    return 'Changed';
  }

  getDiffStat(targetFile = null) {
    if (!this.isGitRepository()) return { stat: '', insertions: 0, deletions: 0, filesChanged: 0 };
    try {
      const targetArg = targetFile ? ` -- "${targetFile}"` : '';
      const stat = execSync(`git diff --stat${targetArg}`, {
        cwd: this.workspaceDir,
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8'
      }).trim();

      let insertions = 0;
      let deletions = 0;
      let filesChanged = 0;

      const summaryLine = stat.split('\n').pop() || '';
      const insMatch = summaryLine.match(/(\d+)\s+insertion/);
      const delMatch = summaryLine.match(/(\d+)\s+deletion/);
      const filesMatch = summaryLine.match(/(\d+)\s+file/);

      if (insMatch) insertions = parseInt(insMatch[1], 10);
      if (delMatch) deletions = parseInt(delMatch[1], 10);
      if (filesMatch) filesChanged = parseInt(filesMatch[1], 10);

      return { stat, insertions, deletions, filesChanged };
    } catch {
      return { stat: '', insertions: 0, deletions: 0, filesChanged: 0 };
    }
  }

  getWorkingTreeDiff(targetFile = null) {
    if (!this.isGitRepository()) return { diff: '', targetFile };
    const targetArg = targetFile ? ` -- "${targetFile}"` : '';
    try {
      const diff = execSync(`git diff HEAD${targetArg}`, {
        cwd: this.workspaceDir,
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });
      return { diff, targetFile };
    } catch {
      try {
        const diff = execSync(`git diff${targetArg}`, {
          cwd: this.workspaceDir,
          stdio: ['pipe', 'pipe', 'ignore'],
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
        return { diff, targetFile };
      } catch (err) {
        return { diff: '', error: err.message, targetFile };
      }
    }
  }

  takeSnapshot(label = 'baseline') {
    const status = this.getWorkingTreeStatus();
    const snapshot = {
      label,
      timestamp: new Date().toISOString(),
      head: this.getHeadCommit(),
      files: status.files,
      fileList: status.files.map(f => f.file)
    };
    this.snapshots.set(label, snapshot);
    return snapshot;
  }

  computeDelta(baselineLabel = 'baseline') {
    const baseline = this.snapshots.get(baselineLabel) || { fileList: [] };
    const current = this.getWorkingTreeStatus();
    const diffStat = this.getDiffStat();

    const baselineSet = new Set(baseline.fileList);
    const newModifications = [];
    const persistentModifications = [];

    current.files.forEach(f => {
      if (baselineSet.has(f.file)) {
        persistentModifications.push(f);
      } else {
        newModifications.push(f);
      }
    });

    return {
      timestamp: new Date().toISOString(),
      baselineTimestamp: baseline.timestamp || null,
      totalCurrentChanges: current.files.length,
      newModifications,
      persistentModifications,
      diffStat,
      rawFiles: current.files
    };
  }
}

module.exports = GitObserver;
