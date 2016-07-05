'use strict';

const expect = require('chai').expect;
const assert = require('chai').assert;

const BLEMeshSerialInterface = require('../BLEMeshSerialInterface');

const MESH_ACCESS_ADDR = 0x8E89BED6;
const MESH_INTERVAL_MIN_MS = 100;
const MESH_ADVERTISING_CHANNEL = 38;

const MESH_ACCESS_ADDR_ARRAY = [0xD6, 0xBE, 0x89, 0x8E];
const MESH_INTERVAL_MIN_MS_ARRAY = [100, 0, 0, 0];
const MESH_ADVERTISING_CHANNEL_ARRAY = [38];

const FIRST_COM_PORT = 'COM45';

function checkError(err) {
  if (err) {
      console.log(err);
  }
}

function arraysEqual(arr1, arr2) {
    if(arr1.length !== arr2.length)
        return false;
    for(let i = arr1.length; i--;) {
        if(arr1[i] !== arr2[i])
            return false;
    }

    return true;
}

describe('helper function tests', function() {

  let bleMeshSerialInterfaceAPI;

  before(function(done) {
    bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface(FIRST_COM_PORT, err => {

      bleMeshSerialInterfaceAPI.once('deviceStarted', data => {
        done();
      });

      bleMeshSerialInterfaceAPI.radioReset(err => {
        checkError(err)
      });
    });
  });

  after(function(done) {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      checkError(err);
      bleMeshSerialInterfaceAPI = null;
      done();
    });
  });

  it('tests bleMeshSerialInterfaceAPI.buildResponse() on single command response', () => {
    const resp = new Buffer([0x03, 0x84, 0x74, 0x00]);

    bleMeshSerialInterfaceAPI.buildResponse(resp);
    expect(bleMeshSerialInterfaceAPI._responseQueue.shift().toString('hex')).to.equal(resp.toString('hex'));
    expect(bleMeshSerialInterfaceAPI._tempBuildResponse).to.equal(null);
  });

  it('tests bleMeshSerialInterfaceAPI.buildResponse() on single event response', () => {
    const resp = new Buffer([0x03, 0xb3, 0x00, 0x00]);

    bleMeshSerialInterfaceAPI.buildResponse(resp);
    expect(bleMeshSerialInterfaceAPI._responseQueue.shift().toString('hex')).to.equal(resp.toString('hex'));
    expect(bleMeshSerialInterfaceAPI._tempBuildResponse).to.equal(null);
  });

  it('tests bleMeshSerialInterfaceAPI.buildResponse() on two event responses', () => {
    const resp = new Buffer([0x04, 0xb3, 0x00, 0x00, 0x00, 0x05, 0xb4, 0x00, 0x00, 0x00, 0x00]);

    bleMeshSerialInterfaceAPI.buildResponse(resp);
    expect(bleMeshSerialInterfaceAPI._responseQueue.shift().toString('hex')).to.equal(resp.slice(0, 5).toString('hex'));
    expect(bleMeshSerialInterfaceAPI._responseQueue.shift().toString('hex')).to.equal(resp.slice(5).toString('hex'));
    expect(bleMeshSerialInterfaceAPI._tempBuildResponse).to.equal(null);
  });

  it('tests bleMeshSerialInterfaceAPI.buildResponse() on a response that comes in two data events', () => {
    const resp1 = new Buffer([0x06, 0xb3, 0x00, 0x00]);
    const resp2 = new Buffer([0x00, 0x00, 0x00]);

    const expectedResp = Buffer.concat([resp1, resp2]);

    bleMeshSerialInterfaceAPI.buildResponse(resp1);
    bleMeshSerialInterfaceAPI.buildResponse(resp2);
    expect(bleMeshSerialInterfaceAPI._responseQueue.shift().toString('hex')).to.equal(expectedResp.toString('hex'));
    expect(bleMeshSerialInterfaceAPI._tempBuildResponse).to.equal(null);
  });

  it('tests bleMeshSerialInterfaceAPI.buildResponse() on a broken up response followed by two responses', () => {
    const resp1 = new Buffer([0x06, 0xb3, 0x00, 0x00]);
    const resp2 = new Buffer([0x00, 0x00, 0x00, 0x04, 0xb4, 0x00, 0x00, 0x00]);

    const expectedResp = Buffer.concat([resp1, resp2]);

    bleMeshSerialInterfaceAPI.buildResponse(resp1);
    bleMeshSerialInterfaceAPI.buildResponse(resp2);
    expect(bleMeshSerialInterfaceAPI._responseQueue.shift().toString('hex')).to.equal(expectedResp.slice(0, 7).toString('hex'));
    expect(bleMeshSerialInterfaceAPI._responseQueue.shift().toString('hex')).to.equal(expectedResp.slice(7).toString('hex'));
    expect(bleMeshSerialInterfaceAPI._tempBuildResponse).to.equal(null);
  });

  it('tests bleMeshSerialInterfaceAPI.isCommandResponse()', () => {
    const resp = new Buffer([0x01, 0x82]);

    let res = bleMeshSerialInterfaceAPI.isCommandResponse(resp);
    expect(res).to.equal(true);

    const resp2 = new Buffer([0x01, 0x84]);

    res = bleMeshSerialInterfaceAPI.isCommandResponse(resp2);
    expect(res).to.equal(true);

    const resp3 = new Buffer([0x0]);

    res = bleMeshSerialInterfaceAPI.isCommandResponse(resp3);
    expect(res).to.equal(true);

    const resp4 = new Buffer([0x1, 0x81]);

    res = bleMeshSerialInterfaceAPI.isCommandResponse(resp4);
    expect(res).to.equal(false);
  });
});


