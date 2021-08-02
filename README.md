# Gardena Sileno Smart

Homey app to fully control your Gardena Sileno Smart robotic mower.
Based on the excellent work by @magohl on https://github.com/magohl/com.husqvarna.automower

### Capabilities
* Activity
* State
* Errorcode
* Battery level

### Triggers
* Activity changed
* State changed
* Errorcode changed
* Battery level changed

### Conditons
* Activity is
* State is

### Actions
* Park until further notice
* Park until scheduled start
* Resume schedule
* Start for duration

### App settings
* Username
* Password
* Appkey

## Install and configure
* Register for a (free) account on the Gardena/Husqvarna developer portal https://developer.husqvarnagroup.cloud/docs/getting-started#/docs/getting-started
* Create an 'application' in the developer portal to get an appkey and connect the Gardena Smart API to the application.
* Install app in Homey (SDK3)
* Configure credentials in Homey App settings
* Add device in Homey
* Use triggers, conditions or actions in your Homey flows or check status in the device overview.

### Rate limitations
There is a rate limitation of 3000 calls per month and account for the Gardena Smart API, as this app relies on Gardenas WebSocket API for realtime status updates this rate limitation should not be an issue.
