/*
 * Superframe Debug Utility
 */

define(function() {
    var match, server;
    
    match = location.search.match(/(?:^|&)debug=true/i);
    window.DEBUG = match ? 'superframe' : window.DEBUG;

    match = location.search.match(/(?:^|&)debug-server=([^&]*)/i);
    server = match ? decodeURIComponent(match[1]) : false;

    var timeOffset = Date.now();
    var lastTime = timeOffset;

    function reset() {
        lastTime = timeOffset = Date.now();
    }

    function log() {
        var msg = Array.prototype.slice.call(arguments).join(' ');
        var now = Date.now();
        var duration = (now - timeOffset) / 1000;

        var msg = '[' + duration + '(+' + (now - lastTime) + ')] ' + msg;
        doLog(msg);

        lastTime = now;
    }

    function doLog(msg) {
        console.log(msg);
        // Log to remote server
        if (server) {
            var img = new Image();
            msg = msg.replace(/\s+/g, ' ').trim();
            img.src = server + '/sfr/log/' + msg;
        }
    }

    return {
        log: log,
        reset: reset
    };
});