describe('nRF Open Mesh serial interface command unit tests -- tests are not self-contained', () => {
  let bleMeshSerialInterfaceAPI;

  before(function(done) {
    bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface(FIRST_COM_PORT, err => {

      bleMeshSerialInterfaceAPI.once('deviceStarted', data => {
        done();
      });

      bleMeshSerialInterfaceAPI.radioReset(err => {
        checkError(err)
      });
    });
  });

  after(function(done) {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      checkError(err);
      bleMeshSerialInterfaceAPI = null;
      done();
    });
  });

  it('prompts slave to echo one byte back to host', done => {
    const buf = [0x01];

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('prompts slave to echo two bytes back to host', done => {
    const buf = [0x01, 0x02];

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('prompts slave to echo too many bytes back to host', done => {
    const buf = new Array(30).fill(0xff);

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('prompts slave to return its build version', done => {
    const buf = [0x0, 0x8, 0x5];

    bleMeshSerialInterfaceAPI.buildVersionGet((err, res) => {
      checkError(err);
      console.log(res);
      assert(arraysEqual(buf, res), 'unexpected build version returned');
      done();
    });
  });

  it('prompts slave to initialize the mesh', done => {
    bleMeshSerialInterfaceAPI.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_ADVERTISING_CHANNEL, err => {
      if (err) {
        console.log(err);
        assert(false, 'error initializing the device');
      }
      done();
    });
  });

  it('prompts slave to set the persistence of handle 1', done => {
    bleMeshSerialInterfaceAPI.flagSet(1, err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to set the persistence flag of handle 1');
      }
      done();
    });
  });

  it('prompts slave to get the persistence of handle 1', done => {
    bleMeshSerialInterfaceAPI.flagGet(1, (err, res) => {
      checkError(err);
      assert(arraysEqual(res, [1, 0, 0, 1]), 'persistence of handle 1 has not been set yet');
      done();
    });
  });

  it('prompts slave to set the tx event on handle 1', done => {
    bleMeshSerialInterfaceAPI.txEventSet(1, err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to set the tx event on handle 1');
      }
      done();
    });
  });

  it('prompts slave to get the tx event of handle 1', done => {
    bleMeshSerialInterfaceAPI.txEventGet(1, (err, res) => {
      checkError(err);
      assert(arraysEqual(res, [1, 0, 0, 1]), 'tx event on handle 1 has not been set yet');
      done();
    });
  });

  it('prompts slave to initialize the mesh, already initialize so should fail with status code error', done => {
    bleMeshSerialInterfaceAPI.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_ADVERTISING_CHANNEL, err => {
      if (err) {
        console.log(err);
        done();
      }
      assert(false, 'error, should not have succeeded to initialize an already initialized device');
    });
  });

  it('prompts slave to set the value of handle 0', done => {
    bleMeshSerialInterfaceAPI.valueSet(0, [0x00, 0x01, 0x02], err => {
      if (err) {
        console.log(err);
        assert(false, 'error setting the value of a handle on the mesh');
      }
      done();
    });
  });

  it('prompts slave to get the value of handle 0', done => {
    const buf = [0, 0, 0x00, 0x01, 0x02]; // TODO: should just be the value, not handle first.

    bleMeshSerialInterfaceAPI.valueGet(0, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'incorrect value for handle 0');
      done();
    });
  });

  it('set the value of a handle, and then get it directly after', done => {
    const buf = [0x00, 0x01, 0x02];

    bleMeshSerialInterfaceAPI.valueSet(0, buf, err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to set the value of handle 0');
      }

      bleMeshSerialInterfaceAPI.valueGet(0, (err, res) => {
        checkError(err);
        assert(arraysEqual(res, [0, 0, 0, 1, 2]), 'value of handle 0 is not what we set it to');
        done();
      });
    });
  });

  it('prompts slave to enable handle 1', done => {
    bleMeshSerialInterfaceAPI.valueEnable(1, err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to enable handle 1');
      }
      done();
    });
  });

  it('prompts slave to disable handle 1', done => {
    bleMeshSerialInterfaceAPI.valueDisable(1, err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to disable handle 1');
      }
      done();
    });
  });

  it('prompts slave to return its access address', done => {
    bleMeshSerialInterfaceAPI.accessAddrGet((err, res) => {
      checkError(err);
      assert(arraysEqual(MESH_ACCESS_ADDR_ARRAY, res), 'incorrect mesh access address');
      done();
    });
  });

  it('prompts slave to return its advertising channel', done => {
    bleMeshSerialInterfaceAPI.channelGet((err, res) => {
      checkError(err);
      assert(arraysEqual(MESH_ADVERTISING_CHANNEL_ARRAY, res), 'incorrect mesh advertising channel');
      done();
    });
  });

  it('prompts slave to return its minimum rebroadcasting interval', done => {
    bleMeshSerialInterfaceAPI.intervalMinGet((err, res) => {
      checkError(err);
      assert(arraysEqual(MESH_INTERVAL_MIN_MS_ARRAY, res), 'incorrect minimum rebroadcasting interval');
      done();
    });
  });

  it('prompts slave to stop the mesh from broadcasting', done => {
    bleMeshSerialInterfaceAPI.stop(err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to stop the mesh from broadcasting');
      }
      done();
    });
  });

  it('prompts slave to start broadcasting on the mesh', done => {
    bleMeshSerialInterfaceAPI.start(err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to start broadcasting on the mesh');
      }
      done();
    });
  });

  it('prompts the slave to perform a radio reset', done => {
    bleMeshSerialInterfaceAPI.once('deviceStarted', () => {
      done();
    });
    bleMeshSerialInterfaceAPI.radioReset(err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to reset the slave');
      }
    });
  });

  it('prompts slave to echo two bytes back to host', done => {
    const buf = [0x01, 0x02];

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('sends dfu data packet', done => { // This should fail since the FW doesn't have a bootloader/isn't configured for DFU.
    const buf = new Array(23).fill(0xff);

    bleMeshSerialInterfaceAPI.dfuData(buf, (err, res) => {
      if (err) {
        console.log(err);
        done();
      }
    });
  });
});


