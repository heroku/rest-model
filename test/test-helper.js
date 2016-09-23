'use strict';

require('should');

var benv  = require('benv');
var sinon = require('sinon');

global._localStorage = {
  _cache: {},

  getItem: function(key) {
    return this._cache[key];
  },

  setItem: function(key, value) {
    this._cache[key] = value;
    return value;
  },

  removeItem: function(key) {
    delete this._cache[key];
  },

  clear: function() {
    this._cache = {};
  }
};

global.context = describe;
global.localStorage = _localStorage;

before(function(done) {
  benv.setup(function() {
    global.jQuery       = require('../bower_components/jquery/dist/jquery.min.js');
    global.$            = jQuery;
    global.Handlebars   = benv.require('../bower_components/handlebars/handlebars.min.js');
    global.Ember        = benv.require('../bower_components/ember/ember.debug.js', 'Ember');
    // account for fact that Ember 2.7 and later don't think we have a DOM while we are testing
    // which means that Ember.$ never gets defined
    global.Ember.$      = jQuery;

    done();
  });
});

beforeEach(function() {
  global.localStorage = _localStorage;
  localStorage.clear();

  var self = this;

  this.resolve = null;
  this.reject  = null;
  this.afterRequest = function() {};

  jQuery.ajax = sinon.stub().returns({
    then: function(resolve, reject) {
      if (self.resolve) {
        setTimeout(function() {
          resolve(self.resolve, 'success', { status: 200 });
          self.afterRequest();
        }, 5);
      } else if (self.reject) {
        setTimeout(function() {
          reject(self.reject, 'notfound', { status: 404 });
          self.afterRequest();
        }, 5);
      } else {
        resolve(null);
      }
    }
  });
});
