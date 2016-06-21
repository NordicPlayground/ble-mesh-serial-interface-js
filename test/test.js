'use strict';

var expect = require('chai').expect;

var index = require('../index');

function check( done, f ) {
  try {
    f();
    done();
  } catch( e ) {
    done( e );
  }
}

describe('#echo unit tests', function() {

    beforeEach(function(done) {
        index.port.flush(() => {
          done();
        });
    });

    it('prompts slave to echo one byte back to host', function(done) {
        const buffer = Buffer.from([0x01]);
        const expected_result = '028201'; // Length (1+ 1), Echo OpCode, Data

        index.port.once('data', data => {
          expect(data.toString('hex')).to.equal(expected_result);
          done();
        });

        const result = index.echo(buffer);
        expect(result).to.equal(true);
    });

    it('prompts slave to echo two bytes back to host', function(done) {
        const buffer = Buffer.from([0x01, 0x02]);
        const expected_result = '03820102'; // Length (2 + 1?), Echo OpCode, Data

        index.port.once('data', data => {
          expect(data.toString('hex')).to.equal(expected_result);
          done();
        });

        const result = index.echo(buffer);
        expect(result).to.equal(true);
    });

    it('prompts slave to echo max bytes back to host', function(done) {
        const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04]);
        const expected_result = '1982010203040501020304050102030405010203040501020304';

        index.port.once('data', data => {
          expect(data.toString('hex')).to.equal(expected_result);
          done();
        });

        const result = index.echo(buffer);
        expect(result).to.equal(true);
    });

    it('prompts slave to echo max bytes back to host', function(done) {
        const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05]);
        const expected_result = '1a8201020304050102030405010203040501020304050102030405';

        index.port.once('data', data => {
          expect(data.toString('hex')).to.equal(expected_result);
          done();
        });

        const result = index.echo(buffer);
        expect(result).to.equal(true);
    });
});
