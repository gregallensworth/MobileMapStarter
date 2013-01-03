/*
 * library.js contains additional utility functions which you may or may not find useful for your case.
 */

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
        var bbox = new L.LatLngBounds(new L.LatLng(results[0].bbox[0],results[0].bbox[1]),new L.LatLng(results[0].bbox[2],results[0].bbox[3]));
        MAP.fitBounds(bbox);
    }
    function failure() {
        navigator.notification.alert('Could not find that address. Please try again.');
    }

    geocode(address,success,failure);    
}

