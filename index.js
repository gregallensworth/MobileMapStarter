/*
 * index.js contains the window.load event handlers which start the app, as well as any other JavaScript code necessary.
 * This is where you will start adding your own code, adding event handlers, etc.
 *
 * The app is based on jQuery Mobile, so constructs like $('#id') and $.get() are entirely usable here.
 */

// the Map object
var MAP;

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


/*
 * On page load
 * pre-render the page divs (lazy loading doesn't help much here)
 * start the Leaflet map
 * Set up event handlers when our location changes
 */
$(window).load(function () {
    // pre-render the pages so we don't have that damnable lazy rendering thing messing with it
    $('div[data-role="page"]').page();

    // initialize the tile caching
    ImgCache.options.debug = false;
    ImgCache.options.usePersistentCache = true;
    ImgCache.options.chromeQuota = 100 * 1024 * 1024;
    //ImgCache.init();

    // load the Leaflet map, with the selected basemap
    MAP = new L.Map('map_canvas', {
        attributionControl: true,
        zoomControl: true,
        dragging: true,
        closePopupOnClick: false,
        crs: L.CRS.EPSG3857,
        minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        layers : [ BASEMAPS['terrain'], ACCURACY, LOCATION ]
    });

    // set an event handler on the Leaflet map, so that changing the viewport will trigger the images to be cached and then to load from the cache
/*
    function cacheVisibleTiles() {
        $('#map_canvas div.leaflet-tile-pane img.leaflet-tile').each(function () {
            var img = $(this);
            var src = img.attr('src');
            if (src.indexOf('http') == -1) return; // not loading via HTTP, already cached?
            ImgCache.cacheFile(src, function () {
                ImgCache.useCachedFile(img);
            });
        });
    }
    MAP.on('moveend',cacheVisibleTiles);
    MAP.on('zoomend',cacheVisibleTiles);
*/

    // set an event handler on all of the BASEMAPS layers, so that a failure to load a tile, will be interpreted as us being offline,
    // and will cause the tile to be loaded from the cache if possible
/*
    BASEMAPS['terrain'].on('tileerror', function (e) {
        ImgCache.useCachedFile( $(e.tile) );
    });
*/

    // set an initial view
    MAP.setView(LOCATION.getLatLng(),DEFAULT_ZOOM);

    // set up a on-location handler: call onLocationFound() as defined in library.js
    // then set ongoing location tracking
    MAP.on('locationfound', onLocationFound);
    MAP.locate({ enableHighAccuracy:true, watch:true });

    // enable the basemap picker in the Settings page
    // AND check the currently-selected one
    $('input[type="radio"][name="basemap"]').change(function () {
        var layername = $(this).val();
        selectBasemap(layername);
        $.mobile.changePage('#page-map')
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

    // enable the Clear Cache button in Settings, to clear the Imgcache
    $('#page-clearcache a[name="clearcache"]').click(function () {
        ImgCache.clearCache();
    });
});


/*
 * Orientation change event handler
 * Detect whether the #map_canvas is showing, and if so trigger a resize
 * Leaflet needs this so it can correct its display, e.g. when changing pages within the app
 */
$(window).bind('orientationchange pageshow resize', function() {
    if ( MAP && $('#map_canvas').is(':visible') ) {
        $('#map_canvas').height( $(window).height() );
        $('#map_canvas').width( $(window).width() );
        MAP.invalidateSize();
    }
});



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

