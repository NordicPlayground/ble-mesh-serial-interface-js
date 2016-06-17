'use strict';

var expect = require('chai').expect;

var index = require('../index');

describe('#echo', function() {
    it('Prompts slave to echo one byte back to host', function() {
        var buffer = '\x01';
        var len = '\x01';
        var result = index.echo(buffer, len);
        index.port.on('data', data => {
          console.log('Data: ' + data);
          expect(result).to.equal(true);
        });
    });
});
