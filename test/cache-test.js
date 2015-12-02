// Allow expressions in place of function calls (for be.true, etc)
// jshint -W030

'use strict';

require('./test-helper');

var should = require('should');

describe('CacheV2', function() {
  var Post, cache;

  beforeEach(function() {
    var RestModel = require('../index');
    cache = require('../lib/cache').create();

    Post = RestModel.extend().reopenClass({
      typeKey: 'post',
      base   : 'posts'
    });
  });

  describe('#updateRecord', function() {
    var post;

    beforeEach(function() {
      post = { id: 1, name: 'name' };
      setLocalStorage('/posts/1', post);
    });

    it('updates an existing record in the cache', function() {
      var postRecord = Post.create({ id: 1 });

      return cache.updateRecord(postRecord, {
        id  : 1,
        name: 'new-name'
      }).then(function() {
        return cache.getItem('post: 1');
      }).then(function(item) {
        item.should.eql({ id: 1, name: 'new-name' });
      });
    });
  });

  describe('#removeRecord', function() {
    var post;

    beforeEach(function() {
      post = { id: 1, name: 'name' };
      setLocalStorage('/posts/1', post);
    });

    it('removes the record from the cache', function() {
      var postRecord = Post.create({ id: 1 });

      return cache.setItem('post: 1', post).then(function() {
        return cache.removeRecord(postRecord);
      }).then(function() {
        return cache.getItem('post: 1');
      }).then(function(item) {
        should(item).be.null;
      });
    });
  });

  describe('#getResponse', function() {
    var attrs;

    beforeEach(function() {
      attrs = { id: 1, name: 'post' };
    });

    context('when no value is cached', function() {
      it('resolves with `null`', function() {
        return cache.getResponse(Post, '/posts').then(function(res) {
          should(res).be.null;
        });
      });
    });

    context('when the response is an array', function() {
      it('resolves with the array', function() {
        setLocalStorage('/posts', [attrs]);

        return cache.getResponse(Post, '/posts').then(function(res) {
          res.should.eql([attrs]);
        });
      });

      context('and there are null values in the array', function() {
        it('does not include the null values', function() {
          attrs = [{ id: 1, name: 'name-1' }, { id: 2, name: 'new-name' }];
          setLocalStorage('/posts', attrs);

          return cache.removeItem('post: 2').then(function() {
            return cache.getResponse(Post, '/posts');
          }).then(function(res) {
            res.should.eql([{ id: 1, name: 'name-1' }]);
          });
        });
      });
    });

    context('when the response is an item', function() {
      it('fetches the item', function() {
        setLocalStorage('/posts/1', attrs);

        return cache.getResponse(Post, '/posts/1').then(function(res) {
          res.should.eql(attrs);
        });
      });
    });
  });

  describe('#setResponse', function() {
    context('when the response is an array', function() {
      var items;

      beforeEach(function() {
        items = [
          { id: 1, name: 'new-name' },
          { id: 2, name: 'other-name' }
        ];
      });

      it('resolves with the value', function() {
        return cache.setResponse(Post, '/posts', items).then(function(response) {
          response.should.eql(items);
        });
      });

      context('and a value already exists', function() {
        it('updates the response', function() {
          setLocalStorage('/posts', [{ id: 1, name: 'name' }]);

          return cache.setResponse(Post, '/posts', items).then(function() {
            return cache.getResponse(Post, '/posts');
          }).then(function(response) {
            response.should.eql(items);
          });
        });
      });

      context('and a value does not already exist', function() {
        it('sets the response', function() {
          return cache.setResponse(Post, '/posts', items).then(function() {
            return cache.getResponse(Post, '/posts');
          }).then(function(response) {
            response.should.eql(items);
          });
        });
      });
    });

    context('when the response is an item', function() {
      var item;

      beforeEach(function() {
        item = { id: 1, name: 'new-name' };
      });

      it('resolves with the value', function() {
        return cache.setResponse(Post, '/posts/1', item).then(function(response) {
          response.should.eql(item);
        });
      });

      context('and the value already exists', function() {
        it('updates the response', function() {
          setLocalStorage('/posts/1', { id: 1, name: 'name' });

          return cache.setResponse(Post, '/posts/1', item).then(function() {
            return cache.getResponse(Post, '/posts/1');
          }).then(function(response) {
            response.should.eql(item);
          });
        });
      });

      context('and the value does not already exist', function() {
        it('sets the response', function() {
          return cache.setResponse(Post, '/posts/1', item).then(function() {
            return cache.getResponse(Post, '/posts/1');
          }).then(function(response) {
            response.should.eql(item);
          });
        });
      });
    });
  });

  function setLocalStorage(path, attrs) {
    if (Ember.isArray(attrs)) {
      localStorage.setItem(path, JSON.stringify(attrs.mapBy('id')));

      attrs.forEach(function(object) {
        localStorage.setItem('post: ' + object.id, JSON.stringify(object));
      });
    } else {
      localStorage.setItem(path, JSON.stringify(attrs.id));
      localStorage.setItem('post: ' + attrs.id, JSON.stringify(attrs));
    }
  }
});
