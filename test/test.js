'use strict';

var expect = require('chai').expect;

var index = require('../index');

describe('#serial interface unit tests', () => {

    beforeEach(done => {
        index.port.flush(err => {
          if (err) {
            console.log(err);
          }
          done();
        });
    });

    it('prompts slave to echo one byte back to host', done => {
      const buf = Buffer.from([0x01]);

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
      const buf = Buffer.from([0x01, 0x02]);

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
        const buf = Buffer.from(new Array(30).fill(0xff));

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

    it('prompts the slave to init the mesh', done => {
      let callback = err => {
        if (err) {
          console.log(err);
          expect(false).to.equal(true);
        }
        done();
      }

      index.init(0x8E89BED6, 5, 38, callback);
    });

    it('prompts the slave to return its access address', done => {
      const expected_result = 'd6be898e'; // TODO: Figure out what is going on. Little endian?.

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
      const expected_result = '26';

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      }

      index.channelGet(callback);
    });

    it('prompts the slave to return its advertising channel', done => {
      const expected_result = '64000000';

      let callback = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(expected_result);
        done();
      }

      index.intervalMinGet(callback);
    });

    /*it('sends multiple commands one after the other', done => {
      const buf = Buffer.from([0x01]);

      let callback1 = (err, res) => {
        if (err) {
          console.log(err);
        }
        expect(res.toString('hex')).to.equal(buf.toString('hex'));
        done();
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
    });*/

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
});
