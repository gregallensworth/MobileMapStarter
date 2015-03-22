/*
 * index.js contains the window.load event handlers which start the app, as well as any other JavaScript code necessary.
 * This is where you will start adding your own code, adding event handlers, etc.
 *
 * The app is based on jQuery Mobile, so constructs like $('#id') and $.get() are entirely usable here.
 * But it's also designed for operating properly in Chrome for prototyping, so .click() is used instead of .tap()
 */

// the Map object, default center and zoom settings
var MAP, CACHE;
var DEFAULT_LAT =   44.5875;
var DEFAULT_LNG = -123.1712;
var DEFAULT_ZOOM = 15;
var MIN_ZOOM = 10;
var MAX_ZOOM = 16;

// initMap() will load this with some basemaps "terrain" and "photo"
// using these global references you can toggle the visible basemap via selectBasemap() or using your own programming style
// THE ONES SUPPLIED AS DEMOS IN initMap() ARE GREENINFO NETWORK'S MAPBOX ACCOUNT
// PLEASE USE YOUR OWN Mapbox layers if you use them; Mapbox is not free!
var BASEMAPS = {};

// what folder should this application use, to store offline tiles?
// passed as tge 'folder' parameter to L.TileLayer.Cordova
var OFFLINE_TILE_FOLDER = "MobileMapStarter";

// a Marker indicating our last-known geolocation, and a Circle indicating accuracy
// Our present latlng can be had from LOCATION..getLatLng(), a useful thing for doing distance calculations
var LOCATION_ICON = L.icon({
    iconUrl: 'img/marker-gps.png',
    iconSize:     [25, 41], // size of the icon
    iconAnchor:   [13, 41], // point of the icon which will correspond to marker's location
    popupAnchor:  [13, 1] // point from which the popup should open relative to the iconAnchor
});
var LOCATION  = new L.Marker(new L.LatLng(DEFAULT_LAT,DEFAULT_LNG), { clickable:false, draggable:false, icon:LOCATION_ICON });
var ACCURACY  = new L.Circle(new L.LatLng(DEFAULT_LAT,DEFAULT_LNG), 1);

// should we automatically recenter the map when our location changes?
// You can set this flag anywhere, but if there's also a checkbox toggle (there is) then also update it or else you'll confuse the user with a checkbox that's wrong
var AUTO_RECENTER = true;

/***************************************************************************************************/

/*
 * Orientation change event handler
 * Detect whether the #map_canvas is showing, and if so trigger a resize
 * Leaflet needs this so it can correct its display, e.g. when changing pages within the app
 */
function resizeMapIfVisible() {
    if (!  $("#map_canvas").is(':visible') ) return;

    var page    = $(":jqmData(role='page'):visible");
    var header  = $(":jqmData(role='header'):visible");
    var content = $(":jqmData(role='content'):visible");
    var viewportHeight = $(window).height();
    var contentHeight = viewportHeight - header.outerHeight();
    page.height(contentHeight + 1);
    $(":jqmData(role='content')").first().height(contentHeight);

    if ( $("#map_canvas").is(':visible') ) {
        $("#map_canvas").height(contentHeight);
        if (MAP) MAP.invalidateSize();
    }
}
$(window).bind('orientationchange pageshow pagechange resize', resizeMapIfVisible);


/*
 * The master init() function, called on deviceready
 * It's suggested that all other init be started from here
 * 
 * Pre-render the page divs (lazy loading doesn't help much here)
 * Start the caching system and then the Leaflet map
 * Then onward to other setup and handlers,. e.g. checkboxe,s geocoder text boxes, ...
 */
function init() {
    // pre-render the pages so we don't have that damnable lazy rendering thing messing with it
    $('div[data-role="page"]').page();

    // our startup, in phases so it's easier to keep track
    initMap();
    initSettings();
    initGeocoder();

    // ready, set go!
    // pick the basemap, center on a default location, and begin watching location
    selectBasemap('terrain');
    MAP.setView(LOCATION.getLatLng(),DEFAULT_ZOOM);

    MAP.on('locationfound', onLocationFound);
    MAP.locate({ enableHighAccuracy:true, watch:true });
}



function initMap() {
    // load the map and its initial view
    MAP = new L.Map('map_canvas', {
        attributionControl: true,
        zoomControl: true,
        dragging: true,
        closePopupOnClick: false,
        crs: L.CRS.EPSG3857,
        minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM
    });

    // add the location marker and accuracy circle
    MAP.addLayer(ACCURACY).addLayer(LOCATION);

    // add the offine-enabled basemaps  L.TileLayer.Cordova
    BASEMAPS['terrain'] = L.tileLayerCordova("http://{s}.tiles.mapbox.com/v3/greeninfo.map-fdff5ykx/{z}/{x}/{y}.jpg", {
        subdomains:['a','b','c','d'],
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                     '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                     'Imagery © <a href="http://mapbox.com">Mapbox</a>',
        // now the Cordova-specific options
        folder: OFFLINE_TILE_FOLDER,
        name:'Terrain'
    });
    BASEMAPS['photo'] = L.tileLayerCordova("http://{s}.tiles.mapbox.com/v3/greeninfo.map-zudfckcw/{z}/{x}/{y}.jpg", {
        subdomains:['a','b','c','d'],
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                     '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                     'Imagery © <a href="http://mapbox.com">Mapbox</a>',
        // now the Cordova-specific options
        folder: OFFLINE_TILE_FOLDER,
        name:'Photo'
    });

    // move the geocoder and Settings button to inside the map_canvas, as it's more responsive to size changes that way
    $('.leaflet-control-settings').appendTo( $('#map_canvas') );
    $('#geocoder').appendTo( $('#map_canvas') );
}



