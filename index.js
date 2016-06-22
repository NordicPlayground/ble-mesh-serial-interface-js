'use strict';

const assert = require('assert');
const Enum = require('enum');
const SerialPort = require('serialport');


const commandOpCodes = new Enum({
                                'ECHO' : 0x02,
                                'RADIO_RESET' : 0x0e,
                                'INIT' : 0x70,
                                'START' : 0x74,
                                'STOP' : 0x75,
                                'VALUE_SET' : 0x71,
                                'VALUE_GET' : 0x7a,
                                'BUILD_VERSION_GET' : 0x7b,
                                'ACCESS_ADDR_GET' : 0x7c,
                                'CHANNEL_GET' : 0x7d,
                                'INTERVAL_MIN_GET' : 0x7f
                                });

const responseOpCodes = new Enum({
                                 'DEVICE_STARTED' : 0x81,
                                 'ECHO' : 0x82,
                                 'CMD_RSP' : 0x84
                                 });

const statusCodes = new Enum ({
                              'SUCCESS' : 0x0
                              });

// TODO: combine into JSON object...
let expectedResponseQueue = []; // Every time the host sends a command to the slave device, the expected response of that command will be added to this queue.
let callbackQueue = []; // Every time the host sends a command to the slave device, the callback function that should be called when the response is received will be added to this queue.

let queue = [];

let port = new SerialPort.SerialPort('COM44', {
  baudRate: 115200,
  rtscts: true
});

let slaveResponse = { // BUG: Is this state safe?
  response: null,
  length: null
};

port.on('data', data => {
  buildResponse(data);

  if (slaveResponse.length !== slaveResponse.response.length) { // The full response must be built before checking it and executing the callback.
    return;
  }

  checkResponseAndExecuteCallback(slaveResponse.response);

  slaveResponse.length = null;
  slaveResponse.response = null;
});

port.on('error', err => {
  if (err) {
    console.log('error: ', err.message);
  }
});

function buildResponse(data) {
  if (slaveResponse.length === null) {
    slaveResponse.length = data[0] + 1; // The first byte in the response, data[0], stores the length of the rest of the response in bytes.
    slaveResponse.response = Buffer.from([]);
  }

  const remainingLength = slaveResponse.length - slaveResponse.response.length;
  assert(remainingLength >= 0, 'remainingLength cannot be negative');

  if (remainingLength >= data.length) {
    slaveResponse.response = Buffer.concat([slaveResponse.response, data]);
  } else if (remainingLength < data.length) { // Multiple responses have been joined into this data event.
    slaveResponse.response = Buffer.concat([slaveResponse.response, data[0, remainingLength]]);
  }
}

function checkResponseAndExecuteCallback(response) {
  const contents = queue.shift();
  const expectedResponse = contents[0];
  const callback = contents[1];

  if (response.slice(0, expectedResponse.length).equals(expectedResponse)) {
    callback(null, response.slice(expectedResponse.length));
  } else {
    console.log(expectedResponse);
    console.log(response);
    callback(new Error(`unexpected response from slave device: ${response.toString('hex')}`));
  }
}

function writeCommand(command) {
  port.write(command, err => {
    if (err) {
      assert(false, `error when sending write command to serial port: ${err.message}`);
    }
  });
}

function execute(command, expectedResponse, callback) {
  queue.push([expectedResponse, callback]);
  writeCommand(command);
}

/**
 * _byte(0xDEADBEEF, 0) => 0xEF and _byte(0xDEADBEEF, 3) => 0xDE.
 */
function _byte(val, index) {
  return ((val >> (8 * index)) & 0xFF);
}

exports.commandOpCodes = commandOpCodes;
exports.port = port;

exports.echo = (buffer, callback) => {
  const buf = Buffer.from([buffer.length + 1, commandOpCodes.ECHO]); // length += 1, as it accounts for the opcode length (one byte) as well as data's length.
  const command = Buffer.concat([buf, buffer]);
  const expectedResponse = Buffer.from([buffer.length + 1, responseOpCodes.ECHO]);

  execute(command, expectedResponse, callback);
}

exports.init = (accessAddr, intMinMS, channel, callback) => {
  const command = Buffer.from([10, commandOpCodes.INIT, _byte(accessAddr, 0), _byte(accessAddr, 1), _byte(accessAddr, 2), _byte(accessAddr, 3),
                              _byte(intMinMS, 0), _byte(intMinMS, 1), _byte(intMinMS, 2), _byte(intMinMS, 3), channel]);

  const expectedResponse = Buffer.from([0x03, responseOpCodes.CMD_RSP, commandOpCodes.INIT, statusCodes.SUCCESS])

  execute(command, expectedResponse, callback);
}

exports.start = callback => {
  const command = Buffer.from([1, commandOpCodes.START]);
  const expectedResponse = Buffer.from([3, responseOpCodes.CMD_RSP, commandOpCodes.START, statusCodes.SUCCESS]);

  execute(command, expectedResponse, callback);
}

exports.stop = callback => {
  const command = Buffer.from([1, commandOpCodes.STOP]);
  const expectedResponse = Buffer.from([3, responseOpCodes.CMD_RSP, commandOpCodes.STOP, statusCodes.SUCCESS]);

  execute(command, expectedResponse, callback);
}

exports.valueSet = (handle, buffer, callback) => {
  const buf = Buffer.from([3 + buffer.length, commandOpCodes.VALUE_SET, _byte(handle, 0), _byte(handle, 1)]);
  const command = Buffer.concat([buf, buffer]);
  const expectedResponse = Buffer.from([3, responseOpCodes.CMD_RSP, commandOpCodes.VALUE_SET, statusCodes.SUCCESS]);

  execute(command, expectedResponse, callback);
}

exports.buildVersionGet = callback => {
  const command = Buffer.from([1, commandOpCodes.BUILD_VERSION_GET]);
  const expectedResponse = Buffer.from([6, responseOpCodes.CMD_RSP, commandOpCodes.BUILD_VERSION_GET, statusCodes.SUCCESS]);

  execute(command, expectedResponse, callback);
}

exports.accessAddrGet = callback => {
  const command = Buffer.from([1, commandOpCodes.ACCESS_ADDR_GET]);
  const expectedResponse = Buffer.from([0x07, responseOpCodes.CMD_RSP, commandOpCodes.ACCESS_ADDR_GET, statusCodes.SUCCESS]);

  execute(command, expectedResponse, callback);
}

exports.channelGet = callback => {
  const command = Buffer.from([1, commandOpCodes.CHANNEL_GET]);
  const expectedResponse = Buffer.from([0x04, responseOpCodes.CMD_RSP, commandOpCodes.CHANNEL_GET, statusCodes.SUCCESS])

  execute(command, expectedResponse, callback);
}

exports.intervalMinGet = callback => {
  const command = Buffer.from([1, commandOpCodes.INTERVAL_MIN_GET]);
  const expectedResponse = Buffer.from([0x07, responseOpCodes.CMD_RSP, commandOpCodes.INTERVAL_MIN_GET, statusCodes.SUCCESS])

  execute(command, expectedResponse, callback);
}

exports.radioReset = callback => {
  const command = Buffer.from([1, commandOpCodes.RADIO_RESET]);

  const firstExpectedResponse = Buffer.from([0x00]);
  const secondExpectedResponse = Buffer.from([0x04, responseOpCodes.DEVICE_STARTED, 0x02, 0x00, 0x04]);

  let dummy = () => {
    console.log('dummy');
  }

  queue.push([firstExpectedResponse, dummy]);
  queue.push([secondExpectedResponse, callback]);

  writeCommand(command);
}
