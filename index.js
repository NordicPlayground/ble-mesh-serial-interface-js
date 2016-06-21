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
  if (err) {
    console.log('error: ', err.message);
  }
});

port.on('data', err => {
  if (err) {
    console.log(err);
  } else {
    console.log(data.toString('hex'));
  }
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
exports.buildVersionGet = callback => {
  const command = Buffer.from([1, commandOpCodes.BUILD_VERSION_GET]);
  const expectedResponse = '06847b00'; // TODO: What is Status Code?

  port.write(command, err => {
    if (err) {
      callback(err);
    }
  });

  port.once('data', data => {
    if (data.toString('hex').slice(0, 8) !== expectedResponse) {
      callback(new Error(`unexpected response from slave device: ${data.toString('hex')}`));
    } else {
      callback(null, data.toString('hex').slice(8));
    }
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
exports.radioReset = callback => {
  const command = Buffer.from([1, commandOpCodes.RADIO_RESET]);
  const deviceStartResp = '00';
  const deviceStartedResponse = '0481020004';

  port.write(command, err => {
    if (err) {
      callback(err);
    }
  });

  port.once('data', data => {
    if (data.toString('hex') !== deviceStartResp) {
      callback(new Error(`unexpected response from slave device: ${data.toString('hex')}`));
    } else {
      port.once('data', data => {
        if (data.toString('hex') !== deviceStartedResponse) {
          callback(new Error(`unexpected response from slave device: ${data.toString('hex')}`));
        } else {
          callback();
        }
      });
    }
  });
}
