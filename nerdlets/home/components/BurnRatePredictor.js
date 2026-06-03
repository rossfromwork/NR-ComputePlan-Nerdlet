import React from 'react';
import PropTypes from 'prop-types';
import { NrqlQuery, Spinner, Card, CardHeader, CardBody, BlockText } from 'nr1';
import { billingCostExpr } from './nrqlCost';

function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function monthDiff(startStr, endStr) {
  const s = new Date(startStr + 'T00:00:00Z');
  const e = new Date(endStr + 'T00:00:00Z');
  return (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
}

export default class BurnRatePredictor extends React.Component {
  static propTypes = {
    accountId: PropTypes.number.isRequired,
    config: PropTypes.object.isRequired,
  };

  buildQuery(cfg) {
    return `
      SELECT ${billingCostExpr(cfg)} AS totalSpend
      FROM NrConsumption
      SINCE '${cfg.contractStart}'
      TIMESERIES 2628000 seconds
      LIMIT MAX`;
  }

  computePrediction(data, cfg) {
    // Default NrqlQuery format: data[0].data = [{x: timestampMs, y: value}, ...]
    if (!data || !data[0] || !data[0].data) return null;

    const points = data[0].data.filter(p => p.y != null && p.y > 0);
    if (points.length === 0) return null;

    const completedMonths = points.length;
    const cumulativeSpend = points.reduce((sum, p) => sum + p.y, 0);

    // Avg monthly burn over last 3 months (or all months if fewer)
    const lookback = Math.min(3, completedMonths);
    const avgMonthlyBurn = points.slice(-lookback).reduce((s, p) => s + p.y, 0) / lookback;

    const remainingBalance = cfg.totalCommitment - cumulativeSpend;
    const monthsRemaining = avgMonthlyBurn > 0 ? remainingBalance / avgMonthlyBurn : Infinity;
    const predictedEndMonth = addMonths(cfg.contractStart, completedMonths + Math.round(monthsRemaining));
    const contractEndMonth = cfg.contractEnd.slice(0, 7);
    const deltaMonths = monthDiff(contractEndMonth, predictedEndMonth);

    return { predictedEndMonth, contractEndMonth, deltaMonths, avgMonthlyBurn, remainingBalance };
  }

  render() {
    const { accountId, config: cfg } = this.props;

    return (
      <Card>
        <CardHeader title="Predicted Contract End Date" />
        <CardBody>
          <NrqlQuery
            accountIds={[accountId]}
            query={this.buildQuery(cfg)}
          >
            {({ data, loading, error }) => {
              if (loading) return <Spinner />;
              if (error) return <BlockText>Error: {error.message}</BlockText>;

              const pred = this.computePrediction(data, cfg);
              if (!pred) return <BlockText>Insufficient data to compute burn rate.</BlockText>;

              const { predictedEndMonth, contractEndMonth, deltaMonths, avgMonthlyBurn, remainingBalance } = pred;

              // Graduated colour scheme:
              //   Green  = on track (0 months difference)
              //   Blue   = burning cold — predicted end after contract end (budget to spare)
              //   Yellow = slightly warm — within 3 months early
              //   Red    = significantly warm — more than 3 months early
              let color;
              if (deltaMonths === 0) color = '#11a600';
              else if (deltaMonths > 0) color = '#0079bf';
              else if (deltaMonths >= -3) color = '#c07b00';
              else color = '#bf0000';

              let statusText;
              if (deltaMonths === 0) statusText = 'On track';
              else if (deltaMonths > 0) statusText = `${deltaMonths} month${deltaMonths !== 1 ? 's' : ''} ahead of contract end`;
              else statusText = `${Math.abs(deltaMonths)} month${Math.abs(deltaMonths) !== 1 ? 's' : ''} past contract end`;

              return (
                <div className="predictor-stat-row">
                  <div className="predictor-stat">
                    <div className="predictor-stat-value" style={{ color }}>
                      {predictedEndMonth}
                    </div>
                    <div className="predictor-stat-label">Predicted exhaustion</div>
                  </div>
                  <div className="predictor-stat">
                    <div className="predictor-stat-value" style={{ color }}>
                      {statusText}
                    </div>
                    <div className="predictor-stat-label">vs contract end ({contractEndMonth})</div>
                  </div>
                  <div className="predictor-stat">
                    <div className="predictor-stat-value">
                      ${Math.round(avgMonthlyBurn).toLocaleString()}
                    </div>
                    <div className="predictor-stat-label">Avg monthly burn (last 3mo)</div>
                  </div>
                  <div className="predictor-stat">
                    <div className="predictor-stat-value">
                      ${Math.round(remainingBalance).toLocaleString()}
                    </div>
                    <div className="predictor-stat-label">Remaining balance</div>
                  </div>
                </div>
              );
            }}
          </NrqlQuery>
        </CardBody>
      </Card>
    );
  }
}
