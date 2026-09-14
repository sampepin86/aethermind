class BlastRadarVisualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.angle = 0;
    this.data = null;
    this.targets = [];

    this.resize();
    this.animate();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height || 180) * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height || 180;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
  }

  setData(blastData) {
    this.data = blastData;
    this.targets = [];

    if (!blastData) return;

    // Direct callers on Ring 1 (radius 45)
    (blastData.directConsumers || []).forEach((c, idx, arr) => {
      const step = (Math.PI * 2) / Math.max(1, arr.length);
      const theta = step * idx + 0.5;
      this.targets.push({
        name: c.file.split('/').pop(),
        type: 'consumer',
        r: 45,
        theta,
        color: '#f59e0b'
      });
    });

    // Test suites on Ring 2 (radius 75)
    (blastData.testSuites || []).forEach((t, idx, arr) => {
      const step = (Math.PI * 2) / Math.max(1, arr.length);
      const theta = step * idx + 1.2;
      this.targets.push({
        name: t.file.split('/').pop(),
        type: 'test',
        r: 72,
        theta,
        color: '#10b981'
      });
    });
  }

  animate() {
    this.angle += 0.04;
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    const cx = this.cx;
    const cy = this.cy;

    // Draw concentric radar rings
    const rings = [25, 50, 75];
    rings.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 242, 254, ${0.1 + idx * 0.05})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - 85, cy);
    ctx.lineTo(cx + 85, cy);
    ctx.moveTo(cx, cy - 85);
    ctx.lineTo(cx, cy + 85);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rotating Radar Sweep Cone
    ctx.save();
    const grad = ctx.createConicGradient(this.angle, cx, cy);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
    grad.addColorStop(0.12, 'rgba(0, 242, 254, 0.0)');
    grad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(cx, cy, 78, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Center Core Target (Source File)
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Render Targets on Rings
    this.targets.forEach(t => {
      const tx = cx + Math.cos(t.theta) * t.r;
      const ty = cy + Math.sin(t.theta) * t.r;

      // Calculate sweep proximity for echo glow
      const diffAngle = Math.abs((this.angle % (Math.PI * 2)) - (t.theta % (Math.PI * 2)));
      const isSwept = diffAngle < 0.3;

      ctx.save();
      ctx.beginPath();
      ctx.arc(tx, ty, isSwept ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      if (isSwept) {
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 14;
      }
      ctx.fill();

      // Label
      ctx.font = '500 8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = isSwept ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(t.name, tx + 6, ty + 3);
      ctx.restore();
    });

    ctx.restore();
  }
}

window.BlastRadarVisualizer = BlastRadarVisualizer;
