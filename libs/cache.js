/*
 * A class for caching tiles for registered L.TileLayer instances, then changing their URL so they use the offline tiles.
 * That is to say, a helper which allows L.TileLayer instances to be used online and offline.
 * The L.TileLayer MUST have a "name" option specified in its options, so the layer can be uniquely identified,
 * particularly in the creatiuon of subfolders for storing the tiles.
 * 
 * Usage example:
 *     // instantiate a layer, then initialize the map after the filesystem comes ready
 *     CACHE = new OfflineTileCacher();
 *     CACHE.init(function () {
 *         CACHE.registerLayer(PHOTO_BASEMAP);
 *         initMap();
 *     }, function () {
 *         alert('Could not load the local filesystem. Exiting.');
 *         return;
 *     });
 * 
 *     // register a layer, request seeding for a given center & zoom range, switch offline & online mode
 *     CACHE.registerLayer(PHOTO_BASEMAP); // L.TileLayer with a "name" option "Photo"
 *     CACHE.seedCache('Photo',45,-120,12,16,progress,error);
 *     useLayerOffline('Photo'); // switch over to using the on-disk tiles
 *     useLayerOnline('Photo'); // switch over to using the HTTP tiles
 * 
 * The math for tile calculations was cribbed from the pyramid class from utils/tile.js by Silvia Terra on Github
 * The filesystem and XHR download compatibility for Chrome, benefits from lessons learned in Christophe Beniot's ImgCache
 *
 * Undocumented feature:
 * By virtue of having a public attribute pointing to the FileSystem,
 * a public DirectoryEntry for the storage directory (.DIRECTORY),
 * and a DirectoryEntry for the tile subdirectory (.TILEDIRECTORY),
 * the cache's FileSystem handle can be used for storing things other than tiles if you stay out of the .TILEDIRECTORY
 */

/*
 * Constructor: Specify the name of a subdirectory in the filesystem
 * It will be created if necesary.
 * This is specially for Cordova on Android where you're given the entire SD card filesystem.
 * For Chrome and iOS you're given a sandbox but for consistency we still do a subdirectory.
 */
