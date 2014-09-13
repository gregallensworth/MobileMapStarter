/*
 * library.js contains additional utility functions which you may or may not find useful for your case.
 */



/*
 * Return true/false indicating whether we're running under Cordova/Phonegap
 * as well as specifically which platform
 * and other device-specific querying
 */
function is_cordova() {
    return (typeof(cordova) !== 'undefined' || typeof(phonegap) !== 'undefined');
};
function is_android() {
    if (! is_cordova() ) return false;
    return device.platform == 'Android';
}
function is_ios() {
    if (! is_cordova() ) return false;
    return device.platform == 'iOS';
}
function has_internet() {
    // NOTE: this requires permissions, see the Cordova docs for "connection"
    if ( is_cordova() ) {
        return navigator.connection.type != Connection.NONE;
    } else {
        return true;
    }
}


/*
 * Parse an URL into parts. Great for creating alternate hostnames or URLs, and used by cache.js and Webkit
 */
function parseURL(url) {
    var a =  document.createElement('a');
    a.href = url;
    return {
        source: url,
        protocol: a.protocol.replace(':',''),
        host: a.hostname,
        port: a.port,
        query: a.search,
        params: (function(){
            var ret = {},
                seg = a.search.replace(/^\?/,'').split('&'),
                len = seg.length, i = 0, s;
            for (;i<len;i++) {
                if (!seg[i]) { continue; }
                s = seg[i].split('=');
                ret[s[0]] = s[1];
            }
            return ret;
        })(),
        file: (a.pathname.match(/\/([^\/?#]+)$/i) || [,''])[1],
        hash: a.hash.replace('#',''),
        path: a.pathname.replace(/^([^\/])/,'/$1'),
        relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [,''])[1],
        segments: a.pathname.replace(/^\//,'').split('/')
    };
}


/*
 * Given a L.Latlng object, return a string of the coordinates in standard GPS or geocaching.com format
 * That is:  N DD MM.MMM W DDD MM.MMM
 * This is useful if you're printing the coordinates to the screen for the end user, as it's the expected format for GPS enthusiasts.
 */
function latLngToGPS(latlng) {
    var lat = latlng.lat;
    var lng = latlng.lng;
    var ns = lat < 0 ? 'S' : 'N';
    var ew = lng < 0 ? 'W' : 'E';
    var latdeg = Math.abs(parseInt(lat));
    var lngdeg = Math.abs(parseInt(lng));
    var latmin = ( 60 * (Math.abs(lat) - Math.abs(parseInt(lat))) ).toFixed(3);
    var lngmin = ( 60 * (Math.abs(lng) - Math.abs(parseInt(lng))) ).toFixed(3);
    var text = ns + ' ' + latdeg + ' ' + latmin + ' ' + ew + ' ' + lngdeg + ' ' + lngmin;
    return text;
}


/*
 * Query the Bing Locations API, to geocode an address or landmark
 * Pass it a callback for finding results and a callback for finding no results
 * This is based on http://msdn.microsoft.com/en-us/library/gg427601.aspx but is implemented in jQuery
 * This method trims off the resourceSets stuff, passing to the success callback only a list of candidates.
 *
 * Example usage:
 * geocode("Corvallis, Oregon", function (results) {
 *     navigator.notification.alert(results[0].point.coordinates);
 *     navigator.notification.alert(results[0].bbox);
 * }, function () {
 *     navigator.notification.alert("Could not find that address.");
 * });
 */
function geocode(address,success_callback,failure_callback) {
    // if the callbacks were omitted, use these defaults
    if (! success_callback) {
        success_callback = function (results) {
            navigator.notification.alert('Found ' + results.length + ' results.');
        }
    }
    if (! failure_callback) {
        failure_callback = function () {
            navigator.notification.alert('No results found.');
        };
    }

    // this parses the raw response from Bing, figures out whether anything was found, and either
    // passes off the proper results to the success handler, or calls the error handler if there are 0 results
    // Yeah, Bing nests the results pretty far down; this mechanism saves you a few steps in your own code
    function handleReply (result) {
        if (result && result.resourceSets && result.resourceSets.length > 0 && result.resourceSets[0].resources && result.resourceSets[0].resources.length > 0) {
            success_callback(result.resourceSets[0].resources);
        } else {
            failure_callback();
        }
    };

    // set up the request and send it off. Thanks jQuery!
    var url = 'http://dev.virtualearth.net/REST/v1/Locations';
    var params    = {};
    params.query  = address;
    params.key    = BING_API_KEY;
    params.output = 'json';
    $.ajax({
        url: url,
        'data': params,
        dataType: 'jsonp',
        jsonp: 'jsonp',
        success: handleReply,
        crossDomain: true
    });
}


/*
 * A wrapper around geocode() to handle a very common use case.
 * - change back to #page-map
 * - zoom to Bing's suggested viewport
 * - disable auto-centering and uncheck the checkbox
 *
 * Example usage:
 * geocodeAndZoom("Corvallis, OR");
 */
function geocodeAndZoom(address) {
    function success(results) {
        // disable auto-centering and uncheck the Setting for it
        AUTO_RECENTER = false;
        $('input[type="checkbox"][name="features"][value="autocenter"]').removeAttr('checked').checkboxradio("refresh");

        // change to the map and center on the suggested bounds
        $.mobile.changePage('#page-map');
        setTimeout(function () {
            var bbox = new L.LatLngBounds(new L.LatLng(results[0].bbox[0],results[0].bbox[1]),new L.LatLng(results[0].bbox[2],results[0].bbox[3]));
            MAP.fitBounds(bbox);
        }, 500);
    }
    function failure() {
        navigator.notification.alert('Could not find that address. Please try again.');
    }

    geocode(address,success,failure);    
}



/*
 * This provides a dialog panel for showing an error message, which has
 * some benefits over using alert() to report errors or acknowledgements.
 * First, it is more mobile-esque and less canned than alert()
 * Second, it does not block JavaScript processing. Sometimes you do want to block, but often not.
 */
/*
 * The target dialog is as follows. Place it into your HTML.
 * You can then use alertdialog(message) same as alert()

<div data-role="dialog" id="dialog-error">
    <div data-role="header">
        <h1></h1>
    </div>
    <div data-role="content">
    </div>
</div>
*/


function mobilealert(message,header) {
    if (typeof header == 'undefined') header = 'Error';

    $('#dialog-error div[data-role="content"]').text(message);
    $('#dialog-error div[data-role="header"] h1').text(header);
    $.mobile.changePage('#dialog-error');
}
