'use strict';

var SerialPort = require('serialport');

/*SerialPort.list(function (err, ports) {
  ports.forEach(function(port) {
    console.log(port.comName);
    console.log(port.pnpId);
    console.log(port.manufacturer);
  });
});*/

var port = new SerialPort.SerialPort('COM44', {
  baudRate: 115200,
  rtscts: true
});

port.on('error', function(err) {
  console.log('Error: ', err.message);
})

exports.port = port

/** @brief executes an echo-test
 *  @details
 *  Prompts the slave to echo whatever the buffer contains
 *  @param buffer memory containing data to echo
 *  @param len amount of data to send
 *  @return True if the data was successfully queued for sending,
 *  false if there is no more space to store messages to send.
 */
exports.echo = function(buffer, len) {
  port.write(len + '\x02' + buffer, function(err) {
    if (err) {
      console.log('Error when performing echo: ', err.message);
      return false;
    }
    console.log('echo command sent');
  });
  return true;
}
