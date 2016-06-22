'use strict';

const assert = require('assert');
const Enum = require('enum');
const SerialPort = require('serialport');


const commandOpCodes = new Enum({
                                'ECHO' : 0x02,
                                'RADIO_RESET' : 0x0e,
                                'INIT' : 0x70,
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

let expectedResponseQueue = []; // Every time the PC sends a command to the slave device, the expected response of that command will be added to this queue.
let callbackQueue = []; // Every time the PC sends a command to the slave device, the callback function that should be called when the response is received will be added to this queue.

let port = new SerialPort.SerialPort('COM44', {
  baudRate: 115200,
  rtscts: true
});

let buildResponse = {
  response: null,
  length: null
};

port.on('data', data => {
  if (buildResponse.length === null) {
    buildResponse.length = data[0] + 1;
    buildResponse.response = Buffer.from([]);
  }

  const remainingLength = buildResponse.length - buildResponse.response.length;
  assert(remainingLength >= 0, 'remainingLength cannot be negative.');

  if (remainingLength > 0) {
    assert(remainingLength >= data.length, 'This case not implemented yet.');
    buildResponse.response = Buffer.concat([buildResponse.response, data]);
  }

  if (buildResponse.length !== buildResponse.response.length) {
    return;
  }

  const expectedResponse = expectedResponseQueue.shift();
  const callback = callbackQueue.shift();

  if (!buildResponse.response.slice(0, expectedResponse.length).equals(expectedResponse)) {
    callback(new Error(`unexpected response from slave device: ${buildResponse.response.toString('hex')}`));
  } else {
    callback(null, buildResponse.response.slice(expectedResponse.length));
  }

  buildResponse.length = null;
  buildResponse.response = null;
});

port.on('error', err => {
  if (err) {
    console.log('error: ', err.message);
  }
});

const writeCommand = command => {
  port.write(command, err => {
    if (err) {
      assert(false, `error when sending write command to serial port: ${err.message}`);
    }
  });
}

exports.commandOpCodes = commandOpCodes;
exports.port = port;

exports.echo = (buffer, callback) => {
  const buf = Buffer.from([buffer.length + 1, commandOpCodes.ECHO]); // length += 1, as it accounts for the opcode length (one byte) as well as data's length.
  const command = Buffer.concat([buf, buffer]);
  const expectedResponse = Buffer.from([buffer.length + 1, responseOpCodes.ECHO]);

  expectedResponseQueue.push(expectedResponse);
  callbackQueue.push(callback);

  writeCommand(command);
}

exports.init = (accessAddr, intMinMS, channel, callback) => {
  const command = Buffer.from([10, commandOpCodes.INIT, 0xd6, 0xbe, 0x89, 0x8e, 100, 0, 0, 0, 38]);
  const expectedResponse = Buffer.from([0x03, responseOpCodes.CMD_RSP, commandOpCodes.INIT, statusCodes.SUCCESS])

  expectedResponseQueue.push(expectedResponse);
  callbackQueue.push(callback);

  writeCommand(command);
}

exports.buildVersionGet = callback => {
  const command = Buffer.from([1, commandOpCodes.BUILD_VERSION_GET]);
  const expectedResponse = Buffer.from([6, responseOpCodes.CMD_RSP, commandOpCodes.BUILD_VERSION_GET, statusCodes.SUCCESS]);

  expectedResponseQueue.push(expectedResponse);
  callbackQueue.push(callback);

  writeCommand(command);
}

exports.accessAddrGet = callback => {
  const command = Buffer.from([1, commandOpCodes.ACCESS_ADDR_GET]);
  const expectedResponse = Buffer.from([0x07, responseOpCodes.CMD_RSP, commandOpCodes.ACCESS_ADDR_GET, statusCodes.SUCCESS]);

  expectedResponseQueue.push(expectedResponse);
  callbackQueue.push(callback);

  writeCommand(command);
}

exports.channelGet = callback => {
  const command = Buffer.from([1, commandOpCodes.CHANNEL_GET]);
  const expectedResponse = Buffer.from([0x04, responseOpCodes.CMD_RSP, commandOpCodes.CHANNEL_GET, statusCodes.SUCCESS])

  expectedResponseQueue.push(expectedResponse);
  callbackQueue.push(callback);

  writeCommand(command);
}

exports.intervalMinGet = callback => {
  const command = Buffer.from([1, commandOpCodes.INTERVAL_MIN_GET]);
  const expectedResponse = Buffer.from([0x07, responseOpCodes.CMD_RSP, commandOpCodes.INTERVAL_MIN_GET, statusCodes.SUCCESS])

  expectedResponseQueue.push(expectedResponse);
  callbackQueue.push(callback);

  writeCommand(command);
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
