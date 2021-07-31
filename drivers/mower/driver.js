'use strict';

const Homey = require('homey');
const SilenoApiUtil = require('/lib/silenoapiutil.js');

module.exports = class SilenoDriver extends Homey.Driver {

  async onInit() {
    this.log('SilenoDriver has been initialized');
    if (!this.util) {
      this.util = new SilenoApiUtil({homey: this.homey });
    }
  }

  async onPairListDevices() {
    const mowers = await this.util.listMowers();
    return mowers;
  }
}