'use strict';

const assert = require('assert');
const SerialPort = require('serialport');


let port = new SerialPort.SerialPort('COM44', {
  baudRate: 115200,
  rtscts: true
});

port.on('error', err => {
  console.log('error: ', err.message);
})

exports.port = port

/** @brief executes an echo-test
 *  @details
 *  Prompts the slave to echo whatever the buffer contains
 *  @param buffer memory containing data to echo
 *  @return True if the data was successfully queued for sending,
 *  false if there is no more space to store messages to send.
 */
exports.echo = function(buffer) {
  const buf = Buffer.from([buffer.length + 1, 0x02]); // length += 1, as it accounts for the opcode length (one byte) as well as data's length.
  const command = Buffer.concat([buf, buffer]);

  port.write(command, err => {
    if (err) {
      console.log('error when performing echo: ', err.message);
      return false;
    }
    console.log('echo command sent');
  });
  return true;
}
