'use strict';

const BLEMeshSerialInterface = require('./BLEMeshSerialInterface');

const MESH_ACCESS_ADDR = 0x8E89BED6;
const MESH_INTERVAL_MIN_MS = 100;
const MESH_CHANNEL = 38;

const COM_PORT = 'COM45';

function checkError(err) {
  if (err) {
      console.log(err);
  }
}

const bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface(COM_PORT, err => {

  bleMeshSerialInterfaceAPI.on('deviceStarted', data => {
    console.log('device started, response: ', data);
  });

  bleMeshSerialInterfaceAPI.on('eventNew', data => {
    console.log(`eventNew, handle: ${data.slice(0, 2).toString('hex')}, data: ${data.slice(2).toString()}.`);
  });

  bleMeshSerialInterfaceAPI.on('eventUpdate', data => {
    console.log(`eventUpdate, handle: ${data.slice(0, 2).toString('hex')}, data: ${data.slice(2).toString()}.`);
  });

  bleMeshSerialInterfaceAPI.on('eventConflicting', data => {
    console.log(`eventConflicting, handle: ${data.slice(0, 2).toString('hex')}, data: ${data.slice(2).toString()}.`);
  });

  bleMeshSerialInterfaceAPI.on('eventTX', data => {
    console.log(`eventTX, response: ${data.slice(2).toString('hex')}.`);
  });

  bleMeshSerialInterfaceAPI.on('eventDFU', data => {
    console.log(`eventDFU, response: ${data.slice(2).toString('hex')}.`);
  });

  /*bleMeshSerialInterfaceAPI.radioReset(err => {
    checkError(err)
  });*/

});
