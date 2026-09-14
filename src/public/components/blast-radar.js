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
    this.canvas.height = (rect.height || 240) * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height || 240;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
  }

  setData(blastData) {
    this.data = blastData;
    this.targets = [];

    if (!blastData) return;

    // Direct callers on Ring 1 (radius 55)
    (blastData.directConsumers || []).forEach((c, idx, arr) => {
      const step = (Math.PI * 2) / Math.max(1, arr.length);
      const theta = step * idx + 0.4;
      this.targets.push({
        name: c.file.split('/').pop(),
        type: 'consumer',
        r: 55,
        theta,
        color: '#f59e0b'
      });
    });

    // Test suites on Ring 2 (radius 95)
    (blastData.testSuites || []).forEach((t, idx, arr) => {
      const step = (Math.PI * 2) / Math.max(1, arr.length);
      const theta = step * idx + 1.1;
      this.targets.push({
        name: t.file.split('/').pop(),
        type: 'test',
        r: 95,
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
    const rings = [55, 95];
    rings.forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Crosshair axes
    ctx.beginPath();
    ctx.moveTo(cx - 110, cy);
    ctx.lineTo(cx + 110, cy);
    ctx.moveTo(cx, cy - 110);
    ctx.lineTo(cx, cy + 110);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center Core Target
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ring labels
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText('DEPENDENTS', cx + 58, cy - 5);
    ctx.fillText('TESTS', cx + 98, cy - 5);

    // Render Targets
    this.targets.forEach(t => {
      const tx = cx + Math.cos(t.theta) * t.r;
      const ty = cy + Math.sin(t.theta) * t.r;

      // Connecting line to center
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Target Node Dot
      ctx.beginPath();
      ctx.arc(tx, ty, 5, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();

      // Label (Clear, high-contrast, readable font)
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(t.name, tx + 8, ty + 4);
    });

    ctx.restore();
  }
}

window.BlastRadarVisualizer = BlastRadarVisualizer;
