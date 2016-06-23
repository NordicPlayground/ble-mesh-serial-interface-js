'use strict';

const assert = require('assert');
const EventEmitter = require('events');

const SerialPort = require('serialport');

const commandOpCodes = {
  'ECHO': 0x02,
  'RADIO_RESET': 0x0e,
  'INIT': 0x70,
  'START': 0x74,
  'STOP': 0x75,
  'VALUE_SET': 0x71,
  'VALUE_ENABLE': 0x72,
  'VALUE_DISABLE': 0x73,
  'VALUE_GET': 0x7a,
  'BUILD_VERSION_GET': 0x7b,
  'ACCESS_ADDR_GET': 0x7c,
  'CHANNEL_GET': 0x7d,
  'INTERVAL_MIN_GET': 0x7f
};

const responseOpCodes = {
  'DEVICE_STARTED': 0x81,
  'ECHO': 0x82,
  'CMD_RSP': 0x84
};

const statusCodes = {
  'SUCCESS': 0x0
};


class BLEMeshSerialInterface extends EventEmitter {
  /**
   * Connects to the serialPort with the specified buadRate and rtscts. Registers port event listeners. Sets up internal command queue.
   */
  constructor(serialPort, baudRate=115200, rtscts=true) {
    super();

    /**
     * Array of objects (expectedResponse, callback, response, responseLength) used as a queue.
     *
     * Every time the host sends a command to the slave device, the expected response of that command and the callback to be called when the response
     * is received will be pushed to this queue. Then they will be shifted out as data responses are received from the slave.
     */
    this._queue = [];

    this._port = new SerialPort.SerialPort(serialPort, { // 'COM44', {
      baudRate: baudRate, // 115200
      rtscts: rtscts // true
    });

    this._port.on('error', err => {
      if (err) {
        console.log('error: ', err.message);
      }
    });

    this._port.on('data', data => {
      this.buildResponse(data, 0);

      /**
       * Check response, multiple responses may have been received in a data event so iterate through all complete responses in the global queue.
       */
      while (true) { // checkResponseAndExecuteCallback shifts the queue so always access queue[0].
        if (this._queue[0].response === null) {
          return;
        } else if (this._queue[0].responseLength !== this._queue[0].response.length) {
          return;
        } else {
          this.checkResponseAndExecuteCallback(); // Shifts out the next element in the queue.
        }
      }
    });
  }

  /**
   * Recursive function to build a complete response from the slave when the response is divided amongst data events and/or multiple responses (or parts of responses)
   * arrive in a single data event. Stores the response and it's associated length in the global queue.
   */
  buildResponse(data, queueIndex) {
    if (this._queue[queueIndex].response === null) {
      this._queue[queueIndex].response = Buffer.from([]);
      this._queue[queueIndex].responseLength = data[0] + 1; // The first byte in the response, data[0], stores the length of the rest of the response in bytes.
    }

    const remainingLength = this._queue[queueIndex].responseLength - this._queue[queueIndex].response.length;

    if (remainingLength >= data.length) {
      this._queue[queueIndex].response = Buffer.concat([this._queue[queueIndex].response, data]);
    } else if (remainingLength < data.length) { // Multiple responses have been joined into this data event.
      this._queue[queueIndex].response = Buffer.concat([this._queue[queueIndex].response, data.slice(0, remainingLength)]);
      this.buildResponse(data.slice(remainingLength), queueIndex + 1);
    }
  }

  /**
   * This checks the complete response stored in the global queue against it's corresponding expected response. Then it executes the corresponding callback
   * with an error and or data.
   *
   * Note: This modifies the global queue by shifting out the next element.
   */
  checkResponseAndExecuteCallback() {
    const command = this._queue.shift();

    if (command.response.slice(0, command.expectedResponse.length).equals(command.expectedResponse)) {
      command.callback(null, command.response.slice(command.expectedResponse.length));
    } else {
      console.log('command.expectedResponse: ', command.expectedResponse);
      console.log('command.response: ', command.response);
      command.callback(new Error(`unexpected command.response from slave device: ${command.response.toString('hex')}`));
    }
  }

  /**
   * Adds the command to the global queue and writes the command to the slave.
   */
  execute(command, expectedResponse, callback) {
    this._queue.push({expectedResponse: expectedResponse, callback: callback, response: null, responseLength: null});

    this._port.write(command, err => {
      if (err) {
        assert(false, `error when sending write command to serial port: ${err.message}`);
      }
    });
  }

  /**
   * _byte(0xDEADBEEF, 0) => 0xEF and _byte(0xDEADBEEF, 3) => 0xDE.
   */
  _byte(val, index) {
    return ((val >> (8 * index)) & 0xFF);
  }

  /* nRF Open Mesh Serial Interface */

  echo(buffer, callback) {
    const buf = Buffer.from([buffer.length + 1, commandOpCodes.ECHO]);
    const command = Buffer.concat([buf, buffer]);
    const expectedResponse = Buffer.from([buffer.length + 1, responseOpCodes.ECHO]);

    this.execute(command, expectedResponse, callback);
  }

