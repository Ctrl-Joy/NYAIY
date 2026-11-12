export const RISK_LEVELS = ['High', 'Medium', 'Low'];

/**
 * Overall risk for a report: the red-flag score first, then the riskiest clause
 * or deviation the analysis found.
 */
export const overallRisk = (analysis) => {
  const score = Number(analysis?.pass4?.scamScore) || 0;
  const levels = [
    ...(analysis?.pass1?.clauses || []).map((c) => c.risk),
    ...(analysis?.pass2?.deviations || []).map((d) => d.severity),
  ];
  let level = 'Low';
  if (score >= 60 || levels.includes('High')) level = 'High';
  else if (score >= 30 || levels.includes('Medium')) level = 'Medium';
  return { level, score };
};

export const countByRisk = (items, key) =>
  RISK_LEVELS.reduce(
    (acc, level) => ({ ...acc, [level]: items.filter((i) => i[key] === level).length }),
    {}
  );
