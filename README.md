ble-mesh-serial-interface-js
=========

An npm package for Node.js that provides an API to control a router node in a BLE mesh network via the serial port.

## Installation

  `npm install ble-mesh-serial-interface-js`

## Usage

```javascript
'use strict';

const BLEMeshSerialInterface = require('ble-mesh-serial-interface-js');

const MESH_ACCESS_ADDR = 0x8E89BED6;
const MESH_INTERVAL_MIN_MS = 100;
const MESH_CHANNEL = 38;

let portOpen = () => {
  console.log('Serial port opened!');
  bleMeshSerialInterfaceAPI.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_CHANNEL, initCallback);
  bleMeshSerialInterfaceAPI.accessAddrGet(accessAddrCallback);
}

const bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface('COM44', portOpen);

let initCallback = err => {
  if (err) {
    console.log(err);
  }
  console.log('nRF Open Mesh initialized!');
}

let accessAddrCallback = (err, res) => {
  if (err) {
    console.log(err);
  }
  console.log('Access Address: ', res.toString('hex'));
}
```

## Tests

  `npm test`

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.
