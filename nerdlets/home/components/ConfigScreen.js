import React from 'react';
import PropTypes from 'prop-types';
import {
  AccountStorageMutation,
  HeadingText,
  BlockText,
  TextField,
  Button,
  Card,
  CardBody,
  CardHeader,
  Grid,
  GridItem,
  Toast,
  Icon,
} from 'nr1';

const FIELDS = [
  {
    section: 'Contract Terms',
    fields: [
      { key: 'contractStart', label: 'Contract Start Date', placeholder: 'YYYY-MM-DD', hint: 'e.g. 2026-01-01' },
      { key: 'contractEnd', label: 'Contract End Date', placeholder: 'YYYY-MM-DD', hint: 'e.g. 2028-12-31' },
      { key: 'acv', label: 'Annual Contract Value ($)', placeholder: '475000', hint: 'Total ACV per year in USD' },
      { key: 'totalCommitment', label: 'Total Contract Value ($)', placeholder: '1425000', hint: 'Full contract value over all years' },
      { key: 'flexpool', label: 'Annual Flex Pool ($)', placeholder: '24140', hint: 'Annual pool drawn down when monthly spend exceeds min commit' },
    ],
  },
  {
    section: 'Core CCU Tiers',
    // Each tier row has: label, qtyKey (or null), rateKey (or null), qtyStatic, rateStatic
    tiers: [
      {
        tier: 'Tier 1',
        hint: 'Monthly minimum commit — billed at this quantity × rate regardless of actual usage',
        qtyKey: 't1Qty', qtyPlaceholder: '10500', qtyLabel: 'Quantity (CCU/mo)',
        rateKey: 't1Rate', ratePlaceholder: '1.20', rateLabel: 'Rate ($/CCU)',
      },
      {
        tier: 'Tier 2',
        hint: 'Additional CCU quantity above Tier 1 at a separate rate (may be $0 for some contracts)',
        qtyKey: 't2Qty', qtyPlaceholder: '4000', qtyLabel: 'Quantity (CCU/mo)',
        rateKey: 't2Rate', ratePlaceholder: '0.00', rateLabel: 'Rate ($/CCU)',
      },
      {
        tier: 'Tier 3',
        hint: 'Billed per CCU consumed above Tier 1 + Tier 2 combined — no quantity cap',
        qtyKey: null, qtyStatic: 'No cap — all overage',
        rateKey: 't3Rate', ratePlaceholder: '1.15', rateLabel: 'Rate ($/CCU)',
      },
    ],
  },
  {
    section: 'Advanced CCU',
    fields: [
      { key: 'accuCommitQty', label: 'Advanced CCU Commit (qty)', placeholder: '0', hint: 'Monthly committed Advanced CCU quantity' },
      { key: 'accuRate', label: 'Advanced CCU Rate ($/CCU)', placeholder: '0.45', hint: 'Price per Advanced CCU' },
    ],
  },
  {
    section: 'Data Ingest',
    fields: [
      { key: 'dataCommitQty', label: 'Data Commit (GB/month)', placeholder: '82239', hint: 'Monthly committed data ingest in GB' },
      { key: 'dataRate', label: 'Data Rate ($/GB)', placeholder: '0.30', hint: 'Price per GB of data ingest' },
    ],
  },
];

function fmt(n) {
  return '$' + Math.round(n).toLocaleString();
}

export default class ConfigScreen extends React.Component {
  static propTypes = {
    accountId: PropTypes.number.isRequired,
    onSaved: PropTypes.func.isRequired,
    existingConfig: PropTypes.object,
    onCancel: PropTypes.func,
    onChangeAccount: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const defaults = props.existingConfig || {};
    this.state = {
      saving: false,
      contractStart: defaults.contractStart || '',
      contractEnd: defaults.contractEnd || '',
      acv: defaults.acv !== undefined ? String(defaults.acv) : '',
      totalCommitment: defaults.totalCommitment !== undefined ? String(defaults.totalCommitment) : '',
      flexpool: defaults.flexpool !== undefined ? String(defaults.flexpool) : '',
      t1Qty: defaults.t1Qty !== undefined ? String(defaults.t1Qty) : '',
      t1Rate: defaults.t1Rate !== undefined ? String(defaults.t1Rate) : '',
      t2Qty: defaults.t2Qty !== undefined ? String(defaults.t2Qty) : '',
      t2Rate: defaults.t2Rate !== undefined ? String(defaults.t2Rate) : '',
      t3Rate: defaults.t3Rate !== undefined ? String(defaults.t3Rate) : '',
      accuCommitQty: defaults.accuCommitQty !== undefined ? String(defaults.accuCommitQty) : '',
      accuRate: defaults.accuRate !== undefined ? String(defaults.accuRate) : '',
      dataCommitQty: defaults.dataCommitQty !== undefined ? String(defaults.dataCommitQty) : '',
      dataRate: defaults.dataRate !== undefined ? String(defaults.dataRate) : '',
    };
  }

