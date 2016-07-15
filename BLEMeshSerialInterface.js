'use strict';

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
  'FLAG_SET': 0x76,
  'FLAG_GET': 0x77,
  'DFU_DATA': 0x78,
  'VALUE_GET': 0x7a,
  'BUILD_VERSION_GET': 0x7b,
  'ACCESS_ADDR_GET': 0x7c,
  'CHANNEL_GET': 0x7d,
  'INTERVAL_MIN_GET': 0x7f
};

const smartMeshCommandOpCodes = {
  'GET_VERSION': 0x50,
  'SET_KEYPAIR': 0x51, // TODO: these may change in release...
  'SET_CAPABILITIES': 0x52,
  'SET_UUID': 0x53,

  /* Provisioning */
  'SERIAL_CMD_RANGE_PROV_START': 0x60,
  'SERIAL_CMD_PROV_INIT_CONTEXT': 0x60,
  'SERIAL_CMD_PROV_SCAN_START': 0x61,
  'SERIAL_CMD_PROV_SCAN_STOP': 0x62,
  'SERIAL_CMD_PROV_PROVISION': 0x63,
  'SERIAL_CMD_PROV_LISTEN': 0x64,
  'SERIAL_CMD_PROV_ACCEPT': 0x65,
  'SERIAL_CMD_PROV_OOB_USE': 0x66,
  'SERIAL_CMD_PROV_AUTH_DATA': 0x67,
  'SERIAL_CMD_PROV_ECDH_SECRET': 0x68,
  'SERIAL_CMD_PROV_SET_KEYPAIR': 0x69,
  'SERIAL_CMD_PROV_SET_CAPABILITIES': 0x6A,
  'SERIAL_CMD_RANGE_PROV_END': 0x6F
}

const responseOpCodes = { // TODO: add events for smart mesh.
  'DEVICE_STARTED': 0x81,
  'ECHO_RSP': 0x82,
  'CMD_RSP': 0x84,
  'EVENT_NEW': 0xB3,
  'EVENT_UPDATE': 0xB4,
  'EVENT_CONFLICTING': 0xB5,
  'EVENT_TX': 0xB6,
  'EVENT_DFU': 0x78
};

