const fs = require('fs');
const path = require('path');

class JournalStorage {
  constructor(filePath = path.join(__dirname, 'journal.log')) {
    this.filePath = filePath;
    this.init();
  }

  init() {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
    fs.writeFileSync(this.filePath, '', 'utf8');
  }

  async appendRecord(record) {
    // Simulate slight asynchronous I/O delay
    await new Promise(r => setTimeout(r, 2));
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(this.filePath, line, 'utf8');
  }

  getRecordCount() {
    if (!fs.existsSync(this.filePath)) return 0;
    const content = fs.readFileSync(this.filePath, 'utf8').trim();
    if (!content) return 0;
    return content.split('\n').length;
  }

  readAllRecords() {
    if (!fs.existsSync(this.filePath)) return [];
    const content = fs.readFileSync(this.filePath, 'utf8').trim();
    if (!content) return [];
    return content.split('\n').map(l => JSON.parse(l));
  }
}

module.exports = { JournalStorage };
