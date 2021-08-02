'use strict';

const Homey = require('homey');
const SilenoApiUtil = require('/lib/silenoapiutil.js');
const WebSocket = require('ws');

module.exports = class SilenoDevice extends Homey.Device {

  async onInit() {
    this.log('SilenoDevice has been initialized');

    if (!this.util) {
      this.util = new SilenoApiUtil({homey: this.homey });
    }
    this._hasBeenDeleted = false;
    this._ws = null;
    this._pingInterval = null;
    this._pingFrequencyMs = 150_000;
    this.initFlows();
    this.initWebSocket();
  }

  async initWebSocket () {
    try {
      const { id, deviceId, locationId } = this.getData();

      if (locationId) {
        const url = await this.util.getWebSocketUrl(locationId);

        this._ws = new WebSocket(url);
        this._ws.on('open', () => {
          this.log("SilenoDevice connected to WebSocket");
          this._pingInterval = setInterval(() => {
            this.log("SilenoDevice pinging WebSocket..");
            this._ws.ping();
          }, this._pingFrequencyMs);
        });

        this._ws.on('close', () => {
          if (!this._hasBeenDeleted) {
            this.log("SilenoDevice disconnected from WebSocket, reconnecting.");
            this.initWebSocket();
          }
        });

        this._ws.on('message', (msg) => {
          try {
            const message = JSON.parse(msg);
            if (message.id === id && message.type === 'MOWER') {
              const { activity, state, lastErrorCode } = message.attributes;
              this.setAvailable();
              this.updateCapablity( "mower_activity_capability", activity.value );
              this.updateCapablity( "mower_state_capability", state.value );
              this.updateCapablity( "mower_errorcode_capability", (lastErrorCode && lastErrorCode.value) || 'NO_MESSAGE' );
            } else if (message.id === deviceId && message.type === 'COMMON') {
              const { batteryLevel } = message.attributes;
              this.setAvailable();
              this.updateCapablity( "mower_battery_capability", batteryLevel.value );
            }
          } catch (err) {
            this.log("SilenoDevice WebSocket failed to parse message: " + err + " - " + msg);
          }
        });
      }

    } catch (err) {
      this.log("SilenoDevice WebSocket error, will retry: " + err);
      this.initWebSocket();
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
    this._hasBeenDeleted = true;
    if (this._pingInterval) {
        clearInterval(this._pingInterval);
    }
    if (this._ws) {
      this._ws.terminate();
    }
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('SilenoDevice settings where changed');
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