  handleChange(key, value) {
    this.setState({ [key]: value });
  }

  // Returns array of { type: 'warning'|'info', message, detail } objects
  computeWarnings() {
    const warnings = [];
    const s = this.state;

    const acv = parseFloat(s.acv);
    const tcv = parseFloat(s.totalCommitment);
    const flexpool = parseFloat(s.flexpool) || 0;
    const t1Qty = parseFloat(s.t1Qty) || 0;
    const t1Rate = parseFloat(s.t1Rate) || 0;
    const accuCommitQty = parseFloat(s.accuCommitQty) || 0;
    const accuRate = parseFloat(s.accuRate) || 0;
    const dataCommitQty = parseFloat(s.dataCommitQty) || 0;
    const dataRate = parseFloat(s.dataRate) || 0;

    // 1. TCV should be an exact whole-year multiple of ACV
    if (acv > 0 && tcv > 0) {
      const termYears = tcv / acv;
      const rounded = Math.round(termYears);
      if (Math.abs(termYears - rounded) > 0.01) {
        warnings.push({
          type: 'warning',
          message: 'TCV is not an even multiple of ACV',
          detail: `${fmt(tcv)} ÷ ${fmt(acv)} = ${termYears.toFixed(2)} years. Did you mean a ${rounded}-year term (TCV = ${fmt(acv * rounded)})?`,
        });
      } else {
        warnings.push({
          type: 'info',
          message: `Contract term: ${rounded} year${rounded !== 1 ? 's' : ''}`,
          detail: `${fmt(tcv)} ÷ ${fmt(acv)} = ${rounded} years ✓`,
        });
      }
    }

    // 2. Monthly min commit + flexpool should reconcile to ACV
    // Annual min commit = (t1 cost + accu cost + data cost) * 12
    // ACV ≈ annualMinCommit + flexpool
    if (acv > 0 && (t1Qty > 0 || dataCommitQty > 0)) {
      const monthlyMinCommit = (t1Qty * t1Rate) + (accuCommitQty * accuRate) + (dataCommitQty * dataRate);
      const annualMinCommit = monthlyMinCommit * 12;
      const impliedACV = annualMinCommit + flexpool;
      const variance = Math.abs(impliedACV - acv);
      const variancePct = acv > 0 ? (variance / acv) * 100 : 0;

      if (variancePct > 1) {
        warnings.push({
          type: 'warning',
          message: 'Min commit + Flex Pool does not reconcile with ACV',
          detail: `Monthly min commit ${fmt(monthlyMinCommit)}/mo × 12 = ${fmt(annualMinCommit)}, plus Flex Pool ${fmt(flexpool)} = ${fmt(impliedACV)} — but ACV is ${fmt(acv)} (${variancePct.toFixed(1)}% variance). Check your rates and quantities.`,
        });
      } else if (acv > 0 && t1Qty > 0) {
        warnings.push({
          type: 'info',
          message: 'Min commit reconciles with ACV',
          detail: `${fmt(monthlyMinCommit)}/mo × 12 + ${fmt(flexpool)} Flex Pool = ${fmt(impliedACV)} ≈ ACV ${fmt(acv)} ✓`,
        });
      }
    }

    return warnings;
  }

  validate() {
    const { contractStart, contractEnd, acv, totalCommitment } = this.state;
    if (!contractStart.match(/^\d{4}-\d{2}-\d{2}$/)) return 'Contract Start Date must be in YYYY-MM-DD format';
    if (!contractEnd.match(/^\d{4}-\d{2}-\d{2}$/)) return 'Contract End Date must be in YYYY-MM-DD format';
    if (!acv || isNaN(parseFloat(acv))) return 'Annual Contract Value must be a number';
    if (!totalCommitment || isNaN(parseFloat(totalCommitment))) return 'Total Contract Value must be a number';
    return null;
  }

  async handleSave() {
    const err = this.validate();
    if (err) {
      Toast.showToast({ title: 'Validation error', description: err, type: Toast.TYPE.CRITICAL });
      return;
    }
    this.setState({ saving: true });
    const config = {
      contractStart: this.state.contractStart,
      contractEnd: this.state.contractEnd,
      acv: parseFloat(this.state.acv),
      totalCommitment: parseFloat(this.state.totalCommitment),
      flexpool: parseFloat(this.state.flexpool) || 0,
      t1Qty: parseFloat(this.state.t1Qty) || 0,
      t1Rate: parseFloat(this.state.t1Rate) || 0,
      t2Qty: parseFloat(this.state.t2Qty) || 0,
      t2Rate: parseFloat(this.state.t2Rate) || 0,
      t3Rate: parseFloat(this.state.t3Rate) || 0,
      accuCommitQty: parseFloat(this.state.accuCommitQty) || 0,
      accuRate: parseFloat(this.state.accuRate) || 0,
      dataCommitQty: parseFloat(this.state.dataCommitQty) || 0,
      dataRate: parseFloat(this.state.dataRate) || 0,
    };
    try {
      const { errors } = await AccountStorageMutation.mutate({
        accountId: this.props.accountId,
        actionType: AccountStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
        collection: 'computePlanConfig',
        documentId: 'contractSettings',
        document: config,
      });
      if (errors && errors.length > 0) throw new Error(errors[0].message);
      Toast.showToast({ title: 'Config saved', description: 'Contract settings saved successfully.', type: Toast.TYPE.NORMAL });
      this.props.onSaved(config);
    } catch (e) {
      Toast.showToast({ title: 'Save failed', description: e.message, type: Toast.TYPE.CRITICAL });
    }
    this.setState({ saving: false });
  }

