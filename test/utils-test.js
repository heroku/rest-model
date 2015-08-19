'use strict';

require('./test-helper');

var Utils = require('../lib/utils');

describe('RestModel.utils', function() {
  describe('arraysEqual', function() {
    describe('with arrays of strings', function() {
      it('should return false', function() {
        var arr1 = ['one', 'two'];
        var arr2 = ['two', 'three'];
        var result = Utils.arraysEqual(arr1, arr2);
        result.should.eql(false);
      });
      it('should return true', function() {
        var arr = ['one', 'two'];
        var result = Utils.arraysEqual(arr, arr);
        result.should.eql(true);
      });
    });
    describe('with arrays of objects', function() {
      it('should return false', function() {
        var arr1 = [{name: 'one'}, {name: 'two'}];
        var arr2 = [{name: 'two'}, {name: 'three'}];
        var result = Utils.arraysEqual(arr1, arr2);
        result.should.eql(false);
      });
      it('should return true', function() {
        var arr = [{name: 'one'}, {name: 'two'}];
        var result = Utils.arraysEqual(arr, arr);
        result.should.eql(true);
      });
    });
  });
});
