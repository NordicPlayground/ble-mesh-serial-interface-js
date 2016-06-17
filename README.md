ble-mesh-serial-interface-js
=========

An npm package for Node.js that provides an API to control a router node in a BLE mesh network via the serial port.

## Installation

  `npm install @mjdietzx/ble-mesh-serial-interface-js`

## Usage

    var bleMeshSerialInterfaceAPI = require('@mjdietzx/ble-mesh-serial-interface-js');

    var echo_result = bleMeshSerialInterfaceAPI.echo('Hello BLE Mesh!');


  Output should be `Hello BLE Mesh!`


## Tests

  `npm test`

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.
