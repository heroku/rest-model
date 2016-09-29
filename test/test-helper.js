'use strict';

require('should');

var benv  = require('benv');
var sinon = require('sinon');

global.context = describe;

before(function(done) {
  benv.setup(function() {
    global.jQuery       = require('../bower_components/jquery/dist/jquery.min.js');
    global.$            = jQuery;
    global.Handlebars   = benv.require('../bower_components/handlebars/handlebars.min.js');
    global.Ember        = benv.require('../bower_components/ember/ember.debug.js', 'Ember');

    done();
  });
});

beforeEach(function() {
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
