'use strict';

const assert = require('assert');
const SerialPort = require('serialport');


let port = new SerialPort.SerialPort('COM44', {
  baudRate: 115200,
  rtscts: true
});

port.on('error', err => {
  console.log('error: ', err.message);
});

exports.port = port;

/** @brief executes an echo-test
 *  @details
 *  Prompts the slave to echo whatever the buffer contains
 *  @param buffer containing bytes of data to echo
 */
exports.echo = buffer => {
  const buf = Buffer.from([buffer.length + 1, 0x02]); // length += 1, as it accounts for the opcode length (one byte) as well as data's length.
  const command = Buffer.concat([buf, buffer]);

  port.write(command, err => {
    if (err) {
      assert(false, `error when performing echo: ${err.message}`);
    }
    console.log('echo command sent');
  });
}

/** @brief read the build_version
 *  @details
 *  Prompts the slave to return its build version
 */
exports.buildVersionGet = () => {
  const command = Buffer.from([0x01, 0x7b]);

  port.write(command, err => {
    if (err) {
      assert(false, `error when performing build version get: ${err.message}`);
    }
    console.log('build version get command sent');
  });
}
