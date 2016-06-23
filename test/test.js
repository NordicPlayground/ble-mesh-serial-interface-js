'use strict';

var expect = require('chai').expect;

let BLEMeshSerialInterface = require('../index');

let MESH_ACCESS_ADDR = 0x8E89BED6;
let MESH_INTERVAL_MIN_MS = 100;
let MESH_CHANNEL = 38;

let MESH_ACCESS_ADDR_STRING = 'd6be898e';
let MESH_INTERVAL_MIN_MS_STRING = '64000000';
let MESH_CHANNEL_STRING = '26';

describe('#serial interface unit tests', () => {

    const index = new BLEMeshSerialInterface('COM44');

    beforeEach(done => {
        index._port.flush(err => {
          if (err) {
            console.log(err);
          }
          done();
        });
    });

    it('prompts slave to echo one byte back to host', done => {
      const buf = new Buffer([0x01]);

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
        done();
      }

      index.echo(buf, callback);
    });

    it('prompts slave to echo two bytes back to host', done => {
      const buf = new Buffer([0x01, 0x02]);

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
        done();
      }

      index.echo(buf, callback);
    });

    it('prompts slave to echo too many bytes back to host', done => {
        const buf = new Buffer(new Array(30).fill(0xff));

        let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
        done();
      }

      index.echo(buf, callback);
    });

    it('prompts the slave to return its build version', done => {
      const expected_result = '000803';

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      }

      index.buildVersionGet(callback);
    });

    it('prompts the slave to init the mesh', done => {
      let callback = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      }

      index.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_CHANNEL, callback);
    });

    it('value set', done => {
      let callback = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      }

      index.valueSet(0, new Buffer([0x00, 0x01, 0x02]), callback);
    });

    it('value get', done => {
      const expected_result = '000102';
      let callback = (err, data) => {
        if (err) {
          console.log(err);
          expect(data.toString('hex')).to.equal(expected_result);
        }
        done();
      }

      index.valueGet(0, callback);
    });

    it('value enable', done => {
      let callback = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      }

      index.valueEnable(0, callback);
    });

    it('value disable', done => {
      let callback = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      }

      index.valueDisable(0, callback);
    });

    it('prompts the slave to return its access address', done => {
      const expected_result = MESH_ACCESS_ADDR_STRING; // TODO: Figure out what is going on. Little endian?.

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      }

      index.accessAddrGet(callback);
    });

    it('prompts the slave to return its advertising channel', done => {
      const expected_result = MESH_CHANNEL_STRING;

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      }

      index.channelGet(callback);
    });

    it('prompts the slave to return its min interval', done => {
      const expected_result = MESH_INTERVAL_MIN_MS_STRING;

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      }

      index.intervalMinGet(callback);
    });

    it('sends multiple commands one after the other', done => {
      const buf = new Buffer([0x01]);

      let callback1 = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
      }

      index.echo(buf, callback1);

      const expected_result = '000803';

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      }

      index.buildVersionGet(callback);
    });

    it('prompts the slave to stop the mesh', done => {
      let callback = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      }

      index.stop(callback);
    });

    it('prompts the slave to start the mesh', done => {
      let callback = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      }

      index.start(callback);
    });

    it('prompts the slave to perform a radio reset', done => {
      let callback = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      }

      index.radioReset(callback);
    });

    it('complicated multi command test', done => {

      let callback1 = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
      }

      index.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_CHANNEL, callback1);

      const expected_result = MESH_ACCESS_ADDR_STRING; // TODO: Figure out what is going on. Little endian?.

      let callback2 = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
      }

      index.accessAddrGet(callback2);

      let callback3 = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
      }

      index.radioReset(callback3);

      /*const buf = new Buffer([0x01, 0x02]);

      let callback4 = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
      }

      index.echo(buf, callback4);

      const expected_result1 = '000803';

      let callback5 = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result1);
        done();
      }

      index.buildVersionGet(callback5);*/
    });
});