function initSettings() {
    // enable the basemap picker in the Settings page
    // AND check the currently-selected one
    $('input[type="radio"][name="basemap"]').change(function () {
        var layername = $(this).val();
        $.mobile.changePage('#page-map');
        selectBasemap(layername);
    });

    // enable the various "features" checkboxes
    $('input[type="checkbox"][name="features"][value="gps"]').change(function () {
        var show = $(this).is(':checked');
        if (show) {
            MAP.addLayer(ACCURACY);
            MAP.addLayer(LOCATION);
        } else {
            MAP.removeLayer(ACCURACY);
            MAP.removeLayer(LOCATION);
        }
        $.mobile.changePage('#page-map')
    });
    $('input[type="checkbox"][name="features"][value="autocenter"]').change(function () {
        AUTO_RECENTER = $(this).is(':checked');
        $.mobile.changePage('#page-map')
    });

    // enable the "Offline" checkbox to toggle all registered layers between offline & online mode
    $('#basemap_offline_checkbox').change(function () {
        var offline = $(this).is(':checked');
        if (offline) {
            switchBasemapsToOffline();
        } else {
            switchBasemapsToOnline();
        }
    });

    // the "Cache Status" checkbox tallies up offline-tile-cache usage, and writes stats to the tetx inputs
    // tip: this works since all L.TileLayer.Cordova use the same "folder" setting, so we ca pick any of them and getDiskUsage() returns stats for the whole pool for all basemaps
    $('#page-settings a[href="#page-cachestatus"]').click(function () {
        $('#cachestatus_files').val('Calculating');
        $('#cachestatus_storage').val('Calculating');

        BASEMAPS['terrain'].getDiskUsage(function (filecount,totalbytes) {
            var megabytes = (totalbytes / 1048576).toFixed(1);
            $('#cachestatus_files').val(filecount + ' ' + 'map tiles');
            $('#cachestatus_storage').val(megabytes + ' ' + 'MB');
        });
    });

    // enable the Clear Cache button in Settings
    // tip: this works since all L.TileLayer.Cordova use the same "folder" setting, so we ca pick any of them and getDiskUsage() returns stats for the whole pool for all basemaps
    $('#page-clearcache a[name="clearcache"]').click(function () {
        $.mobile.loading('show', {theme:"a", text:"Clearing cache", textonly:false, textVisible: true});
        BASEMAPS['terrain'].emptyCache(function () {
            $('#cachestatus_files').val('Emptied');
            $('#cachestatus_storage').val('Emptied');

            $.mobile.changePage("#page-cachestatus");
            $.mobile.loading('hide');
        });
        return false;
    });

    // enable the Seed Cache button in Settings
    $('#page-seedcache a[name="seedcache"]').click(function () {
        // the lon, lat, and zooms for seeding
        var lon   = MAP.getCenter().lng;
        var lat   = MAP.getCenter().lat;
        var zmin  = MAP.getZoom();
        var zmax  = MAX_ZOOM;

        // pick any of the Cordova-cached TileLayer basemaps; the pyramid calculations are the same no matetr what layer is used
        var tile_list = BASEMAPS['terrain'].calculateXYZListFromPyramid(lat,lon,zmin,zmax);

        //GDA separate into a wrapper function, then wrap and loop to do photo also
        var layername = 'terrain';
        BASEMAPS['terrain'].downloadXYZList(
            tile_list,
            false, // no overwrite, skip/keep existing tiles
            function (done,total) {
                var percent = Math.round( 100 * parseFloat(done) / parseFloat(total) );
                var text = layername + ': ' + done + '/' + total + ' ' + percent + '%';
                $.mobile.loading('show', {theme:"a", text:text, textonly:false, textVisible: true});
            },
            function () {
                $.mobile.loading('show', {theme:"a", text:"Done", textonly:false, textVisible: true});
                alert("Done!");
                $.mobile.changePage("#page-settings");
            },
            function (error) {
                alert("Failed\nError code: " + error.code);
                $.mobile.changePage("#page-settings");
            }
        );

        // cancel the button taking us back to the same page; that will happen in the progress() and error() handlers
        return false;
    });
}



function initGeocoder() {
    $('#geocoder_button').click(function () {
        var address = $('#geocoder_text').val();
        if (! address) return;
        geocodeAndZoom(address);
    });
    $('#geocoder_text').keydown(function (key) {
        if(key.keyCode == 13) $('#geocoder_button').click();
    });
}





/*
 * This is mostly a callback for the [name="basemap"] radioboxes,
 * but can also be called programatically to set the base layer at any time
 */
function selectBasemap(which) {
    for (var i in BASEMAPS) MAP.removeLayer(BASEMAPS[i]);
    MAP.addLayer(BASEMAPS[which],true);
}


/*
 * Wrapper functions to set the basemaps to online and offline mode
 * See also L.TileLayer.Cordova documentation
 */
function switchBasemapsToOffline() {
    for (var i in BASEMAPS) BASEMAPS[i].goOffline(layername);
}
function switchBasemapsToOnline() {
    for (var i in BASEMAPS) BASEMAPS[i].goOnline(layername);
}


/*
 * Whenever the user's location changes, this is called. It updates the LOCATION and ACCURACY layers (a Marker and a Circle).
 */
function onLocationFound(event) {
    // Update our location and accuracy
    // Even if we don't auto-pan nor display the marker, we may need LOCATION updated for future distance-to-point calculations.
    LOCATION.setLatLng(event.latlng);
    ACCURACY.setLatLng(event.latlng);
    ACCURACY.setRadius(event.accuracy);

    // center the map
    if (AUTO_RECENTER) MAP.panTo(LOCATION.getLatLng());
}

