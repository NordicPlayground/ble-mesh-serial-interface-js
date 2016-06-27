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

    const index = new BLEMeshSerialInterface('COM45');

    index.on('an_event', () => {
      console.log('launched an event')
    })

    beforeEach(done => {
        index._port.flush(err => {
          if (err) {
            console.log(err);
          }
          done();
        });
    });

    it('tests _buildResponse() on single command response', () => {
      const resp = new Buffer([0x03, 0x84, 0x74, 0x00]);

      index._buildResponse(resp);
      expect(index._responseQueue.shift().toString('hex')).to.equal(resp.toString('hex'));
      expect(index._tempBuildResponse).to.equal(null);
    });

    it('tests _buildResponse() on single event response', () => {
      const resp = new Buffer([0x03, 0xb3, 0x00, 0x00]);

      index._buildResponse(resp);
      expect(index._responseQueue.shift().toString('hex')).to.equal(resp.toString('hex'));
      expect(index._tempBuildResponse).to.equal(null);
    });

    it('tests _buildResponse() on two event responses', () => {
      const resp = new Buffer([0x04, 0xb3, 0x00, 0x00, 0x00, 0x05, 0xb4, 0x00, 0x00, 0x00, 0x00]);

      index._buildResponse(resp);
      expect(index._responseQueue.shift().toString('hex')).to.equal(resp.slice(0, 5).toString('hex'));
      expect(index._responseQueue.shift().toString('hex')).to.equal(resp.slice(5).toString('hex'));
      expect(index._tempBuildResponse).to.equal(null);
    });

    it('tests _buildResponse() on a broken up response', () => {
      const resp1 = new Buffer([0x06, 0xb3, 0x00, 0x00]);
      const resp2 = new Buffer([0x00, 0x00, 0x00]);

      const expectedResp = Buffer.concat([resp1, resp2]);

      index._buildResponse(resp1);
      index._buildResponse(resp2);
      expect(index._responseQueue.shift().toString('hex')).to.equal(expectedResp.toString('hex'));
      expect(index._tempBuildResponse).to.equal(null);
    });

    it('tests _buildResponse() on a broken up response followed by two resopnse', () => {
      const resp1 = new Buffer([0x06, 0xb3, 0x00, 0x00]);
      const resp2 = new Buffer([0x00, 0x00, 0x00, 0x04, 0xb4, 0x00, 0x00, 0x00]);

      const expectedResp = Buffer.concat([resp1, resp2]);

      index._buildResponse(resp1);
      index._buildResponse(resp2);
      expect(index._responseQueue.shift().toString('hex')).to.equal(expectedResp.slice(0, 7).toString('hex'));
      expect(index._responseQueue.shift().toString('hex')).to.equal(expectedResp.slice(7).toString('hex'));
      expect(index._tempBuildResponse).to.equal(null);
    });

    it('tests _isCommandResponse()', () => {
      const resp = new Buffer([0x01, 0x82]);

      let res = index._isCommandResponse(resp);
      expect(res).to.equal(true);

      const resp2 = new Buffer([0x01, 0x84]);

      res = index._isCommandResponse(resp2);
      expect(res).to.equal(true);

      const resp3 = new Buffer([0x0]);

      res = index._isCommandResponse(resp3);
      expect(res).to.equal(true);

      const resp4 = new Buffer([0x1, 0x81]);

      res = index._isCommandResponse(resp4);
      expect(res).to.equal(false);

    });

    /*it('prompts slave to echo one byte back to host', done => {
      const buf = new Buffer([0x01]);

      index.once('echo_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
        done();
      });

      index.echo(buf);
    });

    it('prompts slave to echo two bytes back to host', done => {
      const buf = new Buffer([0x01, 0x02]);

      index.once('echo_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
        done();
      });

      index.echo(buf);
    });

    it('prompts slave to echo too many bytes back to host', done => {
        const buf = new Buffer(new Array(30).fill(0xff));

        index.once('echo_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
        done();
      });

      index.echo(buf);
    });

    it('prompts the slave to return its build version', done => {
      const expected_result = '000803';

      index.once('cmd_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      });

      index.buildVersionGet();
    });

    it('prompts the slave to init the mesh', done => {

      index.once('cmd_rsp', err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      });

      index.init(MESH_ACCESS_ADDR, MESH_INTERVAL_MIN_MS, MESH_CHANNEL);
    });

    it('value set', done => {
      index.once('cmd_rsp', err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      });


      index.valueSet(0, new Buffer([0x00, 0x01, 0x02]));
    });

    it('value get', done => {
      const expected_result = '0000000102';
      index.once('cmd_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      });

      index.valueGet(0);
    });

    it('value enable', done => {
      index.once('cmd_rsp', err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      });

      index.valueEnable(0);
    });

    it('value disable', done => {
      index.once('cmd_rsp', err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      });

      index.valueDisable(0);
    });

    it('prompts the slave to return its access address', done => {
      const expected_result = MESH_ACCESS_ADDR_STRING; // TODO: Figure out what is going on. Little endian?.

      index.once('cmd_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      });

      index.accessAddrGet();
    });

    it('prompts the slave to return its advertising channel', done => {
      const expected_result = MESH_CHANNEL_STRING;

      index.once('cmd_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      });

      index.channelGet();
    });

    it('prompts the slave to return its min interval', done => {
      const expected_result = MESH_INTERVAL_MIN_MS_STRING;

      index.once('cmd_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      });

      index.intervalMinGet();
    });

    it('sends multiple commands one after the other', done => {
      const buf = new Buffer([0x01]);

      index.once('echo_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
      });

      index.echo(buf);

      const expected_result = '000803';

      index.once('cmd_rsp', (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      });

      index.buildVersionGet();
    });

    it('prompts the slave to stop the mesh', done => {
      index.once('cmd_rsp', err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      });

      index.stop();
    });

    it('prompts the slave to start the mesh', done => {
      index.once('cmd_rsp', err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      });

      index.start();
    });

    it('prompts the slave to perform a radio reset', done => {
      index.once('cmd_rsp', err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      });

      index.radioReset();
    });*/
});
