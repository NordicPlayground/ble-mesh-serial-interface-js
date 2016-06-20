'use strict';

const assert = require('assert');
const Enum = require('enum');
const SerialPort = require("serialport");


const HostCommandOpCodes = new Enum(['ECHO': 0x02,
                                   'RADIO_RESET' : 0x0E,
                                   'INIT' : 0x70,
                                   'VALUE_SET' : 0x71,
                                   'VALUE_ENABLE' : 0x72,
                                   'VALUE_DISABLE' : 0x73,
                                   'START' : 0x74,
                                   'STOP' : 0x75,
                                   'FLAG_SET' : 0x76,
                                   'FLAG_GET' : 0x77,
                                   'DFU_DATA' : 0x78,
                                   'VALUE_GET' : 0x7A,
                                   'BUILD_VERSION_GET' : 0x7B,
                                   'ACCESS_ADDR_GET' : 0x7C,
                                   'CHANNEL_GET' : 0x7D,
                                   'INTERVAL_MIN_MS_GET' : 0x7F]);

/*SerialPort.list(function (err, ports) {
  ports.forEach(function(port) {
    console.log(port.comName);
    console.log(port.pnpId);
    console.log(port.manufacturer);
  });
});*/

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
 *  Prompts the slave to echo whatever the buffer_bytes contains
 *  @param buffer_bytes of bytes containing data to echo
 *  @return None
 */
exports.echo = buffer_bytes => {
  const buf = Buffer.from([buffer_bytes.length + 1, HostCommandOpCodes.ECHO.value]); // length += 1, as it accounts for the opcode length (one byte) as well as data's length.
  const command = Buffer.concat(buf, buffer_bytes);

  port.write(command, err => {
    assert.equal(err, 0, `error when performing echo: ${err.message}`);
    console.log('echo command sent');
  });
}
