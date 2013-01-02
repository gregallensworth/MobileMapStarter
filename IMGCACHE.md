This app makes use of imgcache.js, by Christophe Benoit
This is a JavaScript library which caches images to the local file storage,
so they may be accessed again at a later time. This has been adapted to
work with Leaflet's tiles in the map canvas.

A few words about imgcache:

* Thank you, Christophe! I had started work on my own version of this, but yours is better and saves me weeks of development.

* To test in Chrome, you must supply additional flags (see README.md) AND you will be prompted for permission to permanently store files.

* In Chrome, you may browse your cached files by browsing to this URL:   filesystem:file:///persistent/imgcache/
