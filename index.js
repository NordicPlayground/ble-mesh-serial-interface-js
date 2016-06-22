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

// TODO: combine into json object
let expectedResponseQueue = []; // Every time the host sends a command to the slave device, the expected response of that command will be added to this queue.
let callbackQueue = []; // Every time the host sends a command to the slave device, the callback function that should be called when the response is received will be added to this queue.

let port = new SerialPort.SerialPort('COM44', {
  baudRate: 115200,
  rtscts: true
});

let slaveResponse = { // BUG: Can this be modified by ??
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
  const expectedResponse = expectedResponseQueue.shift();
  const callback = callbackQueue.shift();

  if (response.slice(0, expectedResponse.length).equals(expectedResponse)) {
    callback(null, response.slice(expectedResponse.length));
  } else {
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
  expectedResponseQueue.push(expectedResponse);
  callbackQueue.push(callback);

  writeCommand(command);
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
  const command = Buffer.from([10, commandOpCodes.INIT, 0xd6, 0xbe, 0x89, 0x8e, 100, 0, 0, 0, 38]);
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

  expectedResponseQueue.push(firstExpectedResponse);
  expectedResponseQueue.push(secondExpectedResponse);
  callbackQueue.push(dummy);
  callbackQueue.push(callback);

  writeCommand(command);
}
