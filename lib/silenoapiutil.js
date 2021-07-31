'use strict';

const fetch = require('node-fetch');
const baseLoginApiUrl = 'https://api.authentication.husqvarnagroup.dev/v1';
const baseMowerApiUrl = 'https://api.smart.gardena.dev/v1';
const { uid } = require('uid');

module.exports = class SilenoApiUtil {

  constructor(opts) {
    this.homey = opts.homey;
  }

  /* Login */
  /* TODO: Switch to AuthorizationCode + refreshtoken flow */
  async login() {
    const username = this.homey.settings.get('username');
    const password = this.homey.settings.get('password');
    const appkey = this.homey.settings.get('appkey');

    if (!username || !password  || !appkey) {
      this.homey.error('Credentials not configured in the app settnings');
      throw new Error('Please configure Husqvarna/Gardena Api credentials in app settings first, then try again!');
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'password');
    params.set('client_id', appkey);
    params.set('username', username);
    params.set('password', password);

    const res = await fetch(`${baseLoginApiUrl}/oauth2/token`, {
      method: 'POST',
      body: params
    })
    .catch(err => {
      this.homey.error(err);
    })
    .then(function(response) {
      if (response.status >= 400 && response.status < 600) {
        this.homey.error(`Server responeded with http/${response.status}`);
        throw new Error("Bad response from API. Check credentials and connection and try again!");
      }
      return response;
    });

    return res.json();

  }

  /* List mowers */
  async listMowers() {
    let appkey = this.homey.settings.get('appkey');

    let token = await this.login();

    const requestOptions = {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'X-Api-Key': appkey,
        'Authorization-Provider': 'husqvarna'
      }
    };

    const locations = await fetch(`${baseMowerApiUrl}/locations`, requestOptions)
      .then(function(response) {
        if (response.status >= 400 && response.status < 600) {
          this.homey.error(`Server responeded with http/${response.status}`);
          throw new Error("Bad response from API. Check credentials and connection and try again!");
        }
        return response;
      })
      .then(res => res.text())
      .then(text => JSON.parse(text))
      .catch(err => {
        this.homey.error(err)
      });


    const locationIds = locations.data.map(location => location.id);

    const mowers = await Promise.all(
      locationIds.map(
          locationId => fetch(`${baseMowerApiUrl}/locations/${locationId}`, requestOptions)
                .then(function(response) {
                  if (response.status >= 400 && response.status < 600) {
                    this.homey.error(`Server responeded with http/${response.status}`);
                    throw new Error("Bad response from API. Check credentials and connection and try again!");
                  }
                  return response;
                })
                .then(res => res.text())
                .then(text => JSON.parse(text))
                .then(locationData => {
                    const mowerIds = locationData.included
                      .filter(included => included.type === 'MOWER')
                      .map(
                        mower => ({
                          deviceId: mower.relationships.device.data.id,
                          mowerId: mower.id
                        })
                      );

                    return mowerIds.map(
                        mowerId => {
                          const commonAttrs = locationData.included.find(included => included.id === mowerId.deviceId && included.type === 'COMMON');
                          return ({
                            name: commonAttrs.attributes.name.value,
                            data: {
                              id: mowerId.mowerId,
                              deviceId: mowerId.deviceId,
                              serial: commonAttrs.attributes.serial.value,
                              model: commonAttrs.attributes.modelType.value,
                              locationId,
                            }
                          });
                        }
                    );
                })
                .catch(err => {
                  this.homey.error(err)
                })
              )
    );
    return mowers.flat();
  }

  /* Get mower status */
  async getMower(locationId, mowerId, deviceId) {
    let appkey = this.homey.settings.get('appkey');
    let token = await this.login();

    const requestOptions = {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'X-Api-Key': appkey,
        'Authorization-Provider': 'husqvarna'
      }
    };

    const locationData = await fetch(`${baseMowerApiUrl}/locations/${locationId}`, requestOptions)
      .then(function(response) {
        if (response.status >= 400 && response.status < 600) {
          this.homey.error(`Server responeded with http/${response.status}`);
          throw new Error("Bad response from API. Check credentials and connection and try again!");
        }
        return response;
      })
      .then(res => res.text())
      .then(text => JSON.parse(text))
      .catch(err => {
        this.homey.error(err);
        throw new Error(err);
      });

    const mowerAttrs = locationData.included.find(included => included.id === mowerId).attributes;
    const commonAttrs = locationData.included.find(included => included.id === deviceId && included.type === 'COMMON').attributes;

    return { ...mowerAttrs, ...commonAttrs };
  }

  /*
  START_SECONDS_TO_OVERRIDE - Manual operation, use 'seconds' attribute to define duration.
  START_DONT_OVERRIDE - Automatic operation.
  PARK_UNTIL_NEXT_TASK - Cancel the current operation and return to charging station.
  PARK_UNTIL_FURTHER_NOTICE - Cancel the current operation, return to charging station, ignore schedule.
  */
  async sendMowerAction(mowerId, command, seconds) {
    let appkey = this.homey.settings.get('appkey');
    let token = await this.login();

    const data = {
      data: {
        id: uid(),
        type: 'MOWER_CONTROL',
        attributes: {
          command,
          seconds
        }
      }
    }

    const requestOptions = {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'X-Api-Key': appkey,
        'Authorization-Provider': 'husqvarna',
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify(data)
    };

    const res = await fetch(`${baseMowerApiUrl}/command/${mowerId}`, requestOptions)
      .catch(err => {
        this.homey.error(err);
        throw new Error(err);
      })
      .then(function(response) {
        if (response.status >= 400 && response.status < 600) {
          this.homey.error(`Server responeded with http/${response.status}`);
          throw new Error("Bad response from API. Check credentials and connection and try again!");
        }
        return response;
      });

      return true;
  }

}