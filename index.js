'use strict';

const EventEmitter = require('events');
const SerialPort = require('serialport');

const commandOpCodes = { // TODO: Still additional codes to add and implement.
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
  constructor(serialPort, callback, baudRate, rtscts) {
    super();

    if (typeof baudRate === 'undefined') { baudRate = 115200; }
    if (typeof rtscts === 'undefined') { rtscts = true; }

    this._port = new SerialPort.SerialPort(serialPort, {baudRate: baudRate, rtscts: rtscts}, callback);

    this._callback;
    this._responseQueue = [];
    this._tempBuildResponse;

    this._port.on('data', data => {
      this._buildResponse(data);

      while (this._responseQueue.length !== 0) {
        const response = this._responseQueue.shift();
        if (this._isCommandResponse(response)) {
          this._handleCommandResponse(response);
        } else {
          this._handleEventResponse(response);
        }
      }
    });

    this._port.on('disconnect', err => {
      this.emit('disconnected', err);
      console.log('serial port disconnected: ', err);
    });

    this._port.on('error', err => {
      this.emit('error', err);
      console.log('serial port error: ', err);
    });
  }

  _buildResponse(data) {
    let length = data[0] + 1; // If we are in the middle of building a response this will be incorrect, and re-assigned below.

    if (!this._tempBuildResponse) {
      this._tempBuildResponse = new Buffer([]);
    } else {
      length = this._tempBuildResponse[0] + 1;
    }

    let remainingLength = length - this._tempBuildResponse.length;

    if (remainingLength >= data.length) {
      this._tempBuildResponse = Buffer.concat([this._tempBuildResponse, data]);
    } else {
      this._tempBuildResponse = Buffer.concat([this._tempBuildResponse, data.slice(0, remainingLength)]);
    }

    if (length === this._tempBuildResponse.length) {
      const response = new Buffer(this._tempBuildResponse);
      this._responseQueue.push(response);
      this._tempBuildResponse = null;
    }

    if (remainingLength < data.length) {
      this._buildResponse(data.slice(remainingLength));
    }
  }

  /**
   * _byte(0xDEADBEEF, 0) => 0xEF and _byte(0xDEADBEEF, 3) => 0xDE.
   */
  _byte(val, index) {
    return ((val >> (8 * index)) & 0xFF);
  }

  _handleCommandResponse(response) {
    if (response[0] === 0 & response.length === 1) {
      this._callback(null, response);
      return;
    }

    const responseOpCode = response[1];

    switch(responseOpCode) {
      case responseOpCodes.ECHO_RSP:
        this._callback(null, response.slice(2));
        break;
      case responseOpCodes.CMD_RSP:
        const statusCode = response[3];
        switch(statusCode) {
          case statusCodes.SUCCESS:
            this._callback(null, response.slice(4));
            break;
          default:
            this._callback(new Error(`received a status code in the command response indicating an error ${statusCode}`), response);
            console.log('status code error: ', response);
        }
        break;
      default:
        this._callback(new Error(`unknown command response opCode ${responseOpCode}`), response);
        console.log('unknown command response opCode');
    }
  }

  _handleEventResponse(response) {
    const responseOpCode = response[1];
    const data = response.slice(2);

    switch(responseOpCode) {
      case responseOpCodes.DEVICE_STARTED:
        this.emit('deviceStarted', data);
        break;
      case responseOpCodes.EVENT_NEW:
        this.emit('eventNew', data);
        break;
      case responseOpCodes.EVENT_UPDATE:
        this.emit('eventUpdate', data);
        break;
      case responseOpCodes.EVENT_CONFLICTING:
        this.emit('eventConflicting', data);
        break;
      case responseOpCodes.EVENT_TX:
        this.emit('eventTX', data);
        break;
      default:
        console.log('unknown event response received from slave device: ', response);
    }
  }

  _isCommandResponse(response) {
    const opCode = response[1];
    if (opCode === responseOpCodes.ECHO_RSP | opCode === responseOpCodes.CMD_RSP | response[0] === 0x00) {
      return true;
    }
    return false;
  }

  /* API Methods */

  closeSerialPort(callback) {
    if (this._port.isOpen()) {
      this._port.close(() => {
        callback();
      });
    } else {
      callback(new Error('error, there is no serial port currently open'));
    }
  }

  openSerialPort(serialPort, callback, baudRate, rtscts) {
    if (this._port.isOpen()) {
      return callback(new Error('error, serial port is open and must be closed before calling this function'));
    }

    if (typeof baudRate === 'undefined') { baudRate = 115200; }
    if (typeof rtscts === 'undefined') { rtscts = true; }

    this._port.path = serialPort;
    this._port.options.baudRate = baudRate;
    this._port.options.rtscts = rtscts;

    this._port.open(err => {
      callback(err);
    });
  }

  writeSerialPort(data) {
    this._port.write(data, err => {
      if (err) {
        console.log('error when writing to serial port: ', err.message);
      }
    });
  }

  /* nRF Open Mesh Serial Interface */

  echo(buffer, callback) {
    const buf = new Buffer([buffer.length + 1, commandOpCodes.ECHO]);
    const command = Buffer.concat([buf, buffer]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  init(accessAddr, intMinMS, channel, callback) {
    const command = new Buffer([10, commandOpCodes.INIT, this._byte(accessAddr, 0), this._byte(accessAddr, 1), this._byte(accessAddr, 2), this._byte(accessAddr, 3),
                                                         this._byte(intMinMS, 0), this._byte(intMinMS, 1), this._byte(intMinMS, 2), this._byte(intMinMS, 3), channel]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  start(callback) {
    const command = new Buffer([1, commandOpCodes.START]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  stop(callback) {
    const command = new Buffer([1, commandOpCodes.STOP]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  valueSet(handle, buffer, callback) {
    const buf = new Buffer([3 + buffer.length, commandOpCodes.VALUE_SET, this._byte(handle, 0), this._byte(handle, 1)]);
    const command = Buffer.concat([buf, buffer]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  valueGet(handle, callback) {
    const command = new Buffer([3, commandOpCodes.VALUE_GET, this._byte(handle, 0), this._byte(handle, 1)]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  valueEnable(handle, callback) {
    const command = new Buffer([3, commandOpCodes.VALUE_ENABLE, this._byte(handle, 0), this._byte(handle, 1)]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  valueDisable(handle, callback) {
    const command = new Buffer([3, commandOpCodes.VALUE_DISABLE, this._byte(handle, 0), this._byte(handle, 1)]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  buildVersionGet(callback) {
    const command = new Buffer([1, commandOpCodes.BUILD_VERSION_GET]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  accessAddrGet(callback) {
    const command = new Buffer([1, commandOpCodes.ACCESS_ADDR_GET]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  channelGet(callback) {
    const command = new Buffer([1, commandOpCodes.CHANNEL_GET]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  intervalMinGet(callback) {
    const command = new Buffer([1, commandOpCodes.INTERVAL_MIN_GET]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  radioReset(callback) {
    const command = new Buffer([1, commandOpCodes.RADIO_RESET]);

    this._callback = callback;
    this.writeSerialPort(command);
  }
}

module.exports = BLEMeshSerialInterface;
