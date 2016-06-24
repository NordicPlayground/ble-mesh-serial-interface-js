'use strict';

const assert = require('assert');
const EventEmitter = require('events');

const SerialPort = require('serialport');

const commandOpCodes = { // TODO: Still codes to add and implement.
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
  'ECHO_RSP': 0x82,
  'CMD_RSP': 0x84,
  'EVENT_NEW': 0xB3,
  'EVENT_UPDATE': 0xB4,
  'EVENT_CONFLICTING': 0xB5,
  'EVENT_TX': 0xB6
};

const statusCodes = {
  'SUCCESS': 0x0,
  'ERROR_UNKNOWN': 0x80,
  'ERROR_INTERNAL': 0x81,
  'ERROR_CMD_UNKNOWN': 0x82,
  'ERROR_DEVICE_STATE_INVALID': 0x83,
  'ERROR_INVALID_LENGTH': 0x84,
  'ERROR_INVALID_PARAMETER': 0x85,
  'ERROR_BUSY': 0x86,
  'ERROR_INVALID_DATA': 0x87,
  'ERROR_PIPE_INVALID': 0x90,
  'RESERVED_START': 0xF0,
  'RESERVED_END': 0xFF
};


class BLEMeshSerialInterface extends EventEmitter {
  /**
   * Connects to the serialPort with the specified buadRate and rtscts. Registers port event listeners. Sets up internal command queue.
   *
   * Note: Upon opening the serial port, the received data buffer will be flushed and read. So any events or responses the slave device has queued will
   * be logged to the console.
   */
  constructor(serialPort, callback, baudRate, rtscts) {
    super();

    if (!baudRate) { // TODO: Better way to do this?
      baudRate = 115200;
    } if (!rtscts) {
      rtscts = true;
    }

    this._tempBuildResponse;

    this._eventResponseQueue = [];
    this._commandResponseQueue = [];

    this._port = new SerialPort.SerialPort(serialPort, {
      baudRate: baudRate,
      rtscts: rtscts
    });

    this._port.on('open', () => {
      if (callback) {
        callback(); // TODO: Look into emitting an event instead of executing a callback.
      }
    });

    this._port.on('error', err => {
      if (err) {
        console.log('serial port error: ', err.message);
      }
    });

    this._port.on('data', data => {
      this._buildResponse(data);

      while (this._commandResponseQueue.length != 0) {
        this._handleCommandResponse(this._commandResponseQueue.shift());
      }
      while (this._eventResponseQueue.length != 0) {
        this._handleEventResponse(this._eventResponseQueue.shift());
      }
    });
  }

  /**
   * Called recursively, command and event responses will be pushed onto the global response queues after this function completes.
   *
   * Note: While this function does not return anything, it modifies class properties this._eventResponseQueue and this._commandResponseQueue.
   */
  _buildResponse(data) {
    if (data.length <= 0) {
      assert(data.length >= 0, 'some data was cut off in BLEMeshSerialInterface._buildResponse(data)')
      return;
    }

    if (!this._tempBuildResponse) {
      this._tempBuildResponse = new Buffer([]);
    }

    let length = this._tempBuildResponse[0] + 1;
    if (!length) {
      length = data[0] + 1;
    }
    let remainingLength = length - this._tempBuildResponse.length;

    if (remainingLength >= data.length) {
      this._tempBuildResponse = Buffer.concat([this._tempBuildResponse, data]);
    } else {
      this._tempBuildResponse = Buffer.concat([this._tempBuildResponse, data.slice(0, remainingLength)]);
    }

    if (length === this._tempBuildResponse.length) {
      const response = new Buffer(this._tempBuildResponse);
      if (this._isCommandResponse(response)) {
        this._commandResponseQueue.push(response);
      } else {
        this._eventResponseQueue.push(response);
      }
      this._tempBuildResponse = null;
      this._buildResponse(data.slice(remainingLength));
    }
  }

  _handleCommandResponse(response) {
    if (response[0] === 0) {
      this.emit('cmd_rsp', null, response);
      return;
    }

    switch(response[1]) {
      case responseOpCodes.ECHO_RSP:
        this.emit('echo_rsp', null, response.slice(2));
        break;
      case responseOpCodes.CMD_RSP:
        switch(response[3]) {
          case statusCodes.SUCCESS:
            this.emit('cmd_rsp', null, response.slice(4));
            break;
          default:
            console.log('status code error: ', response);
        }
        break;
      default:
        console.log('unknown command response opCode');
    }
  }

  _handleEventResponse(response) {
    console.log(response);
  }

  _isCommandResponse(response) {
    const opCode = response[1];
    if (opCode === responseOpCodes.ECHO_RSP | opCode === responseOpCodes.CMD_RSP | response[0] === 0x00) {
      return true;
    }
    return false;
  }

  writeSerialPort(data) {
    this._port.write(data, err => {
      if (err) {
        console.log('error when writing to serial port: ', err.message);
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

  echo(buffer) {
    const buf = new Buffer([buffer.length + 1, commandOpCodes.ECHO]);
    const command = Buffer.concat([buf, buffer]);
    this.writeSerialPort(command);
  }

  init(accessAddr, intMinMS, channel) {
    const command = new Buffer([10, commandOpCodes.INIT, this._byte(accessAddr, 0), this._byte(accessAddr, 1), this._byte(accessAddr, 2), this._byte(accessAddr, 3),
                                                         this._byte(intMinMS, 0), this._byte(intMinMS, 1), this._byte(intMinMS, 2), this._byte(intMinMS, 3), channel]);
    this.writeSerialPort(command);
  }

  start() {
    const command = new Buffer([1, commandOpCodes.START]);
    this.writeSerialPort(command);
  }

  stop() {
    const command = new Buffer([1, commandOpCodes.STOP]);
    this.writeSerialPort(command);
  }

  valueSet(handle, buffer) {
    const buf = new Buffer([3 + buffer.length, commandOpCodes.VALUE_SET, this._byte(handle, 0), this._byte(handle, 1)]);
    const command = Buffer.concat([buf, buffer]);
    this.writeSerialPort(command);
  }

  valueGet(handle) {
    const command = new Buffer([3, commandOpCodes.VALUE_GET, this._byte(handle, 0), this._byte(handle, 1)]);
    this.writeSerialPort(command);
  }

  valueEnable(handle) {
    const command = new Buffer([3, commandOpCodes.VALUE_ENABLE, this._byte(handle, 0), this._byte(handle, 1)]);
    this.writeSerialPort(command);
  }

  valueDisable(handle) {
    const command = new Buffer([3, commandOpCodes.VALUE_DISABLE, this._byte(handle, 0), this._byte(handle, 1)]);
    this.writeSerialPort(command);
  }

  buildVersionGet() {
    const command = new Buffer([1, commandOpCodes.BUILD_VERSION_GET]);
    this.writeSerialPort(command);
  }

  accessAddrGet() {
    const command = new Buffer([1, commandOpCodes.ACCESS_ADDR_GET]);
    this.writeSerialPort(command);
  }

  channelGet() {
    const command = new Buffer([1, commandOpCodes.CHANNEL_GET]);
    this.writeSerialPort(command);
  }

  intervalMinGet() {
    const command = new Buffer([1, commandOpCodes.INTERVAL_MIN_GET]);
    this.writeSerialPort(command);
  }

  radioReset() {
    const command = new Buffer([1, commandOpCodes.RADIO_RESET]);
    this.writeSerialPort(command);
  }
}

module.exports = BLEMeshSerialInterface;
