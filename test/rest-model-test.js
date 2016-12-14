// Allow wrapping IIFEs in parens for testing thrown errors.
// jshint -W068

// Allow expressions in place of function calls (for be.true, etc)
// jshint -W030

'use strict';

require('./test-helper');

var should = require('should');
var sinon  = require('sinon');

describe('RestModel', function() {
  var Comment, Post, RestModel, post;

  before(function() {
    RestModel = require('../index');

    Post = RestModel.extend({
      attrs: Ember.computed(function() {
        return Ember.A(['name', 'tags.[]']);
      }),

      tags: Ember.computed(function() {
        return Ember.A([]);
      }),

      object: Ember.computed(function() {
        return {foo: 'bar'};
      })
    }).reopenClass({
      primaryKeys: ['id'],
      typeKey    : 'post',
      base       : 'posts'
    });

    Comment = RestModel.extend().reopenClass({
      typeKey: 'comment',
      base   : 'posts/:post/comments'
    });
  });

  beforeEach(function() {
    post = Post.create();
  });

  describe('.dirtyProperties', function() {
    context('when no attributes have changed', function() {
      it('is empty', function() {
        post.get('dirtyProperties').should.eql([]);
      });
    });

    context('when a one-level complex object is virtually identical', function() {
      var instance;
      beforeEach(function() {
        instance = RestModel.extend({
          attrs: Ember.computed(function() {
            return ['object'];
          }),
          object: Ember.computed(function() {
            return {foo: 'bar'};
          })
        }).create();
      });

      it('should be empty', function() {
        instance.get('dirtyProperties').should.eql([]);
      });
    });

    context('when a simple attribute has changed', function() {
      it('includes that property', function() {
        post.set('name', 'new-name');
        post.get('dirtyProperties').should.eql(['name']);
      });
    });

    context('when an array attribute has changed', function() {
      it('includes that property', function() {
        post.get('tags').pushObject('draft');
        post.get('dirtyProperties').should.eql(['tags']);
        post.get('tags').removeObject('draft');
        post.get('dirtyProperties').should.eql([]);
      });
    });

    context('when getDirtyProperties is overridden', function() {
      it('uses that functionality', function() {
        post.reopen({
          getDirtyProperties: function() {
            var current  = this.get('name.foo.bar');
            var original = this.get('originalPropeties.name.foo.bar');
            console.log(current, original);
            return current === original ? [] : ['name'];
          }
        });
        post.get('dirtyProperties').should.eql([]);
        post.set('name', { foo: { bar: 'baz' }});
        post.get('dirtyProperties').should.eql(['name']);
      });
    });
  });

  describe('.isClean', function() {
    context('when no attributes have changed', function() {
      it('is true', function() {
        post.get('isClean').should.be.true;
      });
    });

    context('when a simple attribute has changed', function() {
      it('is false', function() {
        post.set('name', 'new-name');
        post.get('isClean').should.be.false;
      });
    });
  });

  describe('.isDirty', function() {
    context('when no attributes have changed', function() {
      it('is false', function() {
        post.get('isDirty').should.be.false;
      });
    });

    context('when a simple attribute has changed', function() {
      it('is true', function() {
        post.set('name', 'new-name');
        post.get('isDirty').should.be.true;
      });
    });

    context('when an array attribute has changed', function() {
      it('is true', function() {
        post.get('tags').pushObject('draft');
        post.get('isDirty').should.be.true;
      });
    });
  });

  describe('.isNew', function() {
    context('when there is no primary key', function() {
      it('is true', function() {
        post.get('isNew').should.be.true;
      });
    });

    context('when there is a primary key', function() {
      it('is false', function() {
        post.set('id', 1);
        post.get('isNew').should.be.false;
      });
    });

    context('when the primary key changes', function() {
      it('should not use previously cached value', function() {
        post.get('isNew').should.be.true;
        post.set('id', 2);
        post.get('isNew').should.be.false;
      });
    });
  });

  describe('path', function() {
    context('when a namespace is specified', function() {
      it('respects the namespace', function() {
        RestModel
          .extend()
          .reopenClass({ namespace: 'foo', base: 'bar' })
          .create()
          .get('path')
          .should.eql('/foo/bar');
      });
    });

    context('when there is a primary key', function() {
      it('is the base class path with a primary key', function() {
        post.set('id', 1);
        post.get('path').should.eql('/posts/1');
      });
    });

    context('when there is no primary key', function() {
      it('is the base class path', function() {
        post.get('path').should.eql('/posts');
      });
    });

    context('when the record has parents', function() {
      it('includes the parents in the path', function() {
        var comment = Comment.create({ post: post, id: 2 });
        post.set('id', 1);
        comment.get('path').should.eql('/posts/1/comments/2');
      });

      context('and a parent is missing a primary key', function() {
        it('throws an error', function() {
          var comment = Comment.create({ post: post, id: 2 });

          (function() {
            comment.get('path');
          }).should.throw('No primary key found for parent "post".');
        });
      });
    });
  });

  describe('#delete', function() {
    context('when there is a primary key', function() {
      var args;

      beforeEach(function() {
        this.resolve = {};
        post.set('id', 1);
        post.delete();
        args = jQuery.ajax.lastCall.args;
      });

      it('temporarily sets the isDeleting and inFlight properties', function(done) {
        this.resolve = {};

        post.delete().then(function() {
          post.get('isDeleting').should.be.false;
          post.get('inFlight').should.be.false;
          done();
        });

        post.get('isDeleting').should.be.true;
      });

      it('deletes the record with the instance path', function() {
        args[0].url.should.eql(post.get('path'));
      });

      it('deletes the record with the a DELETE', function() {
        args[0].type.should.eql('DELETE');
      });

      it('accepts custom options', function() {
        post.delete({ url: '/posts/custom-path' });
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/custom-path');
      });
    });
  });

  describe('#fetch', function() {
    beforeEach(function() {
      this.resolve = {};
    });

    it('does not break dirtyProperties', function(done) {
      this.resolve = { id: 1, email: 'first-email@example.com' };
      post.set('id', 1);

      return post.fetch().then(function() {
        post.get('dirtyProperties').should.be.an.Array;
        post.get('dirtyProperties.length').should.equal(0);
        done();
      });
    });

    context('when there is a primary key', function() {
      var args;

      beforeEach(function() {
        post.set('id', 1);
        return post.fetch().then(function() {
          args = jQuery.ajax.lastCall.args;
        });
      });

      it('temporarily sets the isFetching and inFlight properties', function(done) {
        this.resolve = {};

        post.fetch().then(function() {
          post.get('isFetching').should.be.false;
          post.get('inFlight').should.be.false;
          done();
        });

        post.get('isFetching').should.be.true;
      });


      it('fetches the record with the instance path', function() {
        args[0].url.should.eql('/posts/1');
      });

      it('fetches the record with the a GET', function() {
        args[0].type.should.eql('GET');
      });

      it('accepts custom options', function() {
        return post.fetch({ url: '/posts/custom-path' }).then(function() {
          jQuery.ajax.lastCall.args[0].url.should.eql('/posts/custom-path');
        });
      });

      it('updates the record attributes with the response', function() {
        this.resolve = { id: 4, name: 'Test Post' };
        return post.fetch().then(function() {
          post.get('id').should.eql(4);
          post.get('name').should.eql('Test Post');
        });
      });

      it('still knows how to build a path', function() {
        return post.fetch().then(function() {
          post.get('path').should.eql('/posts/1');
        });
      });
    });
  });

  describe('#revert', function() {
    beforeEach(function() {
      post = Post.create({ name: 'foo' });
      post.set('name', 'bar');
      post.get('tags').pushObject('draft');
      post.revert();
    });

    it('reverts back to the original properties', function() {
      post.get('name').should.eql('foo');
    });

    it('reverts array properties', function() {
      post.get('tags').toArray().length.should.eql(0);
    });

    it('reverts array properties in a KVO-friendly way', function() {
      var changed;

      Post.reopen({
        change: Ember.observer('tags.[]', function() {
          changed = true;
        })
      });

      post = Post.create();
      post.get('tags').pushObject('foo');
      changed = false;
      post.revert();
      changed.should.be.true;
    });
  });

  describe('#save', function() {
    var args;

    beforeEach(function() {
      this.resolve = { id: 1, name: 'Test Post' };
    });

    context('when there is no primary key', function() {
      beforeEach(function() {
        Post._primaryKeys = Post.primaryKeys;
        Post.primaryKeys = [];
      });

      afterEach(function() {
        Post.primaryKeys = Post._primaryKeys;
        delete Post._primaryKeys;
      });

      it('does not throw an error', function(done) {
        (function() {
          post.save().then(function() {
            done();
          });
        }).should.not.throw();
      });
    });

    it('temporarily sets the isSaving and inFlight properties', function(done) {
      this.resolve = { id: 1 };

      post.save().then(function() {
        post.get('isSaving').should.be.false;
        post.get('inFlight').should.be.false;
      }).then(done);

      post.get('isSaving').should.be.true;
    });

    it('updates the record attributes with the response', function() {
      this.resolve = { name: 'Test Post' };

      return post.save().then(function() {
        post.get('name').should.eql('Test Post');
      });
    });

    it('accepts custom options', function() {
      return post.save({ url: '/posts/custom-path' }).then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/custom-path');
      });
    });

    it('is not dirty afterwards', function() {
      this.resolve = { id: 1, name: 'Test Post' };

      post.set('name', 'Test Post');
      post.get('isDirty').should.eql(true);

      return post.save().then(function() {
        post.get('isDirty').should.eql(false);
      });
    });

    it('saves with a serialized form of the record', function() {
      post.set('name', 'bar');

      return post.save().then(function() {
        jQuery.ajax.lastCall.args[0].data.should.eql('{"name":"bar","tags":[]}');
      });
    });

    context('when there is no primary key', function() {
      beforeEach(function() {
        return post.save().then(function() {
          args = jQuery.ajax.lastCall.args;
        });
      });

      it('saves with a POST', function() {
        args[0].type.should.eql('POST');
      });

      it('saves with the class base path', function() {
        args[0].url.should.eql('/' + Post.base);
      });
    });

    context('when there is a primary key', function() {
      beforeEach(function() {
        post.set('id', 1);

        return post.save().then(function() {
          args = jQuery.ajax.lastCall.args;
        });
      });

      it('saves the record with the instance path', function() {
        args[0].url.should.eql(post.get('path'));
      });

      it('saves the record with the a PATCH', function() {
        args[0].type.should.eql('PATCH');
      });
    });
  });

  describe('::ajax', function() {
    it('defaults to GET', function() {
      this.resolve = {};
      return Post.ajax().then(function() {
        jQuery.ajax.lastCall.args[0].type.should.eql('GET');
      });
    });

    it('defaults to json dataType', function() {
      this.resolve = {};
      return Post.ajax().then(function() {
        jQuery.ajax.lastCall.args[0].dataType.should.eql('json');
      });
    });

    it('defaults to application/json contentType', function() {
      this.resolve = {};
      return Post.ajax().then(function() {
        jQuery.ajax.lastCall.args[0].contentType.should.eql('application/json');
      });
    });

    it('accepts custom options', function() {
      this.resolve = {};
      return Post.ajax({ type: 'POST' }).then(function() {
        jQuery.ajax.lastCall.args[0].type.should.eql('POST');
      });
    });

    it('returns a promise that resolves with the response data', function() {
      this.resolve = { foo: 'bar' };

      return Post.ajax().then(function(response) {
        response.data.should.eql({ foo: 'bar' });
      });
    });

    it('returns a promise that depromisifies its reject value', function() {
      this.reject = { then: 'looks-like-a-promise' };

      return Post.ajax().then(null, function(jqXHR) {
        should(jqXHR.then).eql(undefined);
      });
    });

    describe('deserialization', function() {
      var Model;

      before(function() {
        Model = RestModel.extend().reopenClass({
          deserialize: function(data) {
            data.foo = 'transformed';
            return data;
          }
        });
      });

      it('deserializes objects', function() {
        this.resolve = { foo: 'bar' };

        return Model.ajax().then(function(response) {
          response.data.should.eql({ foo: 'transformed' });
        });
      });

      it('deserializes arrays', function() {
        this.resolve = [{ foo: 'bar' }];

        return Model.ajax().then(function(response) {
          response.data.should.eql([{ foo: 'transformed' }]);
        });
      });
    });
  });

  describe('::all', function() {
    beforeEach(function() {
      this.resolve = [];
    });

    it('does a GET request', function() {
      return Post.all().then(function() {
        jQuery.ajax.lastCall.args[0].type.should.eql('GET');
      });
    });

    it('does a request to the base path', function() {
      return Post.all().then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/' + Post.base);
      });
    });

    it('accepts custom options', function() {
      return Post.all(null, { url: '/posts/all' }).then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/all');
      });
    });

    it('resolves with a deserialized array of instances', function() {
      this.resolve = [{ name: 'foo' }];
      return Post.all().then(function(instances) {
        instances[0].get('name').should.eql('foo');
      });
    });

    context('when the model requires parents', function() {
      context('when given parents', function() {
        it('uses the parents to build the path', function() {
          return Comment.all({ post: 1 }).then(function() {
            jQuery.ajax.lastCall.args[0].url.should.eql('/posts/1/comments');
          });
        });

        it('adds the parents to the results', function() {
          this.resolve = [{ id: 1 }];

          return Comment.all({ post: 5 }).then(function(comments) {
            comments[0].get('post').should.eql(5);
          });
        });
      });

      context('when not given parents', function() {
        it('throws an error', function() {
          (function() {
            Comment.all();
          }).should.throw('No primary key found for parent "post".');
        });
      });
    });
  });

  describe('::find', function() {
    beforeEach(function() {
      this.resolve = [];
    });

    it('does a GET request', function() {
      return Post.find(1).then(function() {
        jQuery.ajax.lastCall.args[0].type.should.eql('GET');
      });
    });

    it('does a request to the base path with primary key', function() {
      return Post.find(1).then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/' + Post.base + '/1');
      });
    });

    it('accepts custom options', function() {
      return Post.find(1, { url: '/posts/all' }).then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/all');
      });
    });

    it('resolves with a deserialized instance', function() {
      this.resolve = { name: 'foo' };
      return Post.find(1).then(function(instance) {
        instance.get('name').should.eql('foo');
      });
    });

    context('when the model requires parents', function() {
      context('when given parents', function() {
        it('uses the parents to build the path', function() {
          return Comment.find({ post: 1 }, 2).then(function() {
            jQuery.ajax.lastCall.args[0].url.should.eql('/posts/1/comments/2');
          });
        });

        it('adds the parents to the result', function() {
          this.resolve = [{ id: 1 }];

          return Comment.find({ post: 5 }, 1).then(function(comment) {
            comment.get('post').should.eql(5);
          });
        });
      });

      context('when not given parents', function() {
        it('throws an error', function() {
          (function() {
            Comment.find(1);
          }).should.throw('No primary key found for parent "post".');
        });
      });
    });
  });

  describe('::request', function() {
    context('when it is not a GET request', function() {
      var ajaxStub;

      beforeEach(function() {
        ajaxStub = sinon.stub(RestModel, 'ajax').returns({
          then: function(resolve) {
            resolve({data: null, status: 200});
          }
        });

        return RestModel.request({
          type: 'POST'
        });
      });

      afterEach(function() {
        ajaxStub.restore();
      });

      it('performs an AJAX request with the options', function() {
        ajaxStub.lastCall.args[0].should.eql({ type: 'POST' });
      });
    });
  });
});
