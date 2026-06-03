import React from 'react';
import PropTypes from 'prop-types';
import { NrqlQuery, LineChart, Spinner, Card, CardHeader, CardBody, BlockText } from 'nr1';
import { billingCostExpr, excessCostExpr } from './nrqlCost';

export default class FlexpoolTimeSeries extends React.Component {
  static propTypes = {
    accountId: PropTypes.number.isRequired,
    config: PropTypes.object.isRequired,
  };

  buildQuery(cfg) {
    return `
      SELECT
        ${billingCostExpr(cfg)} AS billingCost,
        ${excessCostExpr(cfg)} AS excessCost
      FROM NrConsumption
      SINCE '${cfg.contractStart}'
      TIMESERIES 2628000 seconds
      LIMIT MAX`;
  }

  processData(data, cfg) {
    if (!data || data.length < 2) return null;

    const billingPoints = data[0].data;
    const excessPoints = data[1].data;

    if (!billingPoints || billingPoints.length === 0) return null;

    const monthlyBudget = cfg.acv / 12;
    let cumulativeSpend = 0;
    let cumulativeExcess = 0;

    const onTrackData = [];
    const actualData = [];
    const flexpoolData = [];

    billingPoints.forEach((point, idx) => {
      const monthNum = idx + 1;
      const spend = point.y || 0;
      const excess = Math.max(0, (excessPoints[idx] && excessPoints[idx].y) || 0);

      cumulativeSpend += spend;
      cumulativeExcess += excess;

      const yearsElapsed = Math.ceil(monthNum / 12);
      const accruedFlexpool = cfg.flexpool * yearsElapsed;

      onTrackData.push({ x: point.x, y: cfg.totalCommitment - monthNum * monthlyBudget });
      actualData.push({ x: point.x, y: cfg.totalCommitment - cumulativeSpend });
      flexpoolData.push({ x: point.x, y: accruedFlexpool - cumulativeExcess });
    });

    return [
      {
        metadata: { id: 'on-track', name: 'On-track Balance', color: '#9aa0aa', viz: 'main', units_data: { y: 'DOLLARS' } },
        data: onTrackData,
      },
      {
        metadata: { id: 'actual', name: 'Actual Remaining Balance', color: '#11a600', viz: 'main', units_data: { y: 'DOLLARS' } },
        data: actualData,
      },
      {
        metadata: { id: 'flexpool', name: 'Flex Pool Balance', color: '#0079bf', viz: 'main', units_data: { y: 'DOLLARS' } },
        data: flexpoolData,
      },
    ];
  }

  render() {
    const { accountId, config: cfg } = this.props;

    return (
      <Card>
        <CardHeader title="Savings Plan Tracker — Running Balance & Flex Pool" />
        <CardBody>
          <NrqlQuery
            accountIds={[accountId]}
            query={this.buildQuery(cfg)}
          >
            {({ data, loading, error }) => {
              if (loading) return <Spinner />;
              if (error) return <BlockText>Error: {error.message}</BlockText>;
              const chartData = this.processData(data, cfg);
              if (!chartData) return <BlockText>No data available for the selected account and contract start date.</BlockText>;
              return (
                <LineChart
                  data={chartData}
                  fullWidth
                  style={{ height: '300px' }}
                />
              );
            }}
          </NrqlQuery>
        </CardBody>
      </Card>
    );
  }
}
