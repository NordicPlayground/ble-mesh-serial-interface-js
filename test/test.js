'use strict';

var expect = require('chai').expect;

let BLEMeshSerialInterface = require('../index');

const MESH_ACCESS_ADDR = 0x8E89BED6;
const MESH_INTERVAL_MIN_MS = 100;
const MESH_CHANNEL = 38;

const MESH_ACCESS_ADDR_STRING = 'd6be898e';
const MESH_INTERVAL_MIN_MS_STRING = '64000000';
const MESH_CHANNEL_STRING = '26';

const FIRST_COM_PORT = 'COM45';
const SECOND_COM_PORT = 'COM46';

function check_err(err) {
  if (err) {
      console.log(err);
  }
}

describe('helper function tests', function() {

  let bleMeshSerialInterfaceAPI;

  before(function(done) {
    bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface(FIRST_COM_PORT, err => {

      bleMeshSerialInterfaceAPI.once('deviceStarted', data => {
        console.log('device started: ', data);
        done();
      });

      bleMeshSerialInterfaceAPI.radioReset(err => {
        check_err(err)
      });
    });
  });

  after(function(done) {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      check_err(err);
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

describe('serial interface command unit tests -- tests are not self-contained', () => {
  let bleMeshSerialInterfaceAPI;

  before(function(done) {
    bleMeshSerialInterfaceAPI = new BLEMeshSerialInterface(FIRST_COM_PORT, err => {

      bleMeshSerialInterfaceAPI.once('deviceStarted', data => {
        console.log('device started: ', data);
        done();
      });

      bleMeshSerialInterfaceAPI.radioReset(err => {
        check_err(err)
      });
    });
  });

  after(function(done) {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      check_err(err);
      bleMeshSerialInterfaceAPI = null;
      done();
    });
  });

  it('prompts slave to echo one byte back to host', done => {
    const buf = new Buffer([0x01]);

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(buf.toString('hex'));
      done();
    });
  });

  it('prompts slave to echo two bytes back to host', done => {
    const buf = new Buffer([0x01, 0x02]);

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(buf.toString('hex'));
      done();
    });
  });

  it('prompts slave to echo too many bytes back to host', done => {
    const buf = new Buffer(new Array(30).fill(0xff));

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
    if (err) {
      console.log(err);
    }
    expect(res.toString('hex')).to.equal(buf.toString('hex'));
    done();
    });
  });

  it('prompts the slave to return its build version', done => {
    const expected_result = '000805';

    bleMeshSerialInterfaceAPI.buildVersionGet((err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(expected_result);
      done();
    });
  });

  it('prompts the slave to init the mesh', done => {
    bleMeshSerialInterfaceAPI.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_CHANNEL, err => {
      if (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
      done();
    });
  });

  it('prompts the slave to init the mesh, already inti so should fail', done => {
    bleMeshSerialInterfaceAPI.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_CHANNEL, err => {
      if (err) {
        console.log(err);
        done();
      }
      expect(false).to.equal(true);
    });
  });

  it('value set', done => {
    bleMeshSerialInterfaceAPI.valueSet(0, new Buffer([0x00, 0x01, 0x02]), err => {
      if (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
      done();
    });
  });

  it('value get', done => {
    const expected_result = '0000000102';

    bleMeshSerialInterfaceAPI.valueGet(0,(err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(expected_result);
      done();
    });
  });

  it('value set with value get directly after', done => {
    bleMeshSerialInterfaceAPI.valueSet(0, new Buffer([0x00, 0x01, 0x02]), err => {
      if (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
      const expected_result = '0000000102';

      bleMeshSerialInterfaceAPI.valueGet(0,(err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      });
    });
  });

  it('value set with value get directly after', done => {
    bleMeshSerialInterfaceAPI.valueSet(1, new Buffer([0x00, 0x01, 0x02]), err => {
      if (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
      const expected_result = '0100000102';

      bleMeshSerialInterfaceAPI.valueGet(1,(err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        bleMeshSerialInterfaceAPI.valueSet(1, new Buffer([0x00, 0x01, 0x03]), err => {
          if (err) {
            console.log(err);
            expect(false).to.equal(true);
          }
          const expected_result = '0100000103';

          bleMeshSerialInterfaceAPI.valueGet(1,(err, res) => {
            if (err) {
              console.log(err);
            }
            expect(res.toString('hex')).to.equal(expected_result);
            done();
          });
        });
      });
    });
  });

  it('value enable', done => {
    bleMeshSerialInterfaceAPI.valueEnable(0, err => {
      if (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
      done();
    });
  });

  it('value disable', done => {
    bleMeshSerialInterfaceAPI.valueDisable(0, err => {
      if (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
      done();
    });
  });

  it('prompts the slave to return its access address', done => {
    const expected_result = MESH_ACCESS_ADDR_STRING; // TODO: Figure out what is going on. Little endian?.

    bleMeshSerialInterfaceAPI.accessAddrGet((err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(expected_result);
      done();
    });
  });

  it('prompts the slave to return its advertising channel', done => {
    const expected_result = MESH_CHANNEL_STRING;

    bleMeshSerialInterfaceAPI.channelGet((err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(expected_result);
      done();
    });
  });

  it('prompts the slave to return its min interval', done => {
    const expected_result = MESH_INTERVAL_MIN_MS_STRING;

    bleMeshSerialInterfaceAPI.intervalMinGet((err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(expected_result);
      done();
    });
  });

  it('prompts the slave to stop the mesh', done => {
    bleMeshSerialInterfaceAPI.stop(err => {
      if (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
      done();
    });
  });

  it('prompts the slave to start the mesh', done => {
    bleMeshSerialInterfaceAPI.start(err => {
      if (err) {
        console.log(err);
        expect(false).to.equal(true);
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
        expect(false).to.equal(true);
      }
    });
  });

  it('prompts slave to echo two bytes back to host', done => {
    const buf = new Buffer([0x01, 0x02]);

    bleMeshSerialInterfaceAPI.echo(buf, (err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(buf.toString('hex'));
      done();
    });
  });

  it('sends dfu data packet', done => {
    const buf = new Buffer(new Array(23).fill(0xff));
    const handle = new Buffer([0xFF, 0xFE]);

    bleMeshSerialInterfaceAPI.dfuData(buf, (err, res) => {
      if (err) {
        console.log(err);
      }
      expect(res.toString('hex')).to.equal(handle.toString('hex'));
      done();
    });
  });

  /*it('tests a realistic use case', done => {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      if (err) {
        console.log(err);
      }

      bleMeshSerialInterfaceAPI = null;

      const ble = new BLEMeshSerialInterface(OPTIONAL_SECOND_COM_PORT, err => {
        ble.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_CHANNEL, err => {
          if (err) {
            console.log(err);
            expect(false).to.equal(true);
          }

          ble.valueSet(0, new Buffer([0x00, 0x01, 0x02]), err => {
            if (err) {
              console.log(err);
              expect(false).to.equal(true)
            }

            const expected_result = '0000000102';

            ble.valueGet(0,(err, res) => {
              if (err) {
                console.log(err);
              }

              expect(res.toString('hex')).to.equal(expected_result);

              bleMeshSerialInterfaceAPI.once('deviceStarted', () => {
                bleMeshSerialInterfaceAPI.closeSerialPort(err => {
                  console.log(err)
                  expect(false).to.equal(true);
                })
                done();
              });
              bleMeshSerialInterfaceAPI.radioReset(err => {
                if (err) {
                  console.log(err);
                  expect(false).to.equal(true);
                }
              });
            });
          });
        });
      });
    });
  });*/

  /*it('tests switching ports', done => {
    bleMeshSerialInterfaceAPI.closeSerialPort(err => {
      if (err) {
        console.log(err);
      }

      const ble = new BLEMeshSerialInterface(FIRST_COM_PORT, err => {
        if (err) {
          console.log(err);
        }
        const buf = new Buffer([0x01]);

        ble.echo(buf, (err, res) => {
          if (err) {
            console.log(err);
          }
          expect(res.toString('hex')).to.equal(buf.toString('hex'));
          ble.closeSerialPort(() => {
            ble.openSerialPort(OPTIONAL_SECOND_COM_PORT, err => {
              if (err) {
                console.log(err);
              }
              ble.echo(buf, (err, res) => {
                if (err) {
                  console.log(err);
                }
                expect(res.toString('hex')).to.equal(buf.toString('hex'));
                done();
              });
            });
          });
        });
      });
    });
  });*/

});
