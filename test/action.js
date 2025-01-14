/**
* @file test/action.js test suite for action.js
* @author harttle<yanjun14@baidu.com>
*/

/* eslint-env mocha */

/* eslint-disable max-nested-callbacks */

/* globals sinon: true */

define(function (require) {
    var Promise = require('@searchfe/promise');
    var _ = require('@searchfe/underscore');
    var actionFactory = require('action');
    var Emitter = require('utils/emitter');
    var dispatchFactory = require('dispatch');

    describe('action', function () {
        var action;
        var fooService;
        var barService;
        var router;
        var current;
        var prev;
        var location;
        var dispatch;
        var history;
        var doc;
        var services;

        beforeEach(function () {
            router = {
                reset: sinon.spy(),
                stop: sinon.spy(),
                back: sinon.spy(),
                add: sinon.spy(),
                remove: sinon.spy(),
                config: sinon.spy(),
                start: sinon.spy(),
                createURL: function (url, query) {
                    return {
                        toString: function () {
                            return url;
                        }
                    };
                },
                clear: sinon.spy(),
                getState: sinon.spy(function () {
                    return {};
                }),
                ignoreRoot: function (url) {
                    return url.replace(/^\/root/, '');
                },
                pathPattern: function (url) {
                    return '/foo';
                },
                redirect: sinon.spy(function (url) {
                    if (url === '/not-defined-service') {
                        throw new Error('service not found');
                    }
                })
            };
            services = require('services')(router);
            history = {
                back: sinon.spy()
            };
            location = {
                href: window.location.href,
                pathname: window.location.pathname,
                replace: sinon.spy(),
                search: '',
                hash: ''
            };
            fooService = {
                name: 'fooService',
                create: sinon.spy(),
                attach: sinon.spy(),
                detach: sinon.spy(),
                abort: sinon.spy(),
                destroy: sinon.spy(),
                partialUpdate: sinon.spy(),
                update: sinon.spy()
            };
            barService = {
                name: 'barService',
                create: sinon.spy(),
                attach: sinon.spy(),
                detach: sinon.spy(),
                destroy: sinon.spy(),
                update: sinon.spy()
            };
            current = {
                path: '/foo',
                pathPattern: '/foo',
                url: '/foo?a=b',
                options: {}
            };
            prev = {
                path: '/bar',
                pathPattern: '/bar',
                url: '/bar?d=c',
                options: {}
            };
            doc = {
                ensureAttached: sinon.spy()
            };
            dispatch = dispatchFactory(location);
            action = actionFactory(router, location, history, doc, Emitter, services, dispatch);
        });
        afterEach(function () {
            action.destroy();
        });
        describe('.regist()', function () {
            it('should throw with undefined key', function () {
                expect(function () {
                    return action.regist();
                }).to.throw(/invalid path pattern/);
            });
            it('should throw upon invalid url', function () {
                expect(function () {
                    return action.regist();
                }).to.throw(/invalid path pattern/);
            });
            it('should not regist invalid service', function () {
                action.regist('key', fooService);
                expect(action.exist('key')).to.be.true;
            });
        });
        describe('.unregist()', function () {
            beforeEach(function () {
                return action.regist('key', fooService);
            });
            it('should throw with undefined key', function () {
                expect(function () {
                    return action.unregist();
                }).to.throw(/invalid path pattern/);
            });
            it('should throw not when registered', function () {
                expect(function () {
                    return action.unregist('not-registered');
                }).to.throw(/path not registered/);
            });
            it('should un-register', function () {
                action.unregist('key');
                expect(action.exist('key')).to.be.false;
            });
        });
        describe('.dispatch()', function () {
            beforeEach(function () {
                action.regist('/foo', fooService);
                action.regist('/bar', barService);
                action.regist('/person/:id', fooService);
                action.regist(/person\/\d+/, barService);
            });
            it('should call create/attach/detach/destroy with correct arguments', function () {
                return action.dispatch(current, prev).then(function () {
                    expect(fooService.create).to.have.been.calledWith(current, prev);
                    expect(fooService.attach).to.have.been.calledWith(current, prev);
                    expect(barService.detach).to.have.been.calledWith(current, prev);
                    expect(barService.destroy).to.have.been.calledWith(current, prev);
                    expect(current).to.have.property('service', fooService);
                    expect(prev).to.have.property('service', barService);
                });
            });
            it('should contain page instance in current.page', function () {
                return action.dispatch(current, prev).then(function () {
                    var args = fooService.create.args[0];
                    expect(args[0].page.id).to.have.match(/\d+/);
                });
            });
            it('should call doc.ensureAttached()', function () {
                return action.dispatch(current, prev).then(function () {
                    expect(doc.ensureAttached).to.have.been.called;
                });
            });
            it('should call detach,create,destroy,attach in a sequence', function () {
                return action.dispatch(current, prev).then(function () {
                    expect(barService.detach).to.have.been.called;
                    expect(fooService.create).to.have.been.calledAfter(barService.detach);
                    expect(barService.destroy).to.have.been.calledAfter(fooService.create);
                    expect(fooService.attach).to.have.been.calledAfter(barService.destroy);
                });
            });
            it('should not call create,destroy,attach if dispatch re-started', function () {
                barService.detach = function () {};
                sinon.stub(barService, 'detach', function () {
                    return new Promise(function (resolve) {
                        return setTimeout(resolve, 100);
                    });
                });
                var firstDispatch = action.dispatch(current, prev);
                var secondDispatch = new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        action.dispatch(prev, current).then(resolve).catch(reject);
                    }, 10);
                });
                return Promise.all([firstDispatch, secondDispatch]).then(function () {
                    // bar -> foo
                    expect(barService.detach).to.have.been.calledOnce;
                    expect(fooService.create).to.have.not.been.called;
                    expect(barService.destroy).to.have.not.been.called;
                    expect(fooService.attach).to.have.not.been.called;
                    // foo -> bar
                    expect(fooService.detach).to.have.been.calledOnce;
                    expect(barService.create).to.have.been.calledOnce;
                    expect(fooService.destroy).to.have.been.calledOnce;
                    expect(barService.attach).to.have.been.calledOnce;
                });
            });
            it('should call abort if restarted', function () {
                barService.detach = function () {};
                sinon.stub(barService, 'detach', function () {
                    return new Promise(function (resolve) {
                        return setTimeout(resolve, 100);
                    });
                });
                var firstDispatch = action.dispatch(current, prev);
                var secondDispatch = new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        action.dispatch(prev, current).then(resolve).catch(reject);
                    }, 10);
                });
                return Promise.all([firstDispatch, secondDispatch]).then(function () {
                    // bar -> foo
                    expect(barService.detach).to.have.been.calledOnce;
                    expect(fooService.abort).to.have.been.calledOnce;
                });
            });
            it('should await when create returns a promise', function () {
                var createdSpy = sinon.spy();
                fooService.create = function () {
                    return new Promise(function (resolve) {
                        setTimeout(function () {
                            createdSpy();
                            resolve('created');
                        }, 100);
                    });
                };
                return action.dispatch(current, prev).then(function () {
                    expect(barService.destroy).to.have.been.calledAfter(createdSpy);
                });
            });
            it('should abort when create throws', function () {
                fooService.create = function () {
                    throw 'foo';
                };
                return action
                .dispatch(current, prev)
                .catch(function (e) {
                    expect(e).to.equal('foo');
                })
                .then(function () {
                    expect(barService.destroy).to.not.have.been.called;
                });
            });
            it('should abort when create returns a rejected promise', function () {
                fooService.create = function () {
                    return Promise.reject('foo');
                };
                return action.dispatch(current, prev).catch(function (e) {
                    expect(e).to.equal('foo');
                }).then(function () {
                    expect(barService.destroy).to.not.have.been.called;
                });
            });
            it('should init when options.src === sync', function () {
                return action.dispatch({
                    path: '/foo',
                    pathPattern: '/foo',
                    options: {
                        src: 'sync'
                    }
                }, {}).then(function () {
                    return expect(fooService.create).to.have.been.called;
                });
            });
            it('should retrieve service registered as regexp url', function () {
                return action.dispatch({
                    path: '/person/13',
                    pathPattern: '/person/:id',
                    url: '/person/13?d=c',
                    options: {}
                }, prev).then(function () {
                    expect(fooService.create).to.have.been.called;
                    expect(fooService.attach).to.have.been.called;
                });
            });
        });
        describe('.isIndexPage()', function () {
            beforeEach(function () {
                // action.init();
                action.regist('/foo', fooService);
                action.regist('/bar', barService);
            });
            it('should set as true initally', function () {
                expect(action.isIndexPage()).to.be.true;
            });
            it('should return false when dispatched to another service', function () {
                return action.dispatch(current, prev).then(function () {
                    expect(action.isIndexPage()).to.be.false;
                });
            });
            it('should return true when dispatched to sync', function () {
                current.options.src = 'sync';
                return action.dispatch(current, prev).then(function () {
                    expect(action.isIndexPage()).to.be.true;
                });
            });
        });
        describe('.back()', function () {
            it('should call history.back()', function () {
                action.back({});
                expect(history.back).to.have.been.called;
            });
            it('should set options.src to "back"', function () {
                action.back({});
                var current = {options: {}};
                action.dispatch(current, {});
                expect(current.options.src).to.equal('back');
            });
            it('should set options.src to "back" only once', function () {
                action.back();
                var second = {options: {}};
                action.dispatch({options: {}}, {});
                action.dispatch(second, {});
                expect(second.options.src).to.not.equal('back');
            });
        });
        describe('.redirect()', function () {
            beforeEach(function () {
                // action.init();
                action.regist('/foo', fooService);
                action.regist('/bar', barService);
                action.start({
                    root: '/root/page'
                });
            });
            it('should call router with correct arguments', function () {
                var url = 'xx';
                var query = 'bb';
                var options = {};
                action.redirect(url, query, options);
                expect(router.redirect).to.have.been.calledWithMatch(url, query, {});
            });
            it('should pass stage data to next dispatch', function () {
                action.redirect('/foo', 'bb', {}, {foo: 'bar'});
                return action.dispatch({pathPattern: '/foo'}, {}).then(function () {
                    expect(fooService.create.args[0][2]).to.deep.equal({
                        foo: 'bar'
                    });
                });
            });
            it('should redirect to root page for sfr://index', function () {
                current.options.src = 'sync';
                action.dispatch(current, prev);
                action.redirect('sfr://index');
                expect(router.redirect).to.have.been.calledWith('/foo?a=b');
            });
            it('should increase page id', function () {
                action.dispatch(current, prev);
                action.redirect('/foo');
                expect(router.redirect).to.have.been.calledWithMatch('/foo', undefined, {
                    id: 0
                });
                action.redirect('/bar');
                expect(router.redirect).to.have.been.calledWithMatch('/bar', undefined, {
                    id: 1
                });
            });
            it('should not pass stage data to further dispatches', function () {
                action.redirect('/foo', 'bb', {}, {foo: 'bar'});
                var current = {pathPattern: '/foo'};
                return action.dispatch(current, {}).then(function () {
                    fooService.create.reset();
                    return action.dispatch(current, {});
                }).then(function () {
                    expect(fooService.create.args[0][2].foo).to.be.undefined;
                });
            });
            it('should redirect when router fails', function () {
                function fn() {
                    action.redirect('/not-defined-service', {}, {});
                }
                expect(fn).to.throw(/service not found/);
                try {
                    fn();
                }
                catch (e) {}
                expect(location.replace).to.have.been.calledWith('/not-defined-service');
            });
            it('should emit "redirecting" event with url query options', function (done) {
                var url = 'xx';
                var query = 'bb';
                var options = {};
                var extra = {foo: 'bar'};
                action.once('redirecting', function (u, q, opt, target, data) {
                    expect(u).to.equal(url);
                    expect(q).to.equal(query);
                    expect(JSON.stringify(opt)).to.equal(JSON.stringify(options));
                    expect(JSON.stringify(data)).to.equal(JSON.stringify(extra));
                    done();
                });
                action.redirect(url, query, options, extra);
            });
            it('should "redirectFailed" event with url', function (done) {
                function fn() {
                    action.redirect('/not-defined-service', {}, {});
                }
                action.once('redirectFailed', function (err) {
                    expect(err.url).to.equal('/not-defined-service');
                    done();
                });
                expect(fn).to.throw(/service not found/);
            });
            it('should not call router when cancled', function () {
                var url = '/foo';
                action.once('redirecting', function (u) {
                    return false;
                });
                action.redirect(url);
                expect(router.redirect).not.to.have.been.calledWith(url);

            });
        });
        describe('.reset()', function () {
            beforeEach(function () {
                action.regist('/foo', fooService);
                action.regist('/bar', barService);
                action.dispatch({url: location.pathname}, {});
            });
            it('should call router with correct arguments', function () {
                var url = 'xx';
                var query = 'bb';
                var options = {};
                action.reset(url, query, options);
                expect(router.reset).to.have.been.calledWith(url, query, options);
            });
            it('should pass stage data to next dispatch', function () {
                action.reset('/foo', 'bb', {}, {foo: 'bar'});
                return action.dispatch({pathPattern: '/foo'}, {}).then(function () {
                    expect(fooService.create.args[0][2]).to.deep.equal({
                        foo: 'bar'
                    });
                });
            });
            it('should not pass stage data to further dispatches', function () {
                action.reset('/foo', 'bb', {}, {foo: 'bar'});
                var current = {pathPattern: '/foo'};
                return action.dispatch(current, {}).then(function () {
                    fooService.create.reset();
                    return action.dispatch(current, {});
                }).then(function () {
                    expect(fooService.create.args[0][2].foo).to.be.undefined;
                });
            });
            it('should not call router when cancled', function () {
                var url = '/foo';
                action.once('reseting', function (u) {
                    return false;
                });
                action.reset(url);
                expect(router.reset).not.to.have.been.calledWith(url);
            });
        });
        describe('.start(), .stop()', function () {
            var a;
            beforeEach(function () {
                var options = {
                    foo: 'bar'
                };
                a = document.createElement('a');
                a.setAttribute('data-sf-href', 'foo');
                a.setAttribute('data-sf-options', JSON.stringify(options));
                document.body.appendChild(a);
                sinon.stub(action, 'config');
                // action.init();
            });
            afterEach(function () {
                a.remove();
                action.config.restore();
            });
            it('should support redirect via data-sf-href', function () {
                action.start();
                a.click();
                expect(router.redirect).to.have.been.calledWith('foo', null);
            });
            it('should not redirect data-sf-href after .stop() called', function () {
                action.start();
                action.stop();
                expect(router.redirect).to.have.not.been.called;
                a.click();
                expect(router.redirect).to.have.not.been.called;
            });
            it('should call router.stop() when .stop() called', function () {
                action.stop();
                expect(router.stop).to.have.been.called;
            });
            it('should support redirect options via data-sf-options', function () {
                action.start();
                a.click();
                var options = {
                    id: 0,
                    foo: 'bar',
                    src: 'hijack'
                };
                expect(router.redirect).to.have.been.calledWith('foo', null, options);
            });
            it('should use empty options when data-sf-options illegal', function () {
                a.setAttribute('data-sf-options', '{fdafda}');
                action.start();
                a.click();
                expect(router.redirect).to.have.been.calledWith('foo', null, {
                    id: 0,
                    src: 'hijack'
                });
            });
            it('should not call .config() when no arguments given', function () {
                action.start();
                expect(action.config).to.have.not.been.called;
            });
            it('should call .config() when there\'s arguments given', function () {
                var opts = {root: '/bar'};
                action.start(opts);
                expect(action.config).to.have.been.calledWith(opts);
            });
        });

        describe('.config()', function () {
            it('should call router.config', function () {
                var opts = {root: '/foo'};
                action.config(opts);
                expect(router.config).to.have.been.calledWithMatch({
                    root: '/foo',
                    visitedClassName: 'visited'
                });
            });
        });
        describe('.update()', function () {
            beforeEach(function () {
                action.regist('/foo', fooService);
                action.start({
                    root: '/root'
                });
                location.replace.reset();
            });
            it('should call router.reset()', function () {
                location.pathname = '/root/foo';
                location.search = '';
                location.hash = '';
                action.update('/foo');
                expect(router.reset).to.have.been.called;
            });
            it('should call serviceObject.update()', function () {
                location.href = 'http://foo.com/root/foo?foo=foo#bar';
                location.pathname = '/root/foo';
                location.search = '?a=b';

                var options = {
                    foo: 'bar'
                };
                var extra = {
                    view: 'view'
                };
                action.dispatch(current, prev);
                return action.update('/root/foo?foo=bar', {}, options, extra).then(function () {
                    expect(fooService.partialUpdate).to.have.been.called;
                    var args = fooService.partialUpdate.args[0];
                    expect(args[0]).to.equal('/root/foo?foo=bar');
                    expect(args[1]).to.be.an.object;
                    expect(args[1].replace).to.be.true;
                    expect(args[1].page).to.be.an.object;
                    expect(args[1].transition.from.url).to.equal('/foo?a=b');
                    expect(args[1].transition.to.url).to.equal('/foo?foo=bar');
                    expect(args[1].transition.to.path).to.equal('/foo');
                    expect(args[1].transition.extra).to.deep.equal(extra);
                });
            });
        });

        describe('services', function () {
            var fooServiceClass;
            var barServiceClass;
            var fooSpy;
            var barSpy;
            var magicCurrent;
            var magicCurrent2;
            var fooInstance;
            var fooPattern = '/foo';
            var barPattern = '/bar';
            var barCurrent;
            beforeEach(function () {
                fooServiceClass = function (url) {
                    this.url = url;
                    fooSpy(url);
                    fooInstance = this;
                };
                barServiceClass = function (url) {
                    this.url = url;
                    barSpy(url);
                };
            });
            beforeEach(function () {
                fooSpy = sinon.spy();
                barSpy = sinon.spy();
                magicCurrent = _.cloneDeep(current);
                magicCurrent.url = '/foo?c=d';
                magicCurrent.options.superMagicRouter = true;
                magicCurrent2 = _.cloneDeep(magicCurrent);
                magicCurrent2.url = '/foo?e=f';
                barCurrent = _.cloneDeep(prev);
                fooServiceClass.prototype.beforeAttach = sinon.spy();
                fooServiceClass.prototype.attach = sinon.spy();
                fooServiceClass.prototype.beforeDetach = sinon.spy();
                fooServiceClass.prototype.detach = sinon.spy();
                fooServiceClass.prototype.destroy = sinon.spy();
                barServiceClass.prototype.beforeAttach = sinon.spy();
                barServiceClass.prototype.attach = sinon.spy();
                barServiceClass.prototype.beforeDetach = sinon.spy();
                barServiceClass.prototype.detach = sinon.spy();
                barServiceClass.prototype.destroy = sinon.spy();
                services.register(fooPattern, {}, fooServiceClass);
                services.register(barPattern, {}, barServiceClass);
            });
            it('should register services as instance', function () {
                expect(services.urlEntries.has(fooPattern)).to.be.true;
                expect(services.urlEntries.get(fooPattern).service).equals(fooServiceClass);
                expect(!!fooServiceClass.singleton).to.be.false;
            });
            it('should create instance when dispatching', function () {
                action.dispatch(current, prev);
                expect(fooSpy).to.has.been.calledWith(current.url);
                expect(barSpy).to.has.been.calledWith(prev.url);
            });
            it('should reuse instance incoming parameters redirecting/reseting ', function () {
                var urla = '/foo?g=h';
                var urlb = '/foo?j=i';
                var reuseService = services.getOrCreate(urla);
                expect(fooSpy).to.has.been.calledWith(urla);

                action.redirect(urlb, {}, null, {service: reuseService});
                expect(fooSpy).has.been.calledOnce;

                action.redirect(prev.url, {}, null, {service: reuseService});
                expect(barSpy).has.not.been.called;
            });
            it('dispatch break by current guard', function () {
                var rs = dispatch({
                    service: {
                        guard: function () {return false; }
                    }
                });
                expect(rs).to.be.equal(false);
            });
            it('dispatch break by prev guard', function () {
                var rs = dispatch({}, {
                    service: {
                        guard: function () {return false; }
                    }
                });
                expect(rs).to.be.equal(false);
            });
        });
    });
});
