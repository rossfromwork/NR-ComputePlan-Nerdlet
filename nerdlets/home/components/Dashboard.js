import React from 'react';
import PropTypes from 'prop-types';
import { Button, HeadingText, BlockText } from 'nr1';
import OverviewKPIs from './OverviewKPIs';
import RunRateChart from './RunRateChart';
import FlexpoolTimeSeries from './FlexpoolTimeSeries';
import BurnRatePredictor from './BurnRatePredictor';
import MonthlyTable from './MonthlyTable';

export default class Dashboard extends React.Component {
  static propTypes = {
    accountId: PropTypes.number.isRequired,
    config: PropTypes.object.isRequired,
    onEditConfig: PropTypes.func.isRequired,
  };

  render() {
    const { accountId, config, onEditConfig } = this.props;

    return (
      <div className="dashboard">
        <div className="dashboard-meta-bar">
          <div className="dashboard-meta-info">
            <HeadingText type={HeadingText.TYPE.HEADING_5}>
              {config.contractStart} → {config.contractEnd}
            </HeadingText>
            <BlockText type={BlockText.TYPE.PARAGRAPH}>
              ACV: <strong>${Number(config.acv).toLocaleString()}</strong> &nbsp;|&nbsp;
              Total Commitment: <strong>${Number(config.totalCommitment).toLocaleString()}</strong> &nbsp;|&nbsp;
              Annual Flex Pool: <strong>${Number(config.flexpool).toLocaleString()}</strong>
            </BlockText>
          </div>
          <Button
            type={Button.TYPE.NORMAL}
            sizeType={Button.SIZE_TYPE.SMALL}
            iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__EDIT}
            onClick={onEditConfig}
          >
            Edit Config
          </Button>
        </div>

        <OverviewKPIs accountId={accountId} config={config} />

        <div className="chart-row-two-col">
          <div className="chart-col-wide">
            <RunRateChart accountId={accountId} config={config} />
          </div>
          <div className="chart-col-narrow">
            <BurnRatePredictor accountId={accountId} config={config} />
          </div>
        </div>

        <FlexpoolTimeSeries accountId={accountId} config={config} />

        <MonthlyTable accountId={accountId} config={config} />
      </div>
    );
  }
}
