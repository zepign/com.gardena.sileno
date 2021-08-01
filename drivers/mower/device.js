'use strict';

const Homey = require('homey');
const SilenoApiUtil = require('/lib/silenoapiutil.js');

module.exports = class SilenoDevice extends Homey.Device {

  async onInit() {
    this.log('SilenoDevice has been initialized');

    if (!this.util) {
      this.util = new SilenoApiUtil({homey: this.homey });
    }

    this._timerId = null;
    this._pollingInterval = this.getSettings().polling_interval * 60000;

    this.initFlows();

    if (eval(this.getSettings().polling)) {
      this.refreshCapabilities();
    }
  }

  async onAdded() {
    this.log('SilenoDevice has been added');
  }

  async onRenamed(name) {
    this.log('SilenoDevice was renamed');
  }

  async onDeleted() {
    this.log('SilenoDevice has been deleted');
    if (this._timerId) {
        clearTimeout( this._timerId );
    }
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('SilenoDevice settings where changed');

    if (changedKeys.includes('polling_interval')) {
      if ( this._timerId ) {
        clearTimeout( this._timerId );
        this._timerId = null;
      }
      this._pollingInterval = newSettings.polling_interval * 60000;
      if (eval(this.getSettings().polling))
        this.refreshCapabilities();
    }

    if (changedKeys.includes('polling')) {
      if ( this._timerId ) {
        clearTimeout( this._timerId );
        this._timerId = null;
      }
      if (eval(newSettings.polling)) {
        this.refreshCapabilities();
      }
    }

  }

  async addCapabilityIfNeeded(capability) {
    if (!this.getCapabilities().includes(capability)) {
      this.log('Capability ' + capability + ' not found, lets call addCapability.')
      this.addCapability(capability);
    }
  }

  async initFlows() {
    this.log('SilenoDevice initalize flows');

    /* Action 'ParkUntilNextSchedule' */
    this.homey.flow.getActionCard('park_until_next_schedule')
      .registerRunListener(async (args, state) => {
        this.log('SilenoDevice FlowAction park_until_next_schedule triggered');
        const id = this.getData().id;
        const actionResult = await this.util.sendMowerAction(id, 'PARK_UNTIL_NEXT_TASK');
        return actionResult;
    });

    /* Action 'ParkUntilFurtherNotice' */
    this.homey.flow.getActionCard('park_until_further_notice')
      .registerRunListener(async (args, state) => {
        this.log('SilenoDevice FlowAction park_until_further_notice triggered');
        const id = this.getData().id;
        const actionResult = await this.util.sendMowerAction(id, 'PARK_UNTIL_FURTHER_NOTICE');
        return actionResult;
    });

    /* Action 'ResumeSchedule' */
    this.homey.flow.getActionCard('resume_schedule')
      .registerRunListener(async (args) => {
        this.log('SilenoDevice FlowAction resume_schedule triggered');
        const id = this.getData().id;
        const actionResult = await this.util.sendMowerAction(id, 'START_DONT_OVERRIDE');
        return actionResult;
    });

    /* Action 'Start' */
    this.homey.flow.getActionCard('start_duration')
      .registerRunListener(async (args, state) => {
        this.log('SilenoDevice Flowaction start_duration triggered');
        const hours = args.hours;
        const id = this.getData().id;
        const actionResult = await this.util.sendMowerAction(id, 'START_SECONDS_TO_OVERRIDE', (hours * 60 * 60));
        return actionResult;
    });

    /* Condition 'activity_is' */
    this.homey.flow.getConditionCard('activity_is')
      .registerRunListener(async (args, state) => {
        this.log('SilenoDevice Flow-condition activity_is triggered');
        return (args.activity === this.getCapabilityValue('mower_activity_capability'));
      });

    /* Condition 'state_is' */
    this.homey.flow.getConditionCard('state_is')
      .registerRunListener(async (args, state) => {
        this.log('SilenoDevice Flow-condition state_is triggered');
        return (args.state === this.getCapabilityValue('mower_state_capability'));
      });
  }

  async refreshCapabilities() {
    try {
      this.log( "SilenoDevice refreshCapabilities" );
      this.unsetWarning();

      const { id, deviceId, locationId } = this.getData();
      const mowerData = await this.util.getMower(locationId, id, deviceId);

      if (mowerData) {
        const { activity, state, lastErrorCode, batteryLevel } = mowerData;
        this.setAvailable();
        this.updateCapablity( "mower_activity_capability", activity.value );
        this.updateCapablity( "mower_state_capability", state.value );
        this.updateCapablity( "mower_errorcode_capability", (lastErrorCode && lastErrorCode.value) || 'NO_MESSAGE' );
        this.updateCapablity( "mower_battery_capability", batteryLevel.value );
      } else {
          this.setWarning( "No data received", null );
      }
    } catch (err) {
        this.log( "SilenoDevice refresh error: " + err );
        this.setWarning( "error getting mower status", null );
    }

    this._timerId = setTimeout( () =>
    {
        this.refreshCapabilities();
    }, this._pollingInterval );
  }

  async updateCapablity(capability, value) {
    const currentValue = this.getCapabilityValue(capability);
    this.setCapabilityValue( capability, value );
    if (currentValue !== value) {
      this.homey.flow.getDeviceTriggerCard(`${capability}_changed`)
        .trigger( this, {'value': value}, {})
        .catch(this.error);
    }
  }
}