var OfflineTileCacher = function(directoryname) {
    // after init() this becomes a LocalFileSystem.FileSystem handle
    this.FS = null;
    // max number of tiles to allow at a time; if they zoom such that there are more, cancel seeding
    // keep in mind this is effectively PER LAYER, before you think about increasing this limit
    // see the radius calculation in this.seedCache() for notes about the known buffers & tile counts
    this.MAX_TILES = 900;
    // a list of L.TileLayer objects registered with this OfflineTileCacher instance via this.registerLayer()
    this.LAYERS = {};
    // the name of the subdirectory, as given to us, and then specifically the subdir which has the tiles
    this.subdirname  = directoryname;
    this.tiledirname = 'tiles';
    // the directory handles for that subdir and tiledir
    this.DIRECTORY  = null;
    this.TILEDIRECTORY = null;

    // a reference to this here cache instance, cuz "this" gets confused when we get multiple layers deep...
    var myself = this;

    /*
     * Public function, and probably the first one you'll use.
     * Initialize the filesystem, and set up an XHR wrapper so Chrome can do file downloads
     */
    this.init = function (success,failure) {
        // INIT PART 1: open a handle to LocalFileSystem, taking care to handle both Chrome and Cordova
        var myself = this;

        function filesystem_ok(filesystem) {
            myself.FS = filesystem;

            // create our own subdirectory, so we're not polluting the SD card directly, and store a reference to it so folks can hypothetically access/store files other than tile
            // then create the tile subdirectory and store a reference to it; used for fetching, saving, or deleting tiles later
            filesystem.root.getDirectory(myself.subdirname, {create:true, exclusive:false}, function (subdir) {
                // store the reference to our own directory
                myself.DIRECTORY = subdir;
                // create a subdir for tiles
                subdir.getDirectory('tiles', {create:true, exclusive:false}, function (tilesubdir) {
                    myself.TILEDIRECTORY = tilesubdir;
                    if (success) success();
                }, function (error) {
                    alert("Unable to create tile subdirectory\n" + error.code);
                });
            }, function (error) {
                alert("Unable to create application directory\n" + error.code);
            });
        };
        function filesystem_fail(error) {
            alert('Failed to initialise LocalFileSystem: ' + error.code);
            if (failure) failure();
        };

        if (is_cordova()) {
            // Phonegap/Cordova, skip straight to requesting the filesystem
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, filesystem_ok, filesystem_fail);
        } else {
            // Webkit, request a quota approval THEN move on to requesting a filesystem
            window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
            window.storageInfo = window.storageInfo || window.webkitStorageInfo;
            if (!window.storageInfo) {
                alert('Your device does not support the HTML5 File API.');
                if (failure) failure();
                return;
            }

            var quota = 1000*1024*1024; // 1000 MB quota for testing in Webkit
            window.storageInfo.requestQuota(
                window.storageInfo.PERSISTENT, 
                quota,
                function() { window.requestFileSystem(window.storageInfo.PERSISTENT, quota, filesystem_ok, filesystem_fail);  },
                function(error) { alert('Failed to request quota: ' + error.code); if (failure) failure(); }
            );
        }

        // INIT PART 2: define FileTransfer as either the FileTransfer function (Cordova) or else a XHR wrapper (Chrome)
        // either way, we can use myself.FileTransfer.download()
        if (is_cordova()) {
            myself.FileTransfer = new FileTransfer();
        } else {
            myself.FileTransfer = {};
            myself.FileTransfer.download = function (url,target,success_callback,error_callback) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'blob';
                xhr.onload = function(event){
                    if (this.readyState == this.DONE && this.response && (this.status == 200 || this.status == 0)) {
                        var xhr = this;
                        myself.FS.root.getFile(target, { create:true }, function(fileEntry) {
                            fileEntry.createWriter(function(writer){
                                // create a Blob of the fetched content, and use xhr FileWriter to save it to disk
                                var blob = new Blob([xhr.response], {type:xhr.getResponseHeader('Content-type') });
                                writer.onerror = error_callback;
                                writer.onwriteend = success_callback;
                                writer.write(blob);
                            }, error_callback);
                        }, error_callback);
                    } else {
                        alert('Image ' + uri + ' could not be downloaded - status: ' + this.status);
                    }
                };
                xhr.onerror = function() {
                    alert('XHR error - Image ' + uri + ' could not be downloaded - status: ' + this.status);
                };
                xhr.send();
            }
        }
    };


    /*
     * Register a L.TileLayer with this cache provider.
     * This calculates the layer._url_online and layer._url_offline format strings,
     * which are used with layerOnline() and layerOffline()
     */
    this.registerLayer = function (tilelayer) {
        var myself = this;

        if (! tilelayer._url) return alert('Can only register TileLayer layers.');
        if (! tilelayer.options.name) return alert('The name option must be supplied.');

        // the _url_online is simply the URL provided, which is presumably on the Internet or they wouldn't be trying to cache it
        tilelayer._url_online = tilelayer._url;

        // _url_offline varies for Webkit or Cordova
        // Webkit: the word "filesystem:" plus http://hostname/persistent/  This is NOT the same dirpath as we used to write the file!
        // Cordova: myself.FS.root.fullPath is the true pathname and it works as-is
        var filename = [tilelayer.options.name,'{z}','{x}','{y}'].join('-') + '.png';
        if (is_cordova() ) {
            tilelayer._url_offline = CACHE.TILEDIRECTORY.fullPath + '/' + filename;
        } else {
            var urlparts = parseURL(document.location.href);
            tilelayer._url_offline = 'filesystem:' + urlparts.protocol + '://' + urlparts.host + '/persistent/' + myself.subdirname + '/' + myself.tiledirname + '/' + filename;
        }

        // done adding the two URL versions; log it to our registry
        myself.LAYERS[ tilelayer.options.name ] = tilelayer;
    };


    /*
     * Get an associative array of registered layers
     */
    this.registeredLayers = function() {
        var myself = this;
        return myself.LAYERS;
    }

    /*
     * Set the registered layer (specified by name) to use Online mode
     * This is done simply by calling layer.setUrl() and giving layer._url_online
     */
    this.useLayerOnline = function (layername) {
        var myself = this;
        myself.LAYERS[layername].setUrl( myself.LAYERS[layername]._url_online );
    };


    /*
     * Set the registered layer (specified by name) to use Offline mode
     * This is done simply by calling layer.setUrl() and giving layer._url_offline
     */
    this.useLayerOffline = function (layername) {
        var myself = this;
        myself.LAYERS[layername].setUrl( myself.LAYERS[layername]._url_offline );
    };


    /*
     * Clear out all of out stored documents. WE ASSUME that everything is a cached tile
     * Accepts a callback function. This function will be passed 2 params: number of files, total bytes
     */
    this.clearCache = function(callback) {
        var myself = this;

        var dirReader = myself.TILEDIRECTORY.createReader();
        dirReader.readEntries(function (entries) {
            function deleteFileByIndex(index) {
                // if i is high enough, we're past the last one, so run the callback
                if (index >= entries.length) {
                    if (callback) callback();
                    return;
                }
                // not done: delete the file, on success move on to the next one
                entries[index].remove(
                    function () {
                        deleteFileByIndex(index+1);
                    },
                    function () {
                        alert('Failed to delete file.');
                    }
                );
            }
            deleteFileByIndex(0);
        },function () {
            alert('Unable to read storage directory.');
        });
    };


    /*
     * Calculate the disk usage of all documents (everything is a cached tile, we presume...)
     * Asynchronous. Accepts a callback function. This function will be passed 2 params: number of files, total bytes
     */
    this.getDiskUsage = function(callback) {
        var myself = this;

        var dirReader = myself.TILEDIRECTORY.createReader();
        dirReader.readEntries(function (entries) {
            // a mix of files & directories. In our case we know it's all files and all cached tiles, so just add up the filesize
            // again with this goofy completely-async File API, so we can't even iterate over files without recursive callbacks
            var files = 0;
            var bytes = 0;

            // same design pattern as a lot of the cache: function takes an index, calls itself with index+1, until i>=length
            function processFileEntry(index) {
                // if i is high enough, we're past the last one, so run the callback
                if (index >= entries.length) {
                    if (callback) callback(files,bytes);
                    return;
                }

                // not done, so get file info, increment the counts, on to i+1
                entries[index].file(
                    function (fileinfo) {
                        bytes += fileinfo.size;
                        files++;
                        processFileEntry(index+1);
                    },
                    function () {
                        alert('Failed reading file info?');
                    }
                );
            }
            processFileEntry(0);
        },function () {
            alert('Unable to read directory entries.');
        });
    };


    /*
     * Internal method.
     * Given a list of URLs and an index in that list, make the download.
     * On success, call myself.downloadFile(index+1). Repeat until index>length
     */
    this.downloadFile = function(urls,index,progress,error) {
        var myself = this;

        // if the index is past the end, we're done; no need to call the progress handler, the last file download already would have
        if (index >= urls.length) return;

        // does this file exist? if so (succesful file open) then move on to the next one
        // if not, then proceed with downloading it
        var filename_exists = urls[index].filename;
        myself.TILEDIRECTORY.getFile(filename_exists, {create:false}, function () {
            // file opened successfully, so we don't nee to download it
            //console.log(['already in cache',filename_exists]);
            if (progress) progress(index+1,urls.length);
            myself.downloadFile(urls,index+1,progress);
        }, function () {
            // file open failed, which means we need to download it
            // design pattern to do sequential asynchronous downloads: on success, call download(index+1)
            //console.log(['not in cache',filename_exists]);
            myself.FileTransfer.download(urls[index].url, urls[index].filename,
                function(file) {
                    if (progress) progress(index+1,urls.length);
                    myself.downloadFile(urls,index+1,progress);
                },
                function(error) {
                    var errmsg;
                    switch (error.code) {
                        case FileTransferError.FILE_NOT_FOUND_ERR:
                            errmsg = "One of these was not found:\n";
                            errmsg += urls[index].url + "\n";
                            errmsg += urls[index].filename;
                            break;
                        case FileTransferError.INVALID_URL_ERR:
                            errmsg = "Invalid URL:\n";
                            errmsg += urls[index].url + "\n";
                            errmsg += urls[index].filename;
                            break;
                        case FileTransferError.CONNECTION_ERR:
                            errmsg = "Connection error at the web server.\n";
                            break;
                    }
                    alert("Download error.\n" + errmsg);
                    if (error) error();
                }
            );
        });
    };

    this.seedCache = function(layername,lat,lon,zmin,zmax,progress_callback,error_callback) {
        var myself = this;

        // Phase 1: compose a list of URLs to download, doing some math
        var layerobj = myself.LAYERS[layername];
        var downloads = [];
        for (z=zmin; z<=zmax; z++) { //iterate over zoom levels
            var t_x = Math.floor((lon+180)/360*Math.pow(2,z));
            var t_y = Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,z));

            // how far around the centerpoint do we buffer outward, in tiles, to form a pyramid of the selected area?
            // at zmin it's 2 tiles out from the center, each level deeper is double that radius to keep the same area
            // This results in a known set of tile counts:
            // zmin         1+2+2   = 5 -> 25 tiles
            // zmin + 1     1+4+4   = 9 -> 81 tiles
            // zmin + 2     1+8+8   = 17 -> 289 tiles
            // zmin + 3     1+16+16 = 33 -> 441 tiles
            // zmin + 4     1+32+32 = 65 -> 4225 tiles
            // zmin + 5     1+64+64 = 129 -> 16641 tiles
            // Keep these in mind when you want to change this.MAX_TILES to allow more zoom levels!
            var radius = 2 * ( 1 + (z-zmin) );

            for (var x=t_x-radius; x<=t_x+radius; x++) {
                for (var y=t_y-radius; y<=t_y+radius; y++) {
                    // compose an URL given the layer's URL template (may or may not use subdomains)
                    //console.log([layerobj._url,z,x,y]);
                    var url = layerobj._url_online;
                    url = url.replace('{z}',z);
                    url = url.replace('{x}',x);
                    url = url.replace('{y}',y);
                    if (layerobj.options.subdomains) {
                        var idx = Math.floor(Math.random() * layerobj.options.subdomains.length);
                        var subdomain = layerobj.options.subdomains[idx];
                        url = url.replace('{s}',subdomain);
                    }
                    //console.log(url);

                    // make up the filename, a flat list of files under the tiles/ directory
                    // account for Chrome adding a trailing / and Cordova not doing so
                    var filename = myself.TILEDIRECTORY.fullPath + '/' + [layername,z,x,y].join('-') + '.png';
                    //console.log(filename);

                    // add it to the list
                    downloads[downloads.length] = {
                        layername:layername, x:x, y:y, z:z, filename:filename, url:url
                    };
                } // end of this X/Y/tile URL
            } // end of the X column
        } // end of z zoom level
        //console.log(downloads.length);

        // make sure we're not asking for too much
        if (downloads.length > myself.MAX_TILES) {
            alert("The selected area is too large.\nPlease zoom in to a smaller area.");
            return;
        }

        // Phase 2: begin downloading! Set up a function which makes a download, and on callback it calls downloadFile() with index+1
        // thus, we get serial downloading despite the async nature
        myself.downloadFile(downloads,0,progress_callback,error_callback);
    };

} // end of CACHE "class" definition
