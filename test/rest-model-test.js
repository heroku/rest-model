'use strict';

require('./test-helper');

var should = require('should');
var shared = require('./shared');
var Comment, Post;

describe('RestModel', function() {
  before(function() {
    Post    = require('./models').Post;
    Comment = require('./models').Comment;
  });

  describe('namespacing', function() {
    beforeEach(function() {
      Post.namespace = 'posts-api';
    });

    afterEach(function() {
      Post.namespace = null;
    });

    it('applies a namespace when present', function() {
      Post.find(1);
      jQuery.ajax.args[0][0].url.should.eql('/posts-api/posts/1');
    });
  });

  describe('originalProperties', function() {
    it('sets originalProperties on init', function() {
      var post = Post.create({ name: 'original name' });
      post.set('name', 'new name');
      post.get('originalProperties').get('name').should.eql('original name');
    });

    it('creates a deep copy', function() {
      var post = Post.create({ foo: { bar: ['baz'] } });
      post.get('foo').bar.push('qux');
      post.get('originalProperties').get('foo').bar.should.eql(['baz']);
    });

    it('does not include non-attr properties', function() {
      var post = Post.create({ notAttr: 'foo', name: 'original name' });
      should(post.get('originalProperties').get('notAttr')).eql(undefined);
    });
  });

  describe('#delete', function() {
    it('deletes the given model', function() {
      var model = Post.create({ id: 1 });
      model.delete();
      jQuery.ajax.args[0][0].type.should.eql('DELETE');
      jQuery.ajax.args[0][0].url.should.eql('/posts/1');
    });

    describe('when given a specific URL', function() {
      beforeEach(function() {
        var post = Post.create({ id: 12345, created_at: 'foo' });
        post.delete({ withURL: '/foo/baz' });
      });

      it('uses the given URL', function() {
        jQuery.ajax.args[0][0].url.should.eql('/foo/baz/12345');
      });
    });
  });

  describe('#fetch', function() {
    it('fetches the given model', function() {
      var model = Post.create({ id: 1 });
      model.fetch();
      jQuery.ajax.args[0][0].url.should.eql('/posts/1');
    });

    it('updates the fetching record', function(done) {
      this.resolve = { name: 'name' };
      var post = Post.create({ id: 1 });
      post.fetch().then(function() {
        post.get('name').should.eql('name');
        done();
      });
    });

    it('accepts withURL options', function() {
      var model = Post.create({ id: 1 });
      model.fetch({ withURL: '/special-posts' });
      jQuery.ajax.args[0][0].url.should.eql('/special-posts/1');
    });
  });

  describe('#isDirty', function() {
    var post;

    beforeEach(function() {
      post = Post.create({ name: 'name' });
    });

    describe('when attributes are changed', function() {
      it('is true', function() {
        post.set('name', 'new name');
        post.get('isDirty').should.eql(true);
      });
    });

    describe('when attributes are not changed', function() {
      it('is false', function() {
        post.get('isDirty').should.eql(false);
      });
    });

    describe('when the model has array properties', function() {
      beforeEach(function() {
        post = Post.create({ foo: [1] });
      });

      describe('and an array property has not changed', function() {
        it('is false', function() {
          post.get('isDirty').should.eql(false);
        });
      });

      describe('and an array property has changed', function() {
        it('is true', function() {
          post.get('foo').pushObject(2);
          post.get('isDirty').should.eql(true);
        });
      });
    });
  });

  describe('#isPersisted', function() {
    describe('when `created_at` is present', function() {
      it('is true', function() {
        var model = Post.create({ id: 1, created_at: '2013/01/01' });
        model.get('isPersisted').should.eql(true);
      });
    });

    describe('when `created_at` is not present', function() {
      it('is false', function() {
        var model = Post.create({ id: 1 });
        model.get('isPersisted').should.eql(false);
      });
    });
  });

  describe('#revert', function() {
    it('reverts the object', function() {
      var post = Post.create({ foo: { bar: ['baz'] } });
      post.get('foo').bar.push('qux');
      post.revert().get('foo').bar.should.eql(['baz']);
    });
  });

  describe('#save', function() {
    it('resets original properties', function(done) {
      var self = this;
      this.model   = Post.create({ id: 1, created_at: '2013/01/01' });
      this.resolve = { content: 'foo' };
      this.request = this.model.save.bind(this.model);
      this.request().then(function() {
        self.model.get('originalProperties').get('content').should.eql('foo');
        done();
      });
    });

    describe('when there are errors', function() {
      var post;

      beforeEach(function(done) {
        this.reject = { responseJSON: { errors: ['name is too short'] } };

        post = Post.create({ name: 'x' });
        post.save().catch(function() {
          done();
        });
      });

      it('uses the custom `assignErrors` function, if present', function() {
        post.get('errors').toArray().should.eql(['name is too short']);
      });
    });

    describe('when given a specific URL', function() {
      beforeEach(function() {
        var post = Post.create({ id: 12345, created_at: 'foo' });
        post.save({ withURL: '/foo/baz' });
      });

      it('uses the given URL', function() {
        jQuery.ajax.args[0][0].url.should.eql('/foo/baz/12345');
      });
    });

    describe('when saveViaPut is set', function() {
      var model;

      before(function() {
        Post.saveViaPut = true;
      });

      beforeEach(function() {
        this.model   = Post.create({ id: 1, created_at: '2013/01/01' });
        this.request = this.model.save.bind(this.model);
      });

      after(function() {
        Post.saveViaPut = false;
      });

      describe('and the model has been persisted', function() {

        beforeEach(function() {
          model = Post.create({ id: 1, created_at: '2013/01/01' });
        });

        it('saves via PUT', function() {
          model.save();
          jQuery.ajax.args[0][0].type.should.eql('PUT');
        });

        it('saves without a primary key param', function() {
          model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts');
        });
      });

      describe('and the model has not been persisted', function() {
        beforeEach(function() {
          model = Post.create();
        });

        it('saves via PUT', function() {
          model.save();
          jQuery.ajax.args[0][0].type.should.eql('PUT');
        });

        it('saves without a primary key param', function() {
          model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts');
        });
      });
    });

    describe('when there are no parents', function() {
      describe('when the model has been persisted', function() {
        beforeEach(function() {
          this.model   = Post.create({ id: 1, created_at: '2013/01/01' });
          this.request = this.model.save.bind(this.model);
        });

        it('requests the proper URL', function() {
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts/1');
        });

        it('does a PATCH request', function() {
          this.model.save();
          jQuery.ajax.args[0][0].type.should.eql('PATCH');
        });

        shared.behavesLikeASaveRequest();
        shared.behavesLikeAFailableRequest();
      });

      describe('when the model has not been persisted', function() {
        beforeEach(function() {
          this.model   = Post.create();
          this.request = this.model.save.bind(this.model);
        });

        it('requests the proper URL', function() {
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts');
        });

        it('does a POST request', function() {
          this.model.save();
          jQuery.ajax.args[0][0].type.should.eql('POST');
        });

        shared.behavesLikeASaveRequest();
        shared.behavesLikeAFailableRequest();
      });
    });

    describe('when there are parents', function() {
      describe('and the parents are not models', function() {
        it('requests the proper URL', function() {
          var post     = Post.create({ id: 2 });
          this.model   = Comment.create({ parents: [post.id], id: 1, created_at: '2013/01/01' });
          this.request = this.model.save.bind(this.model);
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts/2/comments/1');
        });
      });

      describe('when the model has been persisted', function() {
        beforeEach(function() {
          var post     = Post.create({ id: 2 });
          this.model   = Comment.create({ parents: [post], id: 1, created_at: '2013/01/01' });
          this.request = this.model.save.bind(this.model);
        });

        it('requests the proper URL', function() {
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts/2/comments/1');
        });

        it('does a PATCH request', function() {
          this.model.save();
          jQuery.ajax.args[0][0].type.should.eql('PATCH');
        });

        shared.behavesLikeASaveRequest();
        shared.behavesLikeAFailableRequest();
      });

      describe('when the model has not been persisted', function() {
        beforeEach(function() {
          var post     = Post.create({ id: 2 });
          this.model   = Comment.create({ parents: [post] });
          this.request = this.model.save.bind(this.model);
        });

        it('requests the proper URL', function() {
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts/2/comments');
        });

        it('does a POST request', function() {
          this.model.save();
          jQuery.ajax.args[0][0].type.should.eql('POST');
        });

        shared.behavesLikeASaveRequest();
        shared.behavesLikeAFailableRequest();
      });
    });
  });

  describe('::all', function() {
    describe('when there are no parents', function() {
      beforeEach(function() {
        this.request = Post.all.bind(Post);
        this.klass   = Post;
      });

      it('requests the proper URL', function() {
        this.request();
        jQuery.ajax.args[0][0].url.should.eql('/posts');
      });

      shared.behavesLikeAGETRequest();
      shared.behavesLikeAJSONRequest();
      shared.behavesLikeAnArrayRequest();
      shared.behavesLikeAFailableRequest();
    });

    describe('when there are parents', function() {
      beforeEach(function() {
        var post     = Post.create({ id: 12345 });
        this.parents = [post];

        this.request = function() {
          return Comment.all(post);
        };

        this.klass = Comment;
      });

      it('requests the proper URl', function() {
        this.request();
        jQuery.ajax.args[0][0].url.should.eql('/posts/12345/comments');
      });


      shared.behavesLikeAParentsRequest();
      shared.behavesLikeAGETRequest();
      shared.behavesLikeAJSONRequest();
      shared.behavesLikeAnArrayRequest();
      shared.behavesLikeAFailableRequest();
    });

    describe('when given a specific URL', function() {
      it('uses the given URL', function() {
        var post = Post.create({ id: 12345 });
        Comment.all(post, { withURL: '/foo/:bar/baz' });
        jQuery.ajax.args[0][0].url.should.eql('/foo/12345/baz');
      });

      describe('when a URL has a non-param colon', function() {
        it('uses the correct URL', function() {
          var post = Post.create({ id: 12345 });
          Comment.all(post, { withURL: '/foo/:bar/baz&foo=:bar' });
          jQuery.ajax.args[0][0].url.should.eql('/foo/12345/baz&foo=:bar');
        });
      });
    });
  });

  describe('::find', function() {
    describe('when there are no parents', function() {
      beforeEach(function() {
        this.request = function() {
          return Post.find(1);
        };

        this.klass = Post;
      });

      it('requests the proper URL', function() {
        this.request();
        jQuery.ajax.args[0][0].url.should.eql('/posts/1');
      });

      shared.behavesLikeAGETRequest();
      shared.behavesLikeAJSONRequest();
      shared.behavesLikeAnObjectRequest();
      shared.behavesLikeAFailableRequest();
    });

    describe('when there are parents', function() {
      beforeEach(function() {
        var post     = Post.create({ id: 12345 });
        this.parents = [post];
        this.resolve = { id: 2 };

        this.request = function() {
          return Comment.find(post, 2);
        };

        this.klass = Comment;
      });

      it('requests the proper URL', function() {
        this.request();
        jQuery.ajax.args[0][0].url.should.eql('/posts/12345/comments/2');
      });

      shared.behavesLikeAParentsRequest();
      shared.behavesLikeAGETRequest();
      shared.behavesLikeAJSONRequest();
      shared.behavesLikeAnObjectRequest();
      shared.behavesLikeAFailableRequest();
    });
  });
});
