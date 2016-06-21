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
                                'CHANNEL_GET' : 0x7d
                                });

let port = new SerialPort.SerialPort('COM44', {
  baudRate: 115200,
  rtscts: true
});

port.on('error', err => {
  if (err) {
    console.log('error: ', err.message);
  }
});

/*port.on('data', err => {
  if (err) {
    console.log(err);
  } else {
    console.log(data.toString('hex'));
  }
});*/

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

/** @brief initialization of rcb_mesh
 *  @details
 *  promts the slave to call rbc_mesh_init
 *  @param accessAddr pointer to 4 bytes containing the address
 *  @param chan Bluetooth channel to use. Must be 37, 38 or 39
 *  @param handleCount amount of handles in the system
 *  @param advInt_ms the lowest possible transmission interval
 *  @return True if the data was successfully queued for sending,
 *  false if there is no more space to store messages to send.
 *  or if chanNr is incorrect
 */
exports.init = (accessAddr, intMinMS, channel, callback) => {
  const command = Buffer.from([10, commandOpCodes.INIT, 0xd6, 0xbe, 0x89, 0x8e, 100, 0, 0, 0, 38]);
  const firstExpectedResponse = '0384';
  const secondExpectedResponse = '7000';

  port.write(command, err => {
    if (err) {
      callback(err);
    }
  });

  port.once('data', data => {
    if (data.toString('hex') !== firstExpectedResponse) {
      callback(new Error(`unexpected response from slave device: ${data.toString('hex')}`));
    } else {
      port.once('data', data => {
        if (data.toString('hex') !== secondExpectedResponse) {
          callback(new Error(`unexpected response from slave device: ${data.toString('hex')}`));
        } else {
          callback();
        }
      });
    }
  });
}

/** @brief read the build version
 *  @details
 *  Prompts the slave to return its build version
 */
exports.buildVersionGet = callback => {
  const command = Buffer.from([1, commandOpCodes.BUILD_VERSION_GET]);
  const expectedResponse = '06847b00';

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

/** @brief read the advertising address
 *  @details
 *  promts the slave to return the advertising address specified in the initialization
 */
exports.accessAddrGet = callback => {
  const command = Buffer.from([1, commandOpCodes.ACCESS_ADDR_GET]);
  const expectedResponse = '07847c00';

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

/** @brief read the operational channel
 *  @details
 *  promts the slave to return the operational channel specified in the initialization
 */
exports.channelGet = callback => {
  const command = Buffer.from([1, commandOpCodes.CHANNEL_GET]);
  const expectedResponse = '04847d00';

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