  init(accessAddr, intMinMS, channel, callback) {
    const command = Buffer.from([10, commandOpCodes.INIT, this._byte(accessAddr, 0), this._byte(accessAddr, 1), this._byte(accessAddr, 2), this._byte(accessAddr, 3),
                                this._byte(intMinMS, 0), this._byte(intMinMS, 1), this._byte(intMinMS, 2), this._byte(intMinMS, 3), channel]);

    const expectedResponse = Buffer.from([0x03, responseOpCodes.CMD_RSP, commandOpCodes.INIT, statusCodes.SUCCESS])

    this.execute(command, expectedResponse, callback);
  }

  start(callback) {
    const command = Buffer.from([1, commandOpCodes.START]);
    const expectedResponse = Buffer.from([3, responseOpCodes.CMD_RSP, commandOpCodes.START, statusCodes.SUCCESS]);

    this.execute(command, expectedResponse, callback);
  }

  stop(callback) {
    const command = Buffer.from([1, commandOpCodes.STOP]);
    const expectedResponse = Buffer.from([3, responseOpCodes.CMD_RSP, commandOpCodes.STOP, statusCodes.SUCCESS]);

    this.execute(command, expectedResponse, callback);
  }

  valueSet(handle, buffer, callback) {
    const buf = Buffer.from([3 + buffer.length, commandOpCodes.VALUE_SET, this._byte(handle, 0), this._byte(handle, 1)]);
    const command = Buffer.concat([buf, buffer]);
    const expectedResponse = Buffer.from([3, responseOpCodes.CMD_RSP, commandOpCodes.VALUE_SET, statusCodes.SUCCESS]);

    this.execute(command, expectedResponse, callback);
  }

  valueGet(handle, callback) { // TODO: This is hard coded and needs to be fixed! Requires big change.
    const command = Buffer.from([3, commandOpCodes.VALUE_GET, this._byte(handle, 0), this._byte(handle, 1)]);
    const expectedResponse = Buffer.from([3 + 2 + 3, responseOpCodes.CMD_RSP, commandOpCodes.VALUE_GET, statusCodes.SUCCESS, this._byte(handle, 0), this._byte(handle, 1)]);

    this.execute(command, expectedResponse, callback);
  }

  valueEnable(handle, callback) {
    const command = Buffer.from([3, commandOpCodes.VALUE_ENABLE, this._byte(handle, 0), this._byte(handle, 1)]);
    const expectedResponse = Buffer.from([3, responseOpCodes.CMD_RSP, commandOpCodes.VALUE_ENABLE, statusCodes.SUCCESS]);

    this.execute(command, expectedResponse, callback);
  }

  valueDisable(handle, callback) {
    const command = Buffer.from([3, commandOpCodes.VALUE_DISABLE, this._byte(handle, 0), this._byte(handle, 1)]);
    const expectedResponse = Buffer.from([3, responseOpCodes.CMD_RSP, commandOpCodes.VALUE_DISABLE, statusCodes.SUCCESS]);

    this.execute(command, expectedResponse, callback);
  }

  buildVersionGet(callback) {
    const command = Buffer.from([1, commandOpCodes.BUILD_VERSION_GET]);
    const expectedResponse = Buffer.from([6, responseOpCodes.CMD_RSP, commandOpCodes.BUILD_VERSION_GET, statusCodes.SUCCESS]);

    this.execute(command, expectedResponse, callback);
  }

  accessAddrGet(callback) {
    const command = Buffer.from([1, commandOpCodes.ACCESS_ADDR_GET]);
    const expectedResponse = Buffer.from([0x07, responseOpCodes.CMD_RSP, commandOpCodes.ACCESS_ADDR_GET, statusCodes.SUCCESS]);

    this.execute(command, expectedResponse, callback);
  }

  channelGet(callback) {
    const command = Buffer.from([1, commandOpCodes.CHANNEL_GET]);
    const expectedResponse = Buffer.from([0x04, responseOpCodes.CMD_RSP, commandOpCodes.CHANNEL_GET, statusCodes.SUCCESS])

    this.execute(command, expectedResponse, callback);
  }

  intervalMinGet(callback) {
    const command = Buffer.from([1, commandOpCodes.INTERVAL_MIN_GET]);
    const expectedResponse = Buffer.from([0x07, responseOpCodes.CMD_RSP, commandOpCodes.INTERVAL_MIN_GET, statusCodes.SUCCESS])

    this.execute(command, expectedResponse, callback);
  }

  radioReset(callback) {
    const command = Buffer.from([1, commandOpCodes.RADIO_RESET]);

    const firstExpectedResponse = Buffer.from([0x00]);
    const secondExpectedResponse = Buffer.from([0x04, responseOpCodes.DEVICE_STARTED, 0x02, 0x00, 0x04]);

    let dummy = () => {
      console.log('dummy');
    }

    this._queue.push({expectedResponse: firstExpectedResponse, callback: dummy, response: null, responseLength: null});
    this._queue.push({expectedResponse: secondExpectedResponse, callback: callback, response: null, responseLength: null});

    this._port.write(command, err => {
      if (err) {
        assert(false, `error when sending write command to serial port: ${err.message}`);
      }
    });
  }
}

module.exports = BLEMeshSerialInterface;
