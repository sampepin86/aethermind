class CognitiveDriftDetector {
  constructor(stateEngine) {
    this.engine = stateEngine;
  }

  detect() {
    const state = this.engine.getState();
    const anomalies = [];
    const recommendations = [];

    // 1. Check for circular action patterns in timeline
    const recentTimeline = state.timeline.slice(-15);
    const actionCounts = {};
    for (const evt of recentTimeline) {
      const key = `${evt.actionType}:${evt.summary.substring(0, 30)}`;
      actionCounts[key] = (actionCounts[key] || 0) + 1;
      if (actionCounts[key] >= 3) {
        anomalies.push({
          type: 'CIRCULAR_LOOP',
          severity: 'HIGH',
          title: 'Repetitive Action Loop Detected',
          description: `Action "${evt.summary}" repeated ${actionCounts[key]} times recently. Agent may be thrashing without progress.`
        });
        recommendations.push('Halt current intervention loop. Run an empirical reality probe to falsify root premise.');
        break;
      }
    }

    // 2. Check for Context Staleness (files changed underneath)
    const stalenessWarnings = this.engine.checkContextStaleness();
    for (const w of stalenessWarnings) {
      anomalies.push({
        type: 'STALE_CONTEXT',
        severity: 'CRITICAL',
        title: `Epistemic Invalidation: ${w.file}`,
        description: w.message
      });
      recommendations.push(`Re-read ${w.file} before executing further modifications.`);
    }

    // 3. Hypothesis Churn
    const refuted = state.nodes.filter(n => n.type === 'hypothesis' && n.status === 'refuted');
    const active = state.nodes.filter(n => n.type === 'hypothesis' && n.status === 'active');
    if (refuted.length >= 3 && active.length === 0) {
      anomalies.push({
        type: 'HYPOTHESIS_EXHAUSTION',
        severity: 'MEDIUM',
        title: 'Multiple Hypotheses Refuted Without Active Alternative',
        description: `${refuted.length} hypotheses refuted. Agent needs to step back and re-evaluate problem framing.`
      });
      recommendations.push('Formulate an orthogonal hypothesis or inspect raw logs.');
    }

    // 4. Unverified High-Risk Assumptions
    const highRiskUnverified = state.assumptions.filter(a => !a.verified && ['HIGH', 'CRITICAL'].includes(a.riskLevel));
    if (highRiskUnverified.length > 0) {
      anomalies.push({
        type: 'UNVERIFIED_ASSUMPTION_OVERLOAD',
        severity: 'HIGH',
        title: `${highRiskUnverified.length} High-Risk Assumptions Unverified`,
        description: `Crucial assumptions like "${highRiskUnverified[0].premise}" have not been proven against reality.`
      });
      recommendations.push(`Run automated verification for: "${highRiskUnverified[0].premise}"`);
    }

    const driftIndex = Math.min(100, anomalies.reduce((acc, curr) => {
      if (curr.severity === 'CRITICAL') return acc + 35;
      if (curr.severity === 'HIGH') return acc + 20;
      return acc + 10;
    }, 0));

    return {
      timestamp: new Date().toISOString(),
      driftIndex,
      driftStatus: driftIndex > 60 ? 'HIGH_RISK_SPIRAL' : (driftIndex > 25 ? 'MODERATE_DRIFT' : 'NOMINAL_COHERENCE'),
      anomalies,
      recommendations: Array.from(new Set(recommendations))
    };
  }
}

module.exports = CognitiveDriftDetector;