describe('nRF Open Mesh self contained serial interface unit tests', () => {
  let bleMeshSerialInterfaceAPI;

  beforeEach(function(done) {
    bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface(FIRST_COM_PORT, err => {

      bleMeshSerialInterfaceAPI.once('deviceStarted', data => {
        done();
      });

      bleMeshSerialInterfaceAPI.radioReset(err => {
        checkError(err)
      });
    });
  });

  afterEach(function(done) {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      checkError(err);
      bleMeshSerialInterfaceAPI = null;
      done();
    });
  });

  it('prompts slave to echo one byte back to host', done => {
    const buf = [0x01];

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('prompts slave to echo two bytes back to host', done => {
    const buf = [0x01, 0x02];

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });
});

/*describe('nRF Open Mesh self contained DFU serial interface unit tests', () => {
  let bleMeshSerialInterfaceAPI;

  beforeEach(function(done) {
    const fwid = [0x11, 0x78, 0xfe, 0xff, 0x64, 0, 1, 1, 0x59, 0, 0, 0, 1, 0, 1, 0, 0, 0];
    bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface(FIRST_COM_PORT, err => {

      bleMeshSerialInterfaceAPI.once('eventDFU', data => {
        assert(arraysEqual(fwid, data), 'incorrect DFU Beacon (FWID) received from device');
        done();
      });

      bleMeshSerialInterfaceAPI.radioReset(err => {
        checkError(err)
      });
    });
  });

  afterEach(function(done) {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      checkError(err);
      bleMeshSerialInterfaceAPI = null;
      done();
    });
  });

  it('prompts slave to echo one byte back to host', done => {
    const buf = [0x01];

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('sends dfu fwid data packet', done => {
    const fwid = [0xfe, 0xff, 0x64, 0, 1, 1, 0x59, 0, 0, 0, 1, 0, 2, 0, 0, 0];
    const ackFWID = [0xfe, 0xff];
    const expectedEvent = [0xfd, 0xff];

    bleMeshSerialInterfaceAPI.once('eventDFU', data => {
        assert(arraysEqual(expectedEvent, data.slice(2, 4)), 'incorrect DFU event received in protocol');
        done();
      });

    bleMeshSerialInterfaceAPI.dfuData(fwid, (err, res) => {
      checkError(err);
      assert(arraysEqual(ackFWID, res), 'incorrect DFU FWID ACK received from device');
    });
  });
});*/

