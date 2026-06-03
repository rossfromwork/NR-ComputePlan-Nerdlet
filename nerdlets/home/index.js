import React from 'react';
import {
  AccountPicker,
  AccountStorageQuery,
  UserStorageQuery,
  UserStorageMutation,
  Spinner,
  HeadingText,
  BlockText,
  Card,
  CardBody,
} from 'nr1';
import ConfigScreen from './components/ConfigScreen';
import Dashboard from './components/Dashboard';

const USER_COLLECTION = 'computePlanPrefs';
const USER_DOC = 'lastAccount';

export default class ComputePlanNerdlet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      accountId: null,
      config: null,
      existingConfig: null,
      isEditing: false,
      bootstrapping: true,
      configLoading: false,
      configError: null,
    };
    this.handleAccountChange = this.handleAccountChange.bind(this);
    this.handleConfigSaved = this.handleConfigSaved.bind(this);
    this.handleEditConfig = this.handleEditConfig.bind(this);
    this.handleChangeAccount = this.handleChangeAccount.bind(this);
  }

  async componentDidMount() {
    // Try to restore the last used account from UserStorage and auto-load its config.
    // Race against a 4s timeout so a hanging promise never blocks the UI.
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      );
      const { data } = await Promise.race([
        UserStorageQuery.query({
          collection: USER_COLLECTION,
          documentId: USER_DOC,
        }),
        timeout,
      ]);
      if (data && data.accountId) {
        await this.loadConfigForAccount(data.accountId);
        return;
      }
    } catch (_) {
      // UserStorage miss, unavailable, or timeout — fall through to picker
    }
    this.setState({ bootstrapping: false });
  }

  async loadConfigForAccount(accountId) {
    this.setState({ accountId, config: null, existingConfig: null, configLoading: true, configError: null });
    try {
      const { data, errors } = await AccountStorageQuery.query({
        accountId,
        collection: 'computePlanConfig',
        documentId: 'contractSettings',
      });
      if (errors && errors.length > 0) {
        this.setState({ bootstrapping: false, configLoading: false, configError: errors[0].message });
        return;
      }
      this.setState({ bootstrapping: false, configLoading: false, config: data || null });
    } catch (e) {
      this.setState({ bootstrapping: false, configLoading: false, configError: e.message });
    }
  }

  async handleAccountChange(accountId) {
    if (!accountId) {
      this.setState({ accountId: null, config: null, existingConfig: null });
      return;
    }
    // Persist the chosen account so next load auto-restores it
    UserStorageMutation.mutate({
      actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
      collection: USER_COLLECTION,
      documentId: USER_DOC,
      document: { accountId },
    });
    await this.loadConfigForAccount(accountId);
  }

  handleConfigSaved(config) {
    this.setState({ config, existingConfig: config, isEditing: false });
  }

  handleEditConfig() {
    this.setState(prev => ({ isEditing: true, existingConfig: prev.config }));
  }

  handleChangeAccount() {
    this.setState({
      accountId: null,
      config: null,
      existingConfig: null,
      isEditing: false,
      configError: null,
    });
    UserStorageMutation.mutate({
      actionType: UserStorageMutation.ACTION_TYPE.DELETE_DOCUMENT,
      collection: USER_COLLECTION,
      documentId: USER_DOC,
    });
  }

  render() {
    const { accountId, config, existingConfig, isEditing, bootstrapping, configLoading, configError } = this.state;

    if (bootstrapping || configLoading) {
      return (
        <div className="compute-plan-root">
          <Spinner />
        </div>
      );
    }

    if (!accountId) {
      return (
        <div className="compute-plan-root">
          <div className="welcome-screen">
            <HeadingText type={HeadingText.TYPE.HEADING_3}>
              Compute Savings Plan
            </HeadingText>
            <BlockText type={BlockText.TYPE.PARAGRAPH}>
              Track your New Relic Compute contract drawdown, Flexpool balance, and projected end date.
              Select the account you want to analyse to get started.
            </BlockText>
            <div className="welcome-picker">
              <AccountPicker
                value={null}
                onChange={(_, value) => this.handleAccountChange(value)}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="compute-plan-root">
        <div className="compute-plan-header">
          <HeadingText type={HeadingText.TYPE.HEADING_3}>
            Compute Savings Plan
          </HeadingText>
        </div>

        {configError && (
          <Card>
            <CardBody>
              <BlockText>Error loading config: {configError}</BlockText>
            </CardBody>
          </Card>
        )}

        {!configError && (isEditing || !config) && (
          <ConfigScreen
            key={isEditing ? 'edit' : 'new'}
            accountId={accountId}
            existingConfig={existingConfig}
            onSaved={this.handleConfigSaved}
            onCancel={isEditing ? () => this.setState({ isEditing: false }) : undefined}
            onChangeAccount={this.handleChangeAccount}
          />
        )}

        {!configError && config && !isEditing && (
          <Dashboard
            accountId={accountId}
            config={config}
            onEditConfig={this.handleEditConfig}
          />
        )}
      </div>
    );
  }
}