  render() {
    const { saving } = this.state;
    const isEdit = !!this.props.existingConfig;
    const { accountId, onChangeAccount } = this.props;
    const warnings = this.computeWarnings();
    const hasBlockingWarnings = warnings.some(w => w.type === 'warning');

    return (
      <div className="config-screen">
        <div className="config-screen-account-bar">
          <span className="config-screen-account-label">Account: <strong>{accountId}</strong></span>
          {onChangeAccount && (
            <Button
              type={Button.TYPE.PLAIN}
              sizeType={Button.SIZE_TYPE.SMALL}
              onClick={onChangeAccount}
            >
              Change Account
            </Button>
          )}
        </div>
        <div className="config-screen-intro">
          <HeadingText type={HeadingText.TYPE.HEADING_4}>
            {isEdit ? 'Edit Contract Settings' : 'Welcome — Set Up Your Contract'}
          </HeadingText>
          <BlockText>
            {isEdit
              ? 'Update the contract parameters below. Changes take effect immediately.'
              : 'Enter your Compute Savings Plan contract details below. These values are saved to your account and used to calculate cost, Flexpool balance, and burn rate across all charts.'}
          </BlockText>
        </div>

        {warnings.length > 0 && (
          <Card className="config-validation-card">
            <CardHeader title="Contract Reconciliation" />
            <CardBody>
              <div className="config-warnings-list">
                {warnings.map((w, i) => (
                  <div key={i} className={`config-warning-item config-warning-${w.type}`}>
                    <div className="config-warning-icon">
                      {w.type === 'warning' ? '⚠️' : '✓'}
                    </div>
                    <div className="config-warning-text">
                      <strong>{w.message}</strong>
                      <span>{w.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {FIELDS.map(({ section, fields, tiers }) => (
          <Card key={section} className="config-section-card">
            <CardHeader title={section} />
            <CardBody>
              {fields && (
                <Grid>
                  {fields.map(({ key, label, placeholder, hint }) => (
                    <GridItem key={key} columnSpan={6}>
                      <TextField
                        label={label}
                        placeholder={placeholder}
                        description={hint}
                        value={this.state[key]}
                        onChange={(e) => this.handleChange(key, e.target.value)}
                      />
                    </GridItem>
                  ))}
                </Grid>
              )}
              {tiers && (
                <div className="ccu-tiers-table">
                  <div className="ccu-tiers-header">
                    <div className="ccu-tier-col-label">Tier</div>
                    <div className="ccu-tier-col-field">Quantity (CCU/mo)</div>
                    <div className="ccu-tier-col-field">Rate ($/CCU)</div>
                  </div>
                  {tiers.map(({ tier, hint, qtyKey, qtyPlaceholder, qtyLabel, qtyStatic, rateKey, ratePlaceholder, rateLabel, rateStatic }) => (
                    <div key={tier} className="ccu-tier-row">
                      <div className="ccu-tier-col-label">
                        <strong>{tier}</strong>
                        <span>{hint}</span>
                      </div>
                      <div className="ccu-tier-col-field">
                        {qtyKey ? (
                          <TextField
                            placeholder={qtyPlaceholder}
                            value={this.state[qtyKey]}
                            onChange={(e) => this.handleChange(qtyKey, e.target.value)}
                          />
                        ) : (
                          <span className="ccu-tier-static">{qtyStatic}</span>
                        )}
                      </div>
                      <div className="ccu-tier-col-field">
                        {rateKey ? (
                          <TextField
                            placeholder={ratePlaceholder}
                            value={this.state[rateKey]}
                            onChange={(e) => this.handleChange(rateKey, e.target.value)}
                          />
                        ) : (
                          <span className="ccu-tier-static">{rateStatic}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        ))}

        <div className="config-actions">
          {hasBlockingWarnings && (
            <span className="config-warning-hint">
              Warnings above won't block save — review before continuing.
            </span>
          )}
          {isEdit && this.props.onCancel && (
            <Button
              type={Button.TYPE.NORMAL}
              disabled={saving}
              onClick={this.props.onCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            type={Button.TYPE.PRIMARY}
            loading={saving}
            onClick={() => this.handleSave()}
          >
            {isEdit ? 'Save Changes' : 'Save & Continue'}
          </Button>
        </div>
      </div>
    );
  }
}
