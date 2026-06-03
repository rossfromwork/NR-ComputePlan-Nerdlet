import React from 'react';
import PropTypes from 'prop-types';
import { LineChart, Card, CardHeader, CardBody } from 'nr1';
import { billingCostExpr, rawUsageCostExpr } from './nrqlCost';

export default class RunRateChart extends React.Component {
  static propTypes = {
    accountId: PropTypes.number.isRequired,
    config: PropTypes.object.isRequired,
  };

  render() {
    const { accountId, config: cfg } = this.props;

    const minCommit = cfg.t1Qty * cfg.t1Rate
      + cfg.accuCommitQty * cfg.accuRate
      + cfg.dataCommitQty * cfg.dataRate;

    const query = `
      SELECT
        ${rawUsageCostExpr(cfg)} AS 'Actual Usage Cost ($)',
        ${billingCostExpr(cfg)} AS 'Billing Cost ($)',
        latest(${cfg.acv} / 12) AS 'Monthly Budget ($)',
        latest(${minCommit}) AS 'Min Commit ($)'
      FROM NrConsumption
      SINCE '${cfg.contractStart}'
      TIMESERIES 2628000 seconds`;

    return (
      <Card>
        <CardHeader
          title="Monthly Run Rate"
          subtitle="Actual Usage Cost · Billing Cost (incl. min commit floor) · Monthly Budget · Min Commit"
        />
        <CardBody>
          <LineChart
            accountIds={[accountId]}
            query={query}
            fullWidth
            style={{ height: '300px' }}
          />
        </CardBody>
      </Card>
    );
  }
}
