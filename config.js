/*
 * config.js contains basic configuration variables:
 * Starting lat, lng, zoom
 * Max/Min zoom levels
 * Basemap configurations
 */

var DEFAULT_LAT =   44.5875;
var DEFAULT_LNG = -123.1712;
var DEFAULT_ZOOM = 15;

var MIN_ZOOM = 10;
var MAX_ZOOM = 18;

var BING_API_KEY = "AjBuYw8goYn_CWiqk65Rbf_Cm-j1QFPH-gGfOxjBipxuEB2N3n9yACKu5s8Dl18N";

var BASEMAPS = {};
BASEMAPS['terrain']    = new L.TileLayer("http://{s}.tiles.mapbox.com/v3/greeninfo.map-fdff5ykx/{z}/{x}/{y}.jpg", { subdomains:['a','b','c','d'] });
BASEMAPS['plain']      = new L.TileLayer("http://{s}.tiles.mapbox.com/v3/greeninfo.map-8ljrd2bt/{z}/{x}/{y}.jpg", { subdomains:['a','b','c','d'] });
BASEMAPS['bingaerial'] = new L.BingLayer(BING_API_KEY, { type:'AerialWithLabels' });
