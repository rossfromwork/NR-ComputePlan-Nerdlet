// Shared NRQL expression builders for Compute Savings Plan cost calculations.
//
// Tier model:
//   Tier 1: always pay t1Qty * t1Rate (committed min)
//   Tier 2: usage between t1Qty and t1Qty+t2Qty, charged at t2Rate
//   Tier 3: usage above t1Qty+t2Qty, charged at t3Rate (overage)

const CORE_CCU = `filter(sum(consumption), WHERE metric IN ('CoreCCU') AND dimension_productFeature != 'Cloud bytes received' AND (timestamp < 1760954400000 OR timestamp >= 1760954700000))`;
const ADVU_CCU = `filter(sum(consumption), WHERE metric IN ('AdvancedCCU') AND dimension_productFeature != 'Cloud bytes received' AND (timestamp < 1760954400000 OR timestamp >= 1760954700000))`;
const GB_INGEST = `filter(sum(GigabytesIngested), WHERE productLine = 'DataPlatform' AND (version = '0.4.2' OR nr.customerStructure = 'customer_contract') AND consumingAccountId IS NOT NULL)`;

// Usage that falls in the Tier 2 band:
//   max(0, CoreCCU - t1Qty) minus what spills into Tier 3
//   = clamp_min(CoreCCU - t1Qty, 0) - clamp_min(CoreCCU - t1Qty - t2Qty, 0)
function t2BandExpr(cfg) {
  return `(clamp_min(${CORE_CCU} - ${cfg.t1Qty}, 0) - clamp_min(${CORE_CCU} - ${cfg.t1Qty} - ${cfg.t2Qty}, 0))`;
}

// Total monthly billing cost (includes min commit floor)
export function billingCostExpr(cfg) {
  return `(
    ${cfg.t1Qty} * ${cfg.t1Rate}
    + ${t2BandExpr(cfg)} * ${cfg.t2Rate}
    + clamp_min(${CORE_CCU} - ${cfg.t1Qty} - ${cfg.t2Qty}, 0) * ${cfg.t3Rate}
    + clamp_min(${ADVU_CCU}, ${cfg.accuCommitQty}) * ${cfg.accuRate}
    + clamp_min(${GB_INGEST}, ${cfg.dataCommitQty}) * ${cfg.dataRate}
  )`;
}

// Excess cost above the committed minimum — drawn from the Flex Pool
export function excessCostExpr(cfg) {
  return `(
    ${t2BandExpr(cfg)} * ${cfg.t2Rate}
    + clamp_min(${CORE_CCU} - ${cfg.t1Qty} - ${cfg.t2Qty}, 0) * ${cfg.t3Rate}
    + clamp_min(${ADVU_CCU} - ${cfg.accuCommitQty}, 0) * ${cfg.accuRate}
    + clamp_min(${GB_INGEST} - ${cfg.dataCommitQty}, 0) * ${cfg.dataRate}
  )`;
}

// Raw actual usage cost — no committed floor, tiered rates applied correctly.
// Used in RunRateChart to show true consumption cost vs the billing floor.
//   Tier 1: actual CCU up to t1Qty, at t1Rate
//   Tier 2: CCU in the t1Qty→t1Qty+t2Qty band, at t2Rate
//   Tier 3: CCU above t1Qty+t2Qty, at t3Rate
//   Adv CCU / Data: actual usage at their rates, no floor applied
export function rawUsageCostExpr(cfg) {
  return `(
    (${CORE_CCU} - clamp_min(${CORE_CCU} - ${cfg.t1Qty}, 0)) * ${cfg.t1Rate}
    + ${t2BandExpr(cfg)} * ${cfg.t2Rate}
    + clamp_min(${CORE_CCU} - ${cfg.t1Qty} - ${cfg.t2Qty}, 0) * ${cfg.t3Rate}
    + ${ADVU_CCU} * ${cfg.accuRate}
    + ${GB_INGEST} * ${cfg.dataRate}
  )`;
}

// Core CCU quantity only (for MonthlyTable)
export { CORE_CCU, ADVU_CCU, GB_INGEST };
