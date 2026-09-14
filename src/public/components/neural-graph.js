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

    this.nodeWidth = 260;
    this.nodeHeight = 86;
    this.searchQuery = '';

    this.initEvents();
    this.resize();
    this.animate();
  }

  setSearchQuery(q) {
    this.searchQuery = (q || '').trim().toLowerCase();
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
    this.offsetY = 90;
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
          this.canvas.style.cursor = hovered ? 'pointer' : (this.isDragging ? 'grabbing' : 'default');
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'default';
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newScale = Math.min(2.0, Math.max(0.4, this.scale * zoomFactor));

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
    const hw = this.nodeWidth / 2;
    const hh = this.nodeHeight / 2;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (wx >= n.x - hw && wx <= n.x + hw && wy >= n.y - hh && wy <= n.y + hh) {
        return n;
      }
    }
    return null;
  }

  setData(nodesData, edgesData) {
    const existingMap = new Map(this.nodes.map(n => [n.id, n]));

    const getDepth = (id, visited = new Set()) => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const node = nodesData.find(n => n.id === id);
      if (!node || !node.parentId) return 0;
      return 1 + getDepth(node.parentId, visited);
    };

    this.nodes = nodesData.map((n) => {
      const depth = getDepth(n.id);
      const existing = existingMap.get(n.id);

      let x = existing ? existing.x : 0;
      let y = existing ? existing.y : depth * 160;

      if (!existing) {
        const siblings = nodesData.filter(item => getDepth(item.id) === depth);
        const sibIndex = siblings.findIndex(s => s.id === n.id);
        const totalSib = siblings.length;
        const spacing = 300;
        x = (sibIndex - (totalSib - 1) / 2) * spacing;
      }

      return {
        ...n,
        x,
        y,
        depth
      };
    });

    this.edges = edgesData || [];
  }

  animate() {
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // Subtle dark background grid
    this.drawSubtleGrid(ctx);

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    // Draw Edges (Clean architectural lines)
    this.edges.forEach(edge => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return;

      const startY = src.y + this.nodeHeight / 2;
      const endY = tgt.y - this.nodeHeight / 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(src.x, startY);

      // Smooth vertical cubic bezier
      const midY = (startY + endY) / 2;
      ctx.bezierCurveTo(src.x, midY, tgt.x, midY, tgt.x, endY);

      ctx.strokeStyle = edge.relationship === 'supports' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Clean arrow tip at target
      ctx.beginPath();
      ctx.moveTo(tgt.x, endY);
      ctx.lineTo(tgt.x - 5, endY - 7);
      ctx.lineTo(tgt.x + 5, endY - 7);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();

      ctx.restore();
    });

    // Draw Nodes (Crisp Linear/React-Flow card style with high readability)
    const hw = this.nodeWidth / 2;
    const hh = this.nodeHeight / 2;

    this.nodes.forEach(node => {
      const isSelected = node.id === this.selectedNodeId;
      const isHovered = node.id === this.hoveredNodeId;
      const matchesSearch = this.searchQuery
        ? (node.title + ' ' + (node.details || '')).toLowerCase().includes(this.searchQuery)
        : true;

      ctx.save();

      if (!matchesSearch && this.searchQuery) {
        ctx.globalAlpha = 0.35;
      }

      // Card boundary
      const x = node.x - hw;
      const y = node.y - hh;
      const r = 8;

      // Card Background
      ctx.beginPath();
      this.roundRect(ctx, x, y, this.nodeWidth, this.nodeHeight, r);
      ctx.fillStyle = isSelected ? '#222838' : (isHovered ? '#1c2232' : '#141824');
      ctx.fill();

      // Card Border
      let borderColor = 'rgba(255, 255, 255, 0.14)';
      if (isSelected) borderColor = '#3b82f6';
      else if (matchesSearch && this.searchQuery) borderColor = '#f59e0b';
      else if (node.status === 'refuted') borderColor = 'rgba(244, 63, 94, 0.65)';
      else if (node.type === 'intervention') borderColor = 'rgba(139, 92, 246, 0.55)';
      else if (node.type === 'observation') borderColor = 'rgba(16, 185, 129, 0.55)';

      ctx.lineWidth = isSelected || (matchesSearch && this.searchQuery) ? 2.5 : 1.2;
      ctx.strokeStyle = borderColor;
      ctx.stroke();

      // Top Header: Type Pill + Confidence
      ctx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      let pillBg = 'rgba(59, 130, 246, 0.2)';
      let pillFg = '#60a5fa';
      let typeLabel = 'HYPOTHESIS';

      if (node.status === 'refuted') {
        pillBg = 'rgba(244, 63, 94, 0.2)';
        pillFg = '#fb7185';
        typeLabel = 'REFUTED';
      } else if (node.type === 'intervention') {
        pillBg = 'rgba(139, 92, 246, 0.2)';
        pillFg = '#a78bfa';
        typeLabel = 'INTERVENTION';
      } else if (node.type === 'observation') {
        pillBg = 'rgba(16, 185, 129, 0.2)';
        pillFg = '#34d399';
        typeLabel = 'OBSERVATION';
      }

      // Draw Type Pill
      const pillW = ctx.measureText(typeLabel).width + 12;
      ctx.beginPath();
      this.roundRect(ctx, x + 12, y + 10, pillW, 18, 4);
      ctx.fillStyle = pillBg;
      ctx.fill();
      ctx.fillStyle = pillFg;
      ctx.fillText(typeLabel, x + 18, y + 19);

      // Confidence badge on the right
      if (node.confidence) {
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(node.confidence * 100)}% conf`, x + this.nodeWidth - 12, y + 19);
      }

      // Title text (Large 12.5px Bold, with 2-line wrap if needed)
      ctx.font = '600 12.5px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = isSelected ? '#ffffff' : '#f1f5f9';
      ctx.textAlign = 'left';

      const maxTitleW = this.nodeWidth - 24;
      let line1 = node.title || 'Untitled Node';
      let line2 = '';

      if (ctx.measureText(line1).width > maxTitleW) {
        const words = line1.split(' ');
        line1 = '';
        let wIdx = 0;
        while (wIdx < words.length && ctx.measureText(line1 + words[wIdx] + ' ').width < maxTitleW) {
          line1 += words[wIdx] + ' ';
          wIdx++;
        }
        line2 = words.slice(wIdx).join(' ');
        if (ctx.measureText(line2).width > maxTitleW) {
          while (line2.length > 3 && ctx.measureText(line2 + '...').width > maxTitleW) {
            line2 = line2.slice(0, -1);
          }
          line2 += '...';
        }
      }

      ctx.fillText(line1.trim(), x + 12, y + 46);
      if (line2) {
        ctx.fillText(line2.trim(), x + 12, y + 64);
      } else if (node.details) {
        ctx.font = '400 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#94a3b8';
        let detailSnippet = node.details;
        if (ctx.measureText(detailSnippet).width > maxTitleW) {
          while (detailSnippet.length > 3 && ctx.measureText(detailSnippet + '...').width > maxTitleW) {
            detailSnippet = detailSnippet.slice(0, -1);
          }
          detailSnippet += '...';
        }
        ctx.fillText(detailSnippet, x + 12, y + 65);
      }

      ctx.restore();
    });

    ctx.restore();
  }

  drawSubtleGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    const step = 32;
    const offX = (this.offsetX * this.scale) % step;
    const offY = (this.offsetY * this.scale) % step;

    for (let x = offX; x < this.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = offY; y < this.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
  }
}

window.EpistemicNeuralGraph = EpistemicNeuralGraph;
