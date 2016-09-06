/*
 * @author yangjun14(yangjvn@126.com)
 * @file 测试src/http.js
 */

define(['src/utils/http'], function(http) {
    describe('http', function() {
        this.timeout(5000);

        var xhr, fake, timeout;
        before(function() {
            fake = sinon.useFakeXMLHttpRequest();
            fake.onCreate = function(_xhr) {
                xhr = _xhr;
            };
        });

        beforeEach(function() {
            timeout = setTimeout(function() {
                if (!xhr) return;
                if (xhr.url === 'http://harttle.com') {
                    xhr.respond(200, {
                        'Content-Type': 'text/plain'
                    }, 'okay');
                } else if (xhr.url === 'http://baidu.com') {
                    xhr.respond(400, {
                        'Content-Type': 'text/plain'
                    }, 'bad');
                }
            }, 100);
        });

        afterEach(function(){
            clearTimeout(timeout);
        });

        describe('.ajax()', function() {
            it('should return a thenable', function() {
                var p = http.ajax('http://harttle.com');
                expect(p.then).to.be.a('function');
            });
            it('should use correct url', function() {
                http.ajax('http://harttle.com');
                expect(xhr.url).to.equal('http://harttle.com');
            });
            it('should default method to GET', function() {
                http.ajax('http://harttle.com');
                expect(xhr.method).to.equal('GET');
            });
            it('should resolve when 200', function(done) {
                http.ajax('http://harttle.com')
                    .then(function(content, status, xhr) {
                        expect(content).to.equal('okay');
                        expect(status).to.equal(200);
                        expect(xhr.responseText).to.equal('okay');
                        done();
                    }).catch(done);
            });
            it('should reject when 400', function(done) {
                http.ajax('http://baidu.com')
                    .catch(function(xhr, status, err) {
                        expect(xhr.responseText).to.equal('bad');
                        expect(status).to.equal(400);
                        expect(err).to.be.null;
                        done();
                    }).catch(done);
            });
        });
        describe('.get()', function() {
            it('should perform GET', function(done){
                http.get('http://harttle.com')
                    .then(function(content, status, _xhr){
                        expect(xhr.method).to.equal('GET');
                        expect(content).to.equal('okay');
                        done();
                    }).catch(done);
            });
        });
        describe('.post()', function() {
            it('should perform POST', function(done){
                http.post('http://harttle.com')
                    .then(function(content, status, _xhr){
                        expect(xhr.method).to.equal('POST');
                        expect(content).to.equal('okay');
                        done();
                    }).catch(done);
            });
        });
        describe('.put()', function() {
            it('should perform PUT', function(done){
                http.put('http://harttle.com')
                    .then(function(content, status, _xhr){
                        expect(xhr.method).to.equal('POST');
                        expect(xhr.requestBody).to.equal('{"_method":"PUT"}');
                        expect(content).to.equal('okay');
                        done();
                    }).catch(done);
            });
        });
        describe('.delete()', function() {
            it('should perform DELETE', function(done){
                http.delete('http://harttle.com')
                    .then(function(content, status, _xhr){
                        expect(xhr.method).to.equal('DELETE');
                        expect(xhr.requestBody).to.equal('{"_method":"DELETE"}');
                        expect(content).to.equal('okay');
                        done();
                    }).catch(done);
            });
        });
    });
});