const statusCodes = { // TODO: add status codes for smart mesh.
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

const reverseLookup = obj => val => {
    for (let k of Object.keys(obj))
        if (obj[k] === val)
            return k;
}

const commandOpCodeToString = reverseLookup(commandOpCodes);
const statusCodeToString = reverseLookup(statusCodes);
const responseOpCodeToString = reverseLookup(responseOpCodes);


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
      this.buildResponse(data);

      while (this._responseQueue.length !== 0) {
        const response = this._responseQueue.shift();
        if (this.isCommandResponse(response)) {
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

  bufferToArray(buf) {
    let array = [];
    for (let i = 0; i < buf.length; i++) {
      array[i] = buf[i];
    }
    return array;
  }

  buildResponse(data) {
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
      this.buildResponse(data.slice(remainingLength));
    }
  }

  /**
   * _byte(0xDEADBEEF, 0) => 0xEF and _byte(0xDEADBEEF, 3) => 0xDE.
   */
  _byte(val, index) {
    return ((val >> (8 * index)) & 0xFF);
  }

  _handleCommandResponse(resp) {
    let response = this.bufferToArray(resp);

    if (response[0] === 0 & response.length === 1) {
      if (this._callback) {
        this._callback(null, response);
      }
      return;
    }

    const responseOpCode = response[1];
    const commandOpCode = response[2];
    const statusCode = response[3];

    switch(responseOpCode) {
      case responseOpCodes.ECHO_RSP:
        this._callback(null, this.bufferToArray(response.slice(2)));
        break;
      case responseOpCodes.CMD_RSP:
        switch(statusCode) {
          case statusCodes.SUCCESS:
            switch (commandOpCode) {
              case commandOpCodes.FLAG_GET:
                this._callback(null,
                  {handle: response.slice(4, 6).reverse(), flagIndex: response[6], flagValue: response[7]}
                );
                break;
              case commandOpCodes.VALUE_GET:
                this._callback(null,
                  {handle: response.slice(4, 6).reverse(), data: response.slice(6).reverse()}
                );
                break;
              case commandOpCodes.ACCESS_ADDR_GET:
                this._callback(null,
                  {accessAddr: response.slice(4).reverse()}
                );
                break;
              case commandOpCodes.CHANNEL_GET:
                this._callback(null,
                  {channel: response[4]}
                );
                break;
              case commandOpCodes.INTERVAL_MIN_GET:
                this._callback(null,
                  {intervalMin: response.slice(4).reverse()}
                );
                break;
              default: // TODO: do we want to return build version get as an object?
                this._callback(null, response.slice(4));
            }
            break;
          default:
            this._callback(new Error(`received a status code in the command response indicating an error ${statusCodeToString(statusCode)}`), response);
        }
        break;
      default:
        this._callback(new Error(`unknown command response opCode ${responseOpCodeToString(responseOpCode)}`), response);
    }
  }

  _handleEventResponse(response) {
    const data = this.bufferToArray(response);
    const responseOpCode = data[1];

    switch(responseOpCode) {
      case responseOpCodes.DEVICE_STARTED:
        this.emit('deviceStarted',
          {operatingMode: response[2], hwError: response[3], dataCreditAvailable: response[4]}
        );
        break;
      case responseOpCodes.EVENT_NEW:
        this.emit('eventNew',
          {handle: data.slice(2, 4).reverse(), data: data.slice(4).reverse()}
        );
        break;
      case responseOpCodes.EVENT_UPDATE:
        this.emit('eventUpdate',
          {handle: data.slice(2, 4).reverse(), data: data.slice(4).reverse()}
        );
        break;
      case responseOpCodes.EVENT_CONFLICTING:
        this.emit('eventConflicting',
          {handle: data.slice(2, 4).reverse(), data: data.slice(4).reverse()}
        );
        break;
      case responseOpCodes.EVENT_TX:
        this.emit('eventTX',
          {handle: data.slice(2, 4).reverse(), data: data.slice(4).reverse()}
        );
        break;
      case responseOpCodes.EVENT_DFU:
        this.emit('eventDFU', data);
        break;
      default:
          console.log('unknown event response received from slave device: ', response,
            responseOpCode, responseOpCodeToString(responseOpCode)
          );
    }
  }

  isCommandResponse(response) {
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
        this.emit('error', err);
        console.log('error when writing to serial port: ', err.message);
      }
    });
  }

  /* nRF Open Mesh Serial Interface */

  echo(data, callback) {
    const buf = [data.length + 1, commandOpCodes.ECHO];
    const command = new Buffer(buf.concat(data));


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

  valueSet(handle, data, callback) {
    const buf =[3 + data.length, commandOpCodes.VALUE_SET, this._byte(handle, 0), this._byte(handle, 1)];
    const command = new Buffer(buf.concat(Array.from(data).reverse()));

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

  flagSet(handle, callback) {
    const buf = [5, commandOpCodes.FLAG_SET];
    const command = new Buffer(buf.concat([this._byte(handle, 0), this._byte(handle, 1), 0, 1]));

    this._callback = callback;
    this.writeSerialPort(command);
  }

  flagGet(handle, callback) {
    const buf = [4, commandOpCodes.FLAG_GET];
    const command = new Buffer(buf.concat([this._byte(handle, 0), this._byte(handle, 1), 0]));

    this._callback = callback;
    this.writeSerialPort(command);
  }

  txEventSet(handle, callback) {
    const buf = [5, commandOpCodes.FLAG_SET];
    const command = new Buffer(buf.concat([this._byte(handle, 0), this._byte(handle, 1), 1, 1]));

    this._callback = callback;
    this.writeSerialPort(command);
  }

  txEventGet(handle, callback) {
    const buf = [4, commandOpCodes.FLAG_GET];
    const command = new Buffer(buf.concat([this._byte(handle, 0), this._byte(handle, 1), 1]));

    this._callback = callback;
    this.writeSerialPort(command);
  }

  dfuData(data, callback) {
    const buf = [data.length + 1, commandOpCodes.DFU_DATA];
    const command = new Buffer(buf.concat(data)); // Note: This is the only command where user is responsible for formatting data as little endian.

    this._callback = callback;
    this.writeSerialPort(command);
  }

  /* Smart Mesh Serial Interface */

  getVersion(callback) {
    const command = new Buffer([1, smartMeshCommandOpCodes.GET_VERSION]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  setKeyPair(callback) {
    const command = new Buffer([1, smartMeshCommandOpCodes.SET_KEYPAIR]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  setCapabilities(callback) {
    const command = new Buffer([1, smartMeshCommandOpCodes.SET_CAPABILITIES]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  provInitContext(contextID, callback) {
    const command = new Buffer([2, smartMeshCommandOpCodes.SERIAL_CMD_PROV_INIT_CONTEXT, contextID]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  provStartScan(callback) {
    const command = new Buffer([1, smartMeshCommandOpCodes.SERIAL_CMD_PROV_SCAN_START]);

    this._callback = callback;
    this.writeSerialPort(command);
  }

  provStopScan(callback) {
    const command = new Buffer([1, smartMeshCommandOpCodes.SERIAL_CMD_PROV_SCAN_STOP]);

    this._callback = callback;
    this.writeSerialPort(command);
  }
}

module.exports = BLEMeshSerialInterface;
