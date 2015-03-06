var _sock, _stomp;

describe('stomp.over.sockjs.js', function () {
    var config;
    var socket;
    var $rootScope;

    beforeEach(module('config'));
    beforeEach(module('binarta.sockjs'));

    beforeEach(inject(function (_config_, _$rootScope_) {
        config = _config_;
        config.baseUri = 'http://host/app/';
        $rootScope = _$rootScope_;
    }));

    describe('sockJS', function () {
        beforeEach(inject(function (_sockJS_) {
            socket = _sockJS_;
        }));

        it('connection requested for address', function () {
            expect(_sock.url).toEqual('http://host/app/stomp');
        });

        it('stomp initialized with sockjs', function () {
            expect(_stomp.socket).toEqual(_sock);
        });

        describe('when connection pending and sending a message', function () {
            var promise;

            beforeEach(function () {
                promise = socket.send({responseAddress: 'R', data: 'D'});
            });

            it('then no data was sent', function () {
                expect(_stomp.messages.length).toEqual(0);
            });

            describe('and the socket is opened', function () {
                beforeEach(function () {
                    _stomp.onopen();
                    $rootScope.$digest();
                });

                it('then the data is sent upon opening', function () {
                    expect(_stomp.messages).toEqual([
                        {to: "/app/events", body: JSON.stringify({responseAddress: 'R', data: 'D'})}
                    ]);
                });

                describe('and the socket is closed before receiving a response', function () {
                    beforeEach(function () {
                        _sock.onclose();
                    });

                    describe('and it is opened again', function () {
                        beforeEach(function () {
                            _stomp.onopen();
                            $rootScope.$digest();
                        });

                        it('the data was sent again', function () {
                            //expect(_sock.data[0]).toEqual(JSON.stringify({responseAddress:'R', data:'D'}));
                            expect(_stomp.messages).toEqual([
                                {to: "/app/events", body: JSON.stringify({responseAddress: 'R', data: 'D'})}
                            ]);
                        });
                    });
                });

                describe('and an answer is received', function () {
                    beforeEach(function () {
                        _stomp.to("/topic/events", JSON.stringify({topic: 'R', payload: 'P'}));
                    });

                    it('then the response promise was resolved', function () {
                        expect(getExecutedHandlerFor(promise)).toHaveBeenCalledWith('P');
                        expect(getExecutedHandlerFor(promise).callCount).toEqual(1);
                    });

                    describe('and answer is received again', function () {
                        beforeEach(function () {
                            _stomp.to("/topic/events", JSON.stringify({topic: 'R', payload: 'P'}));
                        });

                        it('then promise is not resolved again', function () {
                            expect(getExecutedHandlerFor(promise).callCount).toEqual(1);
                        })
                    });

                    describe('and page gets refreshed', function () {
                        beforeEach(inject(function ($window) {
                            $window.onbeforeunload();
                        }));

                        it('onclose hook is disabled', function () {
                            expect(_sock.onclose).toBeUndefined();
                        });

                        it('test', function () {
                            expect(_stomp.closed).toBeTruthy();
                        })
                    });
                });
            });
        });

        function getExecutedHandlerFor(promise) {
            var handler = jasmine.createSpy('handler');
            promise.then(handler);
            $rootScope.$digest();
            return handler;
        }
    });
});

function SockJS(url, ignored, args) {
    _sock = {
        url: url, send: function (data) {
            _sock.data.push(data)
        }, args: args, close: function () {
            _sock.closed = true
        }
    };
    _sock.data = [];
    return _sock;
}

Stomp = {
    over: function (socket) {
        var topics = {};
        _stomp = {
            socket: socket,
            messages: [],
            to: function (topic, body) {
                topics[topic].forEach(function (it) {
                    it({body: body})
                });
            }
        };
        return {
            connect: function (headers, onopen, onerror) {
                _stomp.onopen = onopen;
                _stomp.onerror = onerror;
            },
            subscribe: function (topic, listener) {
                if (topics[topic] == undefined) topics[topic] = [];
                topics[topic].push(listener);
            },
            send: function (to, headers, body) {
                _stomp.messages.push({to: to, body: body});
            },
            disconnect: function (it) {
                _stomp.closed = true;
                it();
            }
        };
    }
};

