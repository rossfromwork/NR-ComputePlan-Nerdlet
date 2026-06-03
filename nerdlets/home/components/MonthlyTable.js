import React from 'react';
import PropTypes from 'prop-types';
import { TableChart, Card, CardHeader, CardBody } from 'nr1';
import { CORE_CCU, ADVU_CCU, GB_INGEST } from './nrqlCost';

export default class MonthlyTable extends React.Component {
  static propTypes = {
    accountId: PropTypes.number.isRequired,
    config: PropTypes.object.isRequired,
  };

  render() {
    const { accountId, config: cfg } = this.props;

    // Tier 2 band expression: usage between t1Qty and t1Qty+t2Qty
    const t2Band = `(clamp_min(${CORE_CCU} - ${cfg.t1Qty}, 0) - clamp_min(${CORE_CCU} - ${cfg.t1Qty} - ${cfg.t2Qty}, 0))`;

    const coreCcuCost = `(
      ${cfg.t1Qty} * ${cfg.t1Rate}
      + ${t2Band} * ${cfg.t2Rate}
      + clamp_min(${CORE_CCU} - ${cfg.t1Qty} - ${cfg.t2Qty}, 0) * ${cfg.t3Rate}
    )`;

    const advCcuCost = `(clamp_min(${ADVU_CCU}, ${cfg.accuCommitQty}) * ${cfg.accuRate})`;
    const dataCost = `(clamp_min(${GB_INGEST}, ${cfg.dataCommitQty}) * ${cfg.dataRate})`;

    const query = `
      SELECT
        ${CORE_CCU} AS 'Core CCU Qty',
        ${coreCcuCost} AS 'Core CCU $',
        ${ADVU_CCU} AS 'Adv CCU Qty',
        ${advCcuCost} AS 'Adv CCU $',
        ${GB_INGEST} AS 'GB Ingested',
        ${dataCost} AS 'GB Ingest $',
        (${coreCcuCost} + ${advCcuCost} + ${dataCost}) AS 'Total $',
        earliest(timestamp) AS 'Sort'
      FROM NrConsumption
      FACET \`month\`
      SINCE '${cfg.contractStart}'
      LIMIT MAX`;

    return (
      <Card>
        <CardHeader title="Monthly Spend Breakdown" />
        <CardBody>
          <TableChart
            accountIds={[accountId]}
            query={query}
            fullWidth
          />
        </CardBody>
      </Card>
    );
  }
}