/*describe('BLE Smart Mesh serial interface command unit tests -- tests are not self-contained', () => {
  let bleMeshSerialInterfaceAPI;

  before(function(done) {
    bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface(FIRST_COM_PORT, err => {
      checkError(err);
      bleMeshSerialInterfaceAPI.on('deviceStarted', data => {
      });
      done();
    });
  });

  after(function(done) {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      checkError(err);
      bleMeshSerialInterfaceAPI = null;
      done();
    });
  });

  it('prompts slave to echo one byte back to host', done => {
    const buf = [0x01];

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('prompts slave to echo two bytes back to host', done => {
    const buf = [0x01, 0x02];

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('prompts slave to echo too many bytes back to host', done => {
    const buf = new Array(30).fill(0xff);

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'echoed data is not equal to what was sent');
      done();
    });
  });

  it('prompts slave to return its build version', done => {
    const buf = [1, 0];

    bleMeshSerialInterfaceAPI.getVersion((err, res) => {
      checkError(err);
      assert(arraysEqual(buf, res), 'unexpected build version returned');
      done();
    });
  });

  it('prompts slave to set its key-pair for use in encrypting provisioning data', done => {
    bleMeshSerialInterfaceAPI.setKeyPair(err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to set key-pair');
      }
      done();
    });
  });

  it('prompts slave to set its provisioning capabilities', done => {
    bleMeshSerialInterfaceAPI.setCapabilities(err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to set key-pair');
      }
      done();
    });
  });

  it('prompts slave to initialize a provisioning context', done => {
    const contextID = 2;

    bleMeshSerialInterfaceAPI.provInitContext(contextID, (err, res) => {
      checkError(err);
      assert(arraysEqual(contextID, res[0]), 'failed to initialize a provisioning context');
      done();
    });
  });

  it('prompts slave to start scanning for un-provisioned devices', done => {
    bleMeshSerialInterfaceAPI.provStartScan(err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to start scanning');
      }
      done();
    });
  });

  it('prompts slave to stop scanning for un-provisioned devices', done => {
    bleMeshSerialInterfaceAPI.provStopScan(err => {
      if (err) {
        console.log(err);
        assert(false, 'failed to stop scanning');
      }
      done();
    });
  });

});
*/