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
 * Query the a geocoding service to geocode an address or landmark
 * Pass an address, a success callback, and an error callback (includes no results).
 * The success callback receives a list of candidate matches; each match is an object with these attributes:
 *      w       west side of the recommended bounding box
 *      s       swouth side of the recommended bounding box
 *      e       east side of the recommended bounding box
 *      n       north side of the recommended bounding box
 *      lat     latitude of the location
 *      lng     longitude of the location
 *      name    text name of the result
 * See the geocodeAndZoom() function for a great example of usage.
 *
 * The stock service with MobileMapStarter is Nominatim  https://nominatim.openstreetmap.org/
 * If you continue to use it, please refer to their usage policy.
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

    // set up the request and send it off. Thanks jQuery!
    // Nominatim's API returns a simple list; no deep metadata to wade through to get at the results list
    // but massage/standardize it into a list of {w,s,e,n,lat,lng,name} objects so our arbitrary caller at least knows what to expect
    // this helps in the future to standardize/abstract changeovers to other geocoding providers
    var url = 'https://nominatim.openstreetmap.org/search';
    var params    = {};
    params.q      = address;
    params.format = 'json';
    params.limit  = 1; // how many results?
    $.ajax({
        url: url,
        'data': params,
        dataType: 'jsonp',
        jsonp: 'json_callback',
        success: function (resultlist) {
            if (! resultlist || ! resultlist.length) failure_callback();

            var results = [];
            $.each(resultlist, function () {
                var lat  = parseFloat( this.lat );
                var lng  = parseFloat( this.lng );
                var name = this.display_name;
                var n    = parseFloat( this.boundingbox[0] );
                var s    = parseFloat( this.boundingbox[1] );
                var w    = parseFloat( this.boundingbox[2] );
                var e    = parseFloat( this.boundingbox[3] );

                results.push({w:w, s:s, e:e, n:n, lat:lat, lng:lng, name:name });
            });

            success_callback(results);
        },
        crossDomain: true
    });
}


/*
 * A wrapper around geocode() to handle a very common use case.
 * - change back to #page-map
 * - fetch the first results, and zoom to its suggested viewport
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
        // hypothetically you could use results[0].lat and results[0].lng to lay a marker, zoom in very closely, etc.
        $.mobile.changePage('#page-map');
        setTimeout(function () {
            var bbox = new L.LatLngBounds(new L.LatLng(results[0].s,results[0].w),new L.LatLng(results[0].n,results[0].e));
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
