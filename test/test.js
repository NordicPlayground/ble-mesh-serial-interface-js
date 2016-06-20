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
        var buffer = '\x01';
        var len = '\x02';
        var result = index.echo(buffer, len);
        var expected_result = '028201'; // Length (1 + 1?), Echo OpCode, Data
        expect(result).to.equal(true);
        index.port.once('data', (data) => {
          console.log('test1()...');
          console.log('Data: ' + data.toString('hex'));
          expect(data.toString('hex')).to.equal(expected_result);
          done();
        });
    });

    it('prompts slave to echo two bytes back to host', function(done) {
        var buffer = '\x01\x02';
        var len = '\x03';

        var expected_result = '03820102'; // Length (2 + 1?), Echo OpCode, Data

        index.port.once('data', (data) => {
          console.log('test2()...');
          console.log('Data: ' + data.toString('hex'));
          expect(data.toString('hex')).to.equal(expected_result);
          done();
        });

        var result = index.echo(buffer, len);
        expect(result).to.equal(true);
    });

    it('prompts slave to echo max bytes back to host', function(done) {
        var buffer = '\x01\x02\x03\x04\x05\x01\x02\x03\x04\x05\x01\x02\x03\x04\x05\x01\x02\x03\x04\x05\x01\x02\x03\x04\x05\x01\x02\x03\x04';
        var len = '\x1E'; // 29 (28+1) which is the max data len that can be echoed.

        var expected_result = '1E8201020102030405010203040501020304050102030405010203040501020304'; // Length (29 + 1?), Echo OpCode, Data

        index.port.once('data', (data) => {
          console.log('test3()...');
          console.log('Data: ' + data.toString('hex'));
          expect(data.toString('hex')).to.equal(expected_result);
          done();
        });

        var result = index.echo(buffer, len);
        expect(result).to.equal(true);
    });
});
