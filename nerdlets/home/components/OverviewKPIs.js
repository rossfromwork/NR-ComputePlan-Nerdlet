import React from 'react';
import PropTypes from 'prop-types';
import { BillboardChart, Grid, GridItem, HeadingText } from 'nr1';
import { billingCostExpr, excessCostExpr } from './nrqlCost';

export default class OverviewKPIs extends React.Component {
  static propTypes = {
    accountId: PropTypes.number.isRequired,
    config: PropTypes.object.isRequired,
  };

  render() {
    const { accountId, config: cfg } = this.props;
    const since = `SINCE '${cfg.contractStart}'`;

    const spendToDateQuery = `
      SELECT sum(monthlyCost) AS 'Spend to Date ($)'
      FROM (
        SELECT ${billingCostExpr(cfg)} AS monthlyCost
        FROM NrConsumption FACET \`month\` LIMIT MAX
      ) ${since} LIMIT MAX`;

    const flexpoolQuery = `
      SELECT (${cfg.flexpool} * ceil(count(*) / 12)) - sum(monthlyExcess) AS 'Flex Pool Balance ($)'
      FROM (
        SELECT ${excessCostExpr(cfg)} AS monthlyExcess
        FROM NrConsumption FACET \`month\` LIMIT MAX
      ) ${since} LIMIT MAX`;

    const budgetedQuery = `
      SELECT uniqueCount(\`month\`) * (${cfg.acv}/12) AS 'Budgeted Spend ($)'
      FROM NrConsumption ${since} LIMIT MAX`;

    return (
      <div className="kpi-row">
        <Grid>
          <GridItem columnSpan={4}>
            <div className="kpi-card">
              <HeadingText type={HeadingText.TYPE.HEADING_6}>Spend to Date</HeadingText>
              <BillboardChart
                accountIds={[accountId]}
                query={spendToDateQuery}
                fullWidth
                limit={cfg.totalCommitment}
              />
            </div>
          </GridItem>
          <GridItem columnSpan={4}>
            <div className="kpi-card">
              <HeadingText type={HeadingText.TYPE.HEADING_6}>Flex Pool Balance</HeadingText>
              <BillboardChart
                accountIds={[accountId]}
                query={flexpoolQuery}
                fullWidth
                thresholds={[
                  { alertSeverity: 'SUCCESS', value: 1 },
                  { alertSeverity: 'WARNING', value: 0 },
                  { alertSeverity: 'CRITICAL', value: -999999999 },
                ]}
              />
            </div>
          </GridItem>
          <GridItem columnSpan={4}>
            <div className="kpi-card">
              <HeadingText type={HeadingText.TYPE.HEADING_6}>Budgeted Contract Spend</HeadingText>
              <BillboardChart
                accountIds={[accountId]}
                query={budgetedQuery}
                fullWidth
                limit={cfg.totalCommitment}
              />
            </div>
          </GridItem>
        </Grid>
      </div>
    );
  }
}
