class BlastRadarVisualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.data = null;
    this.targets = [];

    this.resize();
    this.animate();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height || 160) * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height || 160;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
  }

  setData(blastData) {
    this.data = blastData;
    this.targets = [];

    if (!blastData) return;

    // Direct callers on Ring 1 (radius 38)
    (blastData.directConsumers || []).forEach((c, idx, arr) => {
      const step = (Math.PI * 2) / Math.max(1, arr.length);
      const theta = step * idx + 0.4;
      this.targets.push({
        name: c.file.split('/').pop(),
        type: 'consumer',
        r: 38,
        theta,
        color: '#f59e0b'
      });
    });

    // Test suites on Ring 2 (radius 64)
    (blastData.testSuites || []).forEach((t, idx, arr) => {
      const step = (Math.PI * 2) / Math.max(1, arr.length);
      const theta = step * idx + 1.1;
      this.targets.push({
        name: t.file.split('/').pop(),
        type: 'test',
        r: 64,
        theta,
        color: '#10b981'
      });
    });
  }

  animate() {
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    const cx = this.cx;
    const cy = this.cy;

    // Concentric clean dependency rings
    const rings = [38, 64];
    rings.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Crosshair axes (subtle)
    ctx.beginPath();
    ctx.moveTo(cx - 72, cy);
    ctx.lineTo(cx + 72, cy);
    ctx.moveTo(cx, cy - 72);
    ctx.lineTo(cx, cy + 72);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center Core Target (Source File Icon/Badge)
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();

    // Ring labels
    ctx.font = '500 7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillText('DEPENDENTS', cx + 40, cy - 4);
    ctx.fillText('TESTS', cx + 66, cy - 4);

    // Render Targets
    this.targets.forEach(t => {
      const tx = cx + Math.cos(t.theta) * t.r;
      const ty = cy + Math.sin(t.theta) * t.r;

      // Connecting subtle line to center
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Target Node Dot
      ctx.beginPath();
      ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();

      // Label
      ctx.font = '500 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(t.name, tx + 6, ty + 3);
    });

    ctx.restore();
  }
}

window.BlastRadarVisualizer = BlastRadarVisualizer;
