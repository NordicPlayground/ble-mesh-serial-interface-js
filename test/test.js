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

describe('#echo', function() {
    it('prompts slave to echo one byte back to host', function(done) {
        var buffer = '\x01';
        var len = '\x01';
        var result = index.echo(buffer, len);
        expect(result).to.equal(true);
        index.port.on('data', function (data) {
          console.log('Data: ' + data);
          expect(data).to.equal(buffer);
          done()
        });
    });
});
