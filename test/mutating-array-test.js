'use strict';

require('./test-helper');

describe('MutatingArray', function() {
  var arr;

  beforeEach(function() {
    arr = [1, 2, 3];
    arr = require('../lib/mutating-array').apply(arr);
    arr.set('filters', [
      function onlyOnes(item) {
        return item === 1;
      }
    ]);
    arr.replace(0, arr.length, arr);
  });

  it('immediately filters the array', function() {
    arr.toArray().should.eql([1]);
  });

  it('filters the array in the future', function() {
    arr.pushObjects([1, 2]).toArray().should.eql([1, 1]);
  });
});
