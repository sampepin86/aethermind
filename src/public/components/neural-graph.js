class EpistemicNeuralGraph {
  constructor(canvasElement, onNodeSelect) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.onNodeSelect = onNodeSelect;

    this.nodes = [];
    this.edges = [];
    this.selectedNodeId = null;
    this.hoveredNodeId = null;

    // Viewport transforms
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.pulsePhase = 0;

    this.initEvents();
    this.resize();
    this.animate();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
    if (this.offsetX === 0 && this.offsetY === 0) {
      this.recenter();
    }
  }

  recenter() {
    this.offsetX = this.width / 2;
    this.offsetY = 120;
    this.scale = 1;
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = this.screenToWorld(e.offsetX, e.offsetY);
      const clicked = this.getNodeAt(x, y);
      if (clicked) {
        this.selectedNodeId = clicked.id;
        if (this.onNodeSelect) this.onNodeSelect(clicked);
      } else {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.offsetX;
        this.dragStartY = e.clientY - this.offsetY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.offsetX = e.clientX - this.dragStartX;
        this.offsetY = e.clientY - this.dragStartY;
      } else {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        if (mx >= 0 && mx <= rect.width && my >= 0 && my <= rect.height) {
          const { x, y } = this.screenToWorld(mx, my);
          const hovered = this.getNodeAt(x, y);
          this.hoveredNodeId = hovered ? hovered.id : null;
          this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'default';
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(2.5, Math.max(0.4, this.scale * zoomFactor));

      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
      this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
      this.scale = newScale;
    });
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale
    };
  }

  getNodeAt(wx, wy) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = wx - n.x;
      const dy = wy - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= n.radius + 6) return n;
    }
    return null;
  }

  setData(nodesData, edgesData) {
    // Preserve positions if nodes already existed
    const existingMap = new Map(this.nodes.map(n => [n.id, n]));

    // Layout nodes organically or in tree levels
    const levels = new Map();
    const childrenMap = new Map();

    nodesData.forEach(n => {
      if (n.parentId) {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
        childrenMap.get(n.parentId).push(n.id);
      }
    });

    // Compute depth for each node
    const getDepth = (id, visited = new Set()) => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const node = nodesData.find(n => n.id === id);
      if (!node || !node.parentId) return 0;
      return 1 + getDepth(node.parentId, visited);
    };

    this.nodes = nodesData.map((n, idx) => {
      const depth = getDepth(n.id);
      const existing = existingMap.get(n.id);

      let x = existing ? existing.x : 0;
      let y = existing ? existing.y : depth * 140;

      if (!existing) {
        const siblingsAtDepth = nodesData.filter(item => getDepth(item.id) === depth);
        const sibIndex = siblingsAtDepth.findIndex(s => s.id === n.id);
        const totalSib = siblingsAtDepth.length;
        const spacing = 220;
        x = (sibIndex - (totalSib - 1) / 2) * spacing;
      }

      return {
        ...n,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: n.type === 'hypothesis' ? 34 : 28,
        depth
      };
    });

    this.edges = edgesData || [];
  }

  animate() {
    this.pulsePhase += 0.035;
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // Camera transform
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    // Draw Edges
    this.edges.forEach(edge => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      let strokeStyle = 'rgba(255, 255, 255, 0.15)';
      if (edge.relationship === 'supports') strokeStyle = 'rgba(16, 185, 129, 0.35)';
      if (edge.relationship === 'refutes') strokeStyle = 'rgba(244, 63, 94, 0.35)';

      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flow particle animation along edge
      const particlePos = (this.pulsePhase % 1);
      const px = src.x + dx * particlePos;
      const py = src.y + dy * particlePos;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00f2fe';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.restore();
    });

    // Draw Nodes
    this.nodes.forEach(node => {
      const isSelected = node.id === this.selectedNodeId;
      const isHovered = node.id === this.hoveredNodeId;
      const r = node.radius + (isHovered ? 4 : 0);

      ctx.save();

      // Outer glow ring
      let glowColor = 'rgba(0, 242, 254, 0.4)';
      let borderColor = '#00f2fe';
      let fillColor = '#0f172a';

      if (node.status === 'refuted') {
        glowColor = 'rgba(244, 63, 94, 0.4)';
        borderColor = '#f43f5e';
      } else if (node.type === 'intervention') {
        glowColor = 'rgba(157, 78, 221, 0.4)';
        borderColor = '#c084fc';
      } else if (node.type === 'observation') {
        glowColor = 'rgba(16, 185, 129, 0.4)';
        borderColor = '#10b981';
      }

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isSelected ? 24 : (isHovered ? 16 : 8);

      // Node Body Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Border
      ctx.lineWidth = isSelected ? 3.5 : 2;
      ctx.strokeStyle = borderColor;
      ctx.stroke();

      // Confidence Arc Indicator
      if (node.confidence) {
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * node.confidence);
        ctx.arc(node.x, node.y, r + 4, startAngle, endAngle);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      }

      // Icon / Glyph
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let glyph = 'H';
      if (node.type === 'intervention') glyph = '⚡';
      else if (node.type === 'observation') glyph = '👁';
      else if (node.status === 'refuted') glyph = '✘';

      ctx.fillText(glyph, node.x, node.y - (node.type === 'hypothesis' ? 5 : 0));

      if (node.type === 'hypothesis' && node.confidence) {
        ctx.font = '500 9px "JetBrains Mono", monospace';
        ctx.fillStyle = borderColor;
        ctx.fillText(`${Math.round(node.confidence * 100)}%`, node.x, node.y + 11);
      }

      // Node Label below
      ctx.font = '500 11px Outfit, sans-serif';
      ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
      const labelText = node.title.length > 24 ? node.title.substring(0, 22) + '...' : node.title;
      ctx.fillText(labelText, node.x, node.y + r + 18);

      ctx.restore();
    });

    ctx.restore();
  }
}

window.EpistemicNeuralGraph = EpistemicNeuralGraph;
