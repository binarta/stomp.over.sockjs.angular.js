(function() {
    angular.module('binarta.sockjs', ['config'])
        .factory('sockJS', ['config', '$q', '$window', SockJSFactory]);

    function SockJSFactory(config, $q, $window) {
        var sock, stomp;
        var opened = false;
        var isSocketOpenedDeferred = $q.defer();
        var version = 0;

        var responsesHolder = {};

        function deferralForTopic(args) {
            var request = responsesHolder[args.topic];
            return request ? request.deferral : {resolve:function(){}}
        }

        function reset() {
            isSocketOpenedDeferred = $q.defer();
        }

        var init = function() {
            version++;

            sock = SockJS(config.baseUri + 'stomp');
            stomp = Stomp.over(sock);

            sock.onclose = function() {
                if (opened) reset();
                opened = false;
                init();
            };

            var onopen = function() {
                stomp.subscribe("/topic/events", function(message) {
                    var data = JSON.parse(message.body);
                    deferralForTopic(data).resolve(data.payload);
                    delete responsesHolder[data.topic];
                });

                Object.keys(responsesHolder).forEach(function(key){
                    var response = responsesHolder[key];
                    if (response.version < version) stomp.send("/app/events", {}, JSON.stringify(response.request));
                });
                opened = true;
                isSocketOpenedDeferred.resolve();
            };

            var onerror = function(err) {
                if (opened) reset();
                opened = false;
                init();
            };

            stomp.connect({}, onopen, onerror);

            $window.onbeforeunload = function() {
                stomp.disconnect(function() {
                    sock.onclose = undefined;
                });
            };
        };

        init();

        return {
            send: function(data) {
                var deferral = $q.defer();
                responsesHolder[data.responseAddress] = {deferral: deferral, request: data, version: version};
                isSocketOpenedDeferred.promise.then(function() {
                    stomp.send("/app/events", {}, JSON.stringify(data));
                });
                return deferral.promise;
            }
        }
    }
})();