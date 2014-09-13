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

// PLEASE USE YOUR OWN Mapbox layers if you use them
// the "name" attribute is REQUIRED. it's not Leaflet standard, but is used by the cache system.
var BASEMAPS = {};
BASEMAPS['terrain'] = new L.TileLayer("http://{s}.tiles.mapbox.com/v3/greeninfo.map-fdff5ykx/{z}/{x}/{y}.jpg", { name:'Terrain', subdomains:['a','b','c','d'] });
BASEMAPS['photo']   = new L.TileLayer("http://{s}.tiles.mapbox.com/v3/greeninfo.map-zudfckcw/{z}/{x}/{y}.jpg", { name:'Photo', subdomains:['a','b','c','d'] });
//BASEMAPS['plain']   = new L.TileLayer("http://{s}.tiles.mapbox.com/v3/greeninfo.map-8ljrd2bt/{z}/{x}/{y}.jpg", { name:'Streets', subdomains:['a','b','c','d'] });

// PLEASE USE YOUR OWN Bing API key
// used primarily by the geocoder
var BING_API_KEY = "AjBuYw8goYn_CWiqk65Rbf_Cm-j1QFPH-gGfOxjBipxuEB2N3n9yACKu5s8Dl18N";

// the name of a subdirectory where this app will store its content
// this is particularly important on Android where filesystem is not a sandbox but your SD card
var STORAGE_SUBDIR = "MobileMapStarter";

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

    // start up the filesystem and then the map
    initCacheThenMap();

    // set up buttons, dialogs, etc.
    initSettings();
    initGeocoder();
}



function initCacheThenMap() {
    // initialize the filesystem where we store cached tiles. when this is ready, proceed with the map
    CACHE = new OfflineTileCacher(STORAGE_SUBDIR);
    CACHE.init(function () {
        CACHE.registerLayer(BASEMAPS['terrain']);
        CACHE.registerLayer(BASEMAPS['photo']);
        initMap();
        resizeMapIfVisible();
    }, function () {
        alert('Could not load the local filesystem. Exiting.');
        return;
    });
}

function initMap() {
    // load the map and its initial view
    MAP = new L.Map('map_canvas', {
        attributionControl: true,
        zoomControl: true,
        dragging: true,
        closePopupOnClick: false,
        crs: L.CRS.EPSG3857,
        minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        layers : [ BASEMAPS['terrain'], ACCURACY, LOCATION ]
    });
    MAP.setView(LOCATION.getLatLng(),DEFAULT_ZOOM);

    // move the geocoder and Settings button to inside the map_canvas, as it's more responsive to size changes that way
    $('.leaflet-control-settings').appendTo( $('#map_canvas') );
    $('#geocoder').appendTo( $('#map_canvas') );

    // set up the event handler when our location is detected, and start continuous tracking
    MAP.on('locationfound', onLocationFound);
    MAP.locate({ enableHighAccuracy:true, watch:true });

    // Leaflet behavior patch: on a zoomend event, check whether we're at MIN_ZOOM or MAX_ZOOM and show/hide the +/- buttons in the Zoom control
    MAP.on('zoomend', function () {
        var z = MAP.getZoom();
        z <= MIN_ZOOM ? $('.leaflet-control-zoom-out').hide() : $('.leaflet-control-zoom-out').show();
        z >= MAX_ZOOM ? $('.leaflet-control-zoom-in').hide() : $('.leaflet-control-zoom-in').show();
    });
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

    // enable the Clear Cache and Seed Cache buttons in Settings, and set up the progress bar
    $('#page-clearcache a[name="clearcache"]').click(function () {
        $.mobile.loading('show', {theme:"a", text:"Clearing cache", textonly:false, textVisible: true});
        CACHE.clearCache(function () {
            // on successful deletion, repopulate the disk usage boxes with what we know is 0
            $('#cachestatus_files').val('0 map tiles');
            $('#cachestatus_storage').val('0 MB');

            $.mobile.changePage("#page-cachestatus");
            $.mobile.loading('hide');
        });
        return false;
    });
    $('#page-seedcache a[name="seedcache"]').click(function () {
        // the lon, lat, and zooms for seeding
        var lon   = MAP.getCenter().lng;
        var lat   = MAP.getCenter().lat;
        var zmin  = MAP.getZoom();
        var zmax  = MAX_ZOOM;

        // fetch the assocarray of layername->layerobj from the Cache provider,
        // then figure out a list of the layernames too so we can seed them sequentially
        var layers_to_seed = CACHE.registeredLayers();
        var layernames = [];
        for (var l in layers_to_seed) layernames[layernames.length] = layers_to_seed[l].options.name;
        var last_layer_name = layernames[layernames.length-1];

        function seedLayerByIndex(index) {
            if (index >= layernames.length) {
                // past the end, we're done
                $.mobile.changePage("#page-settings");
                return;
            }
            var layername = layernames[index];

            var layer_complete = function(done,total) {
                // hide the spinner
                $.mobile.loading('hide');
                // go on to the next layer
                seedLayerByIndex(index+1);
            }
            var progress = function(done,total) {
                // show or update the spinner
                var percent = Math.round( 100 * parseFloat(done) / parseFloat(total) );
                var text = layername + ': ' + done + '/' + total + ' ' + percent + '%';
                $.mobile.loading('show', {theme:"a", text:text, textonly:false, textVisible: true});
                // if we're now done, call the completion function to close the spinner
                if (done>=total) layer_complete();
            };
            var error = function() {
                alert('Download error!');
            }

            CACHE.seedCache(layername,lat,lon,zmin,zmax,progress,error);
        }

        // start it off!
        seedLayerByIndex(0);

        // cancel the button taking us back to the same page; that will happen in the progress() and error() handlers
        return false;
    });

    // enable the "Offline" checkbox to toggle all registered layers between offline & online mode
    $('#basemap_offline_checkbox').change(function () {
        var offline = $(this).is(':checked');
        var layers  = CACHE.registeredLayers();
        if (offline) {
            for (var layername in layers) CACHE.useLayerOffline(layername);
        } else {
            for (var layername in layers) CACHE.useLayerOnline(layername);
        }
    });

    // enable the "Cache Status" checkbox to calculate the disk usage and write to to the dialog
    // allow the change to the dialog, and start the asynchronous disk usage calculation
    $('#page-settings a[href="#page-cachestatus"]').click(function () {
        $('#cachestatus_files').val('Calculating');
        $('#cachestatus_storage').val('Calculating');

        CACHE.getDiskUsage(function (filecount,totalbytes) {
            var megabytes = (totalbytes / 1048576).toFixed(1);
            $('#cachestatus_files').val(filecount + ' ' + 'map tiles');
            $('#cachestatus_storage').val(megabytes + ' ' + 'MB');
        });
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

