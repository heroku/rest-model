'use strict';

var utils         = require('./lib/utils');
var observer      = Ember.observer;
var computed = Ember.computed;
var capitalize = Ember.String.capitalize;

/**
 * Provides a suite of functionality around interacting with a resource on the
 * web using AJAX requests.
 *
 * @class RestModel
 * @extends Ember.Object
 * @constructor
 * @param {Object} attributes the attributes to initialize the instance with
 */
module.exports = Ember.Object.extend({
  isRestModelClass: true,
  /**
   * Initialize a new instance of this class. Does so by first setting the
   * initial properties to the `originalProperties` value and by defining the
   * `dirtyProperties` property.
   *
   * @method init
   * @private
   */
  init: function() {
    this.setOriginalProperties();
    /**
     * The value of this instance's primary key. Found by iterating over the
     * class's `primaryKeys` property until this instance has a value for a
     * primary key.
     *
     * @property primaryKey
     * @private
     * @type {String,Number}
     */
    this._definePrimaryKey();

    /**
      * A list of the dirty properties on this instance.
      *
      * @property dirtyProperties
      * @type {Array}
      */
    this._defineDirtyProperties();
  },

  /**
   * A declared array of attributes of this class. These are the attributes that
   * are relied upon for the `isDirty` property, as well as other functionality.
   * Objects are not supported, but flat arrays are.
   *
   * For attributes that are arrays, indicate them as `property.[]`.
   *
   * @property attrs
   * @type {Array}
   */
  attrs: computed(function() {
    return [];
  }),

  /**
   * Whether or not the instance is "in flight", meaning that it has AJAX
   * requests in process.
   *
   * @property inFlight
   * @type {Boolean}
   */
  inFlight: Ember.computed.bool('requestPool'),

  /**
   * If the declared properties (`attrs`) of the instance are the same as their
   * original values. The opposite of `isDirty`.
   *
   * @property isClean
   * @type {Boolean}
   */
  isClean: Ember.computed.empty('dirtyProperties'),

  /**
   * If any of the declared properties (`attrs`) of the instance are different
   * from their original values. The opposite of `isClean`.
   *
   * @property isDirty
   * @type {Boolean}
   */
  isDirty: Ember.computed.notEmpty('dirtyProperties'),

  /**
   * Whether or not the record is new (has not been persisted). This property
   * should almost certainly be overriden.
   *
   * @property isNew
   * @type {Boolean}
   */
  isNew: Ember.computed.none('primaryKey'),

  /**
   * Whether or not the record has been persisted. The opposite of `isNew`.
   *
   * @property isPersisted
   * @type {Boolean}
   */
  isPersisted: Ember.computed.not('isNew'),

  /**
   * The names of the declared `attributes` without their observable modifiers
   * (e.g. will return `['tags']`, not `['tags.[]']`).
   *
   * @property attrNames
   * @private
   * @type {Array}
   */
  attrNames: computed('attrs', function() {
    return this.get('attrs').map(function(attr) {
      if (/\.\[\]$/.test(attr)) {
        return attr.split('.')[0];
      } else {
        return attr;
      }
    });
  }),

  /**
   * The parents of this instance.
   *
   * TODO: This must either be volatile or created in `init` as a computed
   *       property based on the values in `parentKeyNames`.
   *
   * @property parents
   * @private
   * @type {Object}
   */
  parents: computed(function() {
    var parentKeyNames = this.constructor.getParentKeyNames();

    return parentKeyNames.reduce(function(parents, key) {
      parents[key] = this.get(key);
      return parents;
    }.bind(this), {});
  }).volatile(),

  /**
   * A path pointing to this instance, typically the class's base path joined
   * with the `primaryKey` of this instance. Will throw an error if a parent
   * necessary for building the path is lacking a primary key.
   *
   * @property path
   * @type {String}
   */
  path: computed('isPersisted', 'primaryKey', 'parents', function() {
    var primaryKey = this.get('isPersisted') ? this.get('primaryKey') : null;
    var parents    = this.get('parents');

    return this.constructor.buildPath(parents, primaryKey);
  }),


  /**
   * Delete this instance.
   *
   * @method delete
   * @async
   * @param {Object} [options] options to pass through to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved when this instance has been
   *   deleted
   * @example
   * ```javascript
   * post.delete();
   * ```
   */
  delete: function(options) {
    return this.request('deleting', function() {
      options = utils.extend({
        url : this.get('path'),
        type: 'DELETE'
      }, options);

      return this.constructor.ajax(options);
    }.bind(this));
  },

  /**
   * Fetch this instance.
   *
   * @method fetch
   * @async
   * @param {Object} [options] options to pass through to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with this instance once it
   *   has been fetched
   * @example
   * ```javascript
   * post.fetch();
   * ```
   */
  fetch: function(options) {
    return this.request('fetching', function() {
      options = utils.extend({
        url : this.get('path'),
        type: 'GET'
      }, options);

      return this.constructor.request(options, {}, this).then(function(data) {
        var properties = this.constructor.getUpdatableProperties(data);
        this.setProperties(properties);
        //we assume that these must in fact be the original properties
        this.setOriginalProperties();
        return this;
      }.bind(this));
    }.bind(this));
  },

  /**
   * Set the given parameter as `is#{parameter.capitalize()}` as well as
   * `inFlight` to `true` while the given function is in flight. When it is
   * resolved or rejected, set those properties to `false`.
   *
   * TODO: Need to handle the case where the same model performs the same
   *       operation at the same time, multiple times (e.g. #save and #save
   *       simultaneously).
   *
   * @method request
   * @private
   * @param {String} type the type of request the instance is entering
   * @param {Function} doRequest a function returning a promise whose finished
   *   state removes an item from the request pool
   */
  request: function(type, doRequest) {
    type = `is${capitalize(type)}`;

    this.set(type, true);
    this.incrementProperty('requestPool');

    return doRequest().finally(function() {
      this.set(type, false);
      this.decrementProperty('requestPool');
    }.bind(this));
  },

  /**
   * Revert this instance's properties back to their original values.
   *
   * @method revert
   */
  revert: function() {
    var attrs = this.get('attrs');

    this.get('attrNames').forEach(function(key, i) {
      var value = Ember.copy(this.get(`originalProperties.${key}`));

      if (/\.\[\]$/.test(attrs[i])) {
        this.get(key).setObjects(value);
      } else {
        this.set(key, value);
      }
    }.bind(this));
  },

  /**
   * Save this instance. If the instance is new, do a 'POST' request to the
   * class's base path, otherwise, use 'PATCH' to this instance's path.
   *
   * @method save
   * @async
   * @param {Object} [options] options to pass through to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with this instnace once it
   *   has been saved
   * @example
   * ```javascript
   * post.save();
   * ```
   */
  save: function(options) {
    var type = this.get('isNew') ? 'POST' : 'PATCH';

    return this.request('saving', function() {
      options = utils.extend({
        url : this.get('path'),
        type: type,
        data: this.serialize()
      }, options);

      return this.constructor.ajax(options).then(function(response) {
        return response.data;
      }.bind(this)).then(function(data) {
        this.setProperties(data);
        this.setOriginalProperties();
        return this;
      }.bind(this));
    }.bind(this));
  },

  /**
   * Set an object containing the original values of the instance's properties.
   *
   * @method setOriginalProperties
   * @private
   */
  setOriginalProperties: function() {
    var attrNames = this.get('attrNames');

    this.set('originalProperties', attrNames.reduce(function(properties, key) {
      var value = this.get(key);
      properties.set(key, Ember.copy(value, true));
      return properties;
    }.bind(this), Ember.Object.create()));
  },

  /**
   * Calculates dirty properties. Implements the logic behind the
   * 'dirtyProperties' property.
   *
   * @method getDirtyProperties
   * @private
   */
  getDirtyProperties: function() {
    var attrNames          = this.get('attrNames');
    var originalProperties = this.get('originalProperties');

    return attrNames.reduce(function(changedProperties, key) {
      var value         = this.get(key);
      var originalValue = originalProperties.get(key);

      if (Ember.isArray(value)) {
        if (!utils.arraysEqual(value, originalValue)) {
          changedProperties.push(key);
        }
      } else if (Ember.$.isPlainObject(value)) {
        if(!utils.objectsEqual(value, originalValue)) {
          changedProperties.push(key);
        }
      } else if (!Ember.isEqual(value, originalValue)) {
        changedProperties.push(key);
      }

      return changedProperties;
    }.bind(this), []);
  },

  /**
   * Serialize this object into JSON for sending in AJAX requests and for
   * persistent caching.
   *
   * @method serialize
   * @private
   */
  serialize: function() {
    return JSON.stringify(this.toObject());
  },

  /**
   * Get an object representation of this instance using keys from the `attrs`
   * property.
   *
   * @method toObject
   * @return {Object} the plain object representation of this instance
   */
  toObject: function() {
    return this.get('attrNames').reduce(function(properties, key) {
      var value = this.get(key);
      properties[key] = value;
      return properties;
    }.bind(this), {});
  },

  /**
   * Defines the 'primaryKey' property during initialization, as it depends
   * on the 'primaryKeys' constructor property.
   *
   * @method _definePrimaryKey
   * @static
   * @private
   */
  _definePrimaryKey: function() {
    var keyNames = this.constructor.primaryKeys;
    var args = this.constructor.primaryKeys.concat({
      get: function() {
        var key, value;
        for (var i = 0; i < keyNames.length; i++) {
          key   = keyNames[i];
          value = this.get(key);

          if (!Ember.isNone(value)) {
            return value;
          }
        }
      },
      set: function(key, _, setValue) {
        if (this.get('primaryKey') !== setValue) {
          this.set(keyNames[0], setValue);
        }
        return setValue;
      }
    });
    var primaryKey = Ember.computed.apply(Ember, args);
    Ember.defineProperty(this, 'primaryKey', primaryKey);
  },
  /*
   * Defines the property 'dirtyProperties'. Used during initialization.
   *
   * @method _defineDirtyProperties
   * @private
   */
  _defineDirtyProperties: function() {
    var args = this.get('attrs')
                   .concat('originalProperties', this.getDirtyProperties);
    var dirtyProperties = Ember.computed.apply(Ember, args);
    Ember.defineProperty(this, 'dirtyProperties', dirtyProperties);
  }
}).reopenClass({
  /**
   * The lowercase string version of the name of this class, used for caching
   * purposes. This must be overridden.
   *
   * @property typeKey
   * @static
   * @type String
   */
  typeKey: '',

  /**
   * An array of properties used to fetch and persist records. An array is used
   * because multiple properties may be used as primary keys in an API, e.g.
   * "id" and "name".
   *
   * @property primaryKeys
   * @static
   * @type Array
   * @default ['id']
   */
  primaryKeys: ['id'],

  /**
   * A namespace under which to nest all AJAX requests for this class. This is
   * commonly something like 'api'.
   *
   * @property namespace
   * @static
   * @type String
   * @default null
   */
  namespace: null,

  /**
   * The base path used to fetch, persist, and destroy records. Must not begin
   * with or end with a forward slash ('/').
   *
   * @property base
   * @static
   * @type String
   * @default ''
   */
  base: '',

  /**
   * An array of filters that will be called on each array returned by this
   * class.
   *
   * @property filters
   * @static
   * @type Array<Function>
   * @default []
   */
  filters: [],

  /**
   * Perform an AJAX request.
   *
   * @method ajax
   * @async
   * @static
   * @param {Object} options options to define the AJAX request
   * @param {String} options.url the path or URL to make the request to
   * @param {String} [options.type='GET'] the HTTP method used to make the
   *   request
   * @param {String} [options.data] a JSON string of data to send as the
   *   request body
   * @return {Ember.RSVP.Promise} a promise resolved with an instance or array
   *   of instances of this class, as well as the original response data, once
   *   the request has completed
   * ```
   */
  ajax: function(options) {
    var ajaxOptions = {
      type       : 'GET',
      dataType   : 'json',
      contentType: 'application/json'
    };

    utils.extend(ajaxOptions, options);

    return new Ember.RSVP.Promise(function(resolve, reject) {
      Ember.$.ajax(ajaxOptions).then(function(data, _text, jqXHR) {
        jqXHR = jqXHR || {};
        if (Ember.isArray(data)) {
          data = this.deserializeArray(data);
        } else {
          data = this.deserialize(data);
        }

        resolve({ data: data, status: jqXHR.status });
      }.bind(this), function(jqXHR) {
        delete jqXHR.then;
        reject(jqXHR);
      });
    }.bind(this));
  },

  /**
   * Fetch all records for this class.
   *
   * @method all
   * @static
   * @async
   * @param {Object} [parents] the parents of this resource, with either
   *   instances or primary keys as values
   * @param {Object} [options] options to pass on to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with an array of instances
   *   of this class
   * @example
   * ```javascript
   * Post.all();
   *
   * // With parents
   * Comment.all({ post: 1 });
   * ```
   */
  all: function(parents, options) {
    options = utils.extend({
      url : this.buildPath(parents),
      type: 'GET'
    }, options);

    var processingOptions = { parents: parents };

    return this.request(options, processingOptions).then(function(results) {
      return results;
    });
  },

  /**
   * Add an object of parents to the given path.
   *
   * @method addParentsToPath
   * @static
   * @private
   * @param {Object} parents the parents to add to the given path
   * @param {String} path the path to add the parents to
   * @return {String} the path with parent primary keys interpolated
   */
  addParentsToPath: function(parents, path) {
    Ember.$.each(parents, function(key, parent) {
      var parentKey = parent;

      if (typeof parent !== 'string' && typeof parent !== 'number') {
        parentKey = parent.get('primaryKey');
      }
      path = path.replace(`/:${key}`, `/${parentKey}`);
    });

    return path;
  },

  /**
   * Assert that the given object of parent keys is enough for the base path of
   * this class. Throws an error if there are parent keys missing.
   *
   * @method assertHasParentKeys
   * @static
   * @private
   * @param {Object} parents the parents to validate are sufficient for this
   *   class
   */
  assertHasParentKeys: function(parents) {
    this.getParentKeyNames().forEach(function(key) {
      var parent     = parents[key];
      var primaryKey = parent ? this.getPrimaryKey(parent) : null;

      if (Ember.isNone(primaryKey)) {
        throw new Error(`No primary key found for parent "${key}".`);
      }
    }.bind(this));
  },

  /**
   * Build a path to this resource, adding parent keys and a primary key (if
   * supplied).
   *
   * @method buildPath
   * @static
   * @private
   * @param {Array} [parents] the parent keys or objects to use in the path
   * @param {Number,String} [primaryKey] a primary to be appended to the path
   * @return {String} the path including any given primary key
   */
  buildPath: function(parents, primaryKey) {
    var path = '/' + this.base;

    if (!Ember.$.isPlainObject(parents)) {
      primaryKey = parents;
      parents    = {};
    }

    this.assertHasParentKeys(parents);
    path = this.addParentsToPath(parents, path);

    if (!Ember.isNone(primaryKey)) {
      path += '/' + primaryKey;
    }

    if (!Ember.isNone(this.namespace)) {
      path = '/' + this.namespace + path;
    }

    return path;
  },

  /**
   * Deserialize data into a desirable format for updating and creating
   * instances of this class. By default, this is a no-op.
   *
   * @method deserialize
   * @static
   * @private
   * @param {Object} data the data to be deserialized
   * @return {Object} (optionally) transformed data object
   */
  deserialize: function(data) {
    return data;
  },

  /**
   * Deserialize an array of objects into an array of objects formatted for
   * updating and creating instances of this class.
   *
   * @method deserializeArray
   * @static
   * @private
   * @param {Array} data an array of objects to be deserialized
   * @return {Array} an array of (optionally) transformed objects
   */
  deserializeArray: function(data) {
    return data.map(this.deserialize.bind(this));
  },

  /**
   * Find a record by primary key.
   *
   * @method find
   * @async
   * @static
   * @param {Number,String} primaryKey the primary key used to find a record
   * @param {Object} [options] options to pass on to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with an instance of this
   *   class
   * ```javascript
   * Post.find(1);
   * ```
   */
  find: function(parents, primaryKey, options) {
    if (!Ember.$.isPlainObject(parents)) {
      options    = primaryKey;
      primaryKey = parents;
      parents    = {};
    }

    options = utils.extend({
      url : this.buildPath(parents, primaryKey),
      type: 'GET'
    }, options);

    return this.request(options)
      .then(this.create.bind(this)).then(function(model) {
        model.setProperties(parents);
        return model;
      });
  },

  /**
   * Get the names of the parent keys for this class.
   *
   * @method getParentKeyNames
   * @static
   * @private
   * @return {Array} the names of the parent keys based on the class's base
   */
  getParentKeyNames: function() {
    var matches = this.base.match(/\/:[^\/]+/g) || [];

    return matches.map(function(segment) {
      return segment.replace('/:', '');
    });
  },

  /**
   * Return either the value (if it is a simple value) or the primary key
   * of the given object.
   *
   * @method getPrimaryKey
   * @static
   * @private
   * @param {RestModel,String,Number} object the object to get the primary key
   *   from
   * @return {String,Number} a primary key
   */
  getPrimaryKey: function(object) {
    if (typeof object === 'number' || typeof object === 'string') {
      return object;
    } else {
      return object.get('primaryKey');
    }
  },

  /**
   * Transform results from an API request into an instance or array of
   * instances of this class.
   *
   * Accepts an object of parent properties to ensure that new
   * records always have a reference to their parent records.
   *
   * @method toResult
   * @static
   * @private
   * @param {Array,Object} response an object or array of objects
   * @param {Object} [parents={}] an object of parent properties to set on the
   *   object or array of objects
   * @return {Array,RestModel} an instance or array of instances of this class
   */
  toResult: function(response, parents) {
    parents = parents || {};

    if (Ember.isArray(response)) {
      var content = response.map(function(item) {
        var result = this.create(item);
        result.setProperties(parents);
        return result;
      }.bind(this));

      return this.runFilters(content);
    } else {
      var result = this.create(response);
      result.setProperties(parents);
      return result;
    }
  },

  replace: function(idx, amt, objects) {
    var filters = this.filters;

    filters.forEach(function applyFilter(filter) {
      objects = objects.filter(filter);
    });

    return objects;
  },

  runFilters: observer('filters.[]', function(items) {
    return this.replace(0, items.length, items);
  }),

  /**
   * Request a given resource. Will use caching if the request is a "GET"
   * request.
   *
   * @method request
   * @async
   * @static
   * @param {Object} options options to pass on to the AJAX request
   * @param {Object} [processingOptions] options that control how the
   *   deserialized response is processed
   * @param {RestModel} updateModel a model to be updated after a later API
   *   request instead of the original model returned
   * @param {Function} [processingOptions.toResult=RestModel.toResult] a
   *   function used to convert the response body into an instance or array of
   *   instances of RestModel
   * @return {Ember.RSVP.Promise} a promise resolved with an instance or array
   *   of instances from the AJAX request
   * @example
   * ```javascript
   * Post.request({
   *   type: 'POST',
   *   url : '/custom-url',
   *   data: { foo: 'bar' }
   * });
   * ```
   */
  request: function(options, processingOptions, updateModel) {
    processingOptions = utils.extend({
      toResult   : this.toResult.bind(this)
    }, processingOptions);

    return this.ajax(options).then(function(response) {
      // If you pass the option to return the payload from fetch(),
      // this will set the raw response of that request to a property on the
      // instance at fetchRawPayload.
      if (options.returnPayload) {
        updateModel.set(`raw`, response.data);
      }
      var parents = processingOptions.parents;
      return processingOptions.toResult(response.data, parents);
    });
  },

  /**
   * A list of attributes that can be used to update a cached object after an
   * AJAX call has been made. Meant to exclude special properties added by
   * RestModel.
   *
   * @method getUpdatableProperties
   * @static
   * @private
   * @param {RestModel} model the model to pull properties from
   * @return {Array} an array of property names
   */
  getUpdatableProperties: function(model) {
    var keys = Object.keys(model).filter(function(key) {
      return ['primaryKey', 'originalProperties', 'dirtyProperties'].indexOf(key) === -1;
    });

    return model.getProperties(keys);
  },

  /**
   * Bug in RestModel calls `create` with an instance in `toResult`, which will
   * set computed properties. This is not allowed in Ember 1.11.
   * To get around this, iterate through the object and pull out any computed
   * properties, passing those to .extend() before calling create()
   *
   * @method create
   */

  create: function (attrs) {
    attrs = attrs || {};

    if (attrs.isRestModelClass) {
      var prop = {};
      var cp = {};

      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val instanceof Ember.ComputedProperty) {
          cp[key] = val;
        } else {
          prop[key] = val;
        }
      });
      this.extend(cp);
      return this._super.call(this, prop);
    }
    return this._super.call(this, attrs);
  }
});
