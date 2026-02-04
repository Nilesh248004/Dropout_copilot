export const getRiskScore = (student) => {
  const score = student?.risk_score ?? student?.dropout_risk;
  return Number.isFinite(score) ? score : null;
};

export const getRiskLevelFromScore = (score) => {
  if (!Number.isFinite(score)) return null;
  if (score > 0.7) return "HIGH";
  if (score > 0.4) return "MEDIUM";
  return "LOW";
};

export const getRiskLevel = (student) =>
  student?.risk_level || getRiskLevelFromScore(getRiskScore(student));
