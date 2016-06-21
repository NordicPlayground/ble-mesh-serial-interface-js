'use strict';

const assert = require('assert');
const Enum = require('enum');
const SerialPort = require('serialport');


const commandOpCodes = new Enum({
                                'ECHO' : 0x02,
                                'RADIO_RESET' : 0x0e,
                                'BUILD_VERSION_GET' : 0x7b});

let port = new SerialPort.SerialPort('COM44', {
  baudRate: 115200,
  rtscts: true
});

port.on('error', err => {
  console.log('error: ', err.message);
});

exports.commandOpCodes = commandOpCodes;
exports.port = port;

/** @brief executes an echo-test
 *  @details
 *  Prompts the slave to echo whatever the buffer contains
 *  @param buffer containing bytes of data to echo
 */
exports.echo = buffer => {
  const buf = Buffer.from([buffer.length + 1, commandOpCodes.ECHO]); // length += 1, as it accounts for the opcode length (one byte) as well as data's length.
  const command = Buffer.concat([buf, buffer]);

  port.write(command, err => {
    if (err) {
      assert(false, `error when performing echo: ${err.message}`);
    }
    console.log('echo command sent');
  });
}

/** @brief read the build version
 *  @details
 *  Prompts the slave to return its build version
 */
exports.buildVersionGet = func => {
  const command = Buffer.from([1, commandOpCodes.BUILD_VERSION_GET]);
  const expected_result = '06847b00';

  port.write(command, err => {
    if (err) {
      assert(false, `error when performing build version get: ${err.message}`);
    }
    console.log('build version get command sent');
  });

  port.once('data', data => {
    assert(data.toString('hex').slice(0, 8) === expected_result, 'the CMD_RSP or status code from the slave device is not what we are expecting');
    func(data.toString('hex').slice(8));
  });
}

/** @brief Transmit a reset command to the slave
 *  @details
 *  The slave will do a software reset, calling NVIC_SystemReset(), effectively
 *  restarting the device, erasing all configuration and halting operation.
 *  To resume operation, the initialization process has to be redone.
 *  The command does not yield a command response, but the slave will transmit
 *  a DEVICE_STARTED event when it is ready to receive initialization commands.
 */
exports.radioReset = func => {
  const command = Buffer.from([1, commandOpCodes.RADIO_RESET]);
  const device_started_event = '0481000000';

  port.write(command, err => {
    if (err) {
      assert(false, `error when performing build version get: ${err.message}`);
    }
    console.log('radio reset command sent');
  });

  port.once('data', data => {
    console.log(data.toString('hex'));
    assert(data.toString('hex') === device_started_event, 'after we reset the device we did not get an expected device started event');
    func();
  });
}
