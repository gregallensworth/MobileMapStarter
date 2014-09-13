MobileMapStarter
================

https://github.com/gregallensworth/MobileMapStarter

A starting framework for mobile maps using Cordova/Phonegap.
A minimal but functional, standalone mobile app from which to build your own creations.

This is a ready-to-run starter application for Phonegap/Cordova.
Assuming that you have the Cordova build environment all set (run "cordova" from CLI, for instance) you should be able to run this and have a map app:
    git clone https://github.com/gregallensworth/MobileMapStarter.git
    cordova prepare android
    cordova run android

    OR
    git clone https://github.com/gregallensworth/MobileMapStarter.git
    open platforms/ios/MobileMapStarter.xcodeproj in Xcode
    use curly-R to run it on your device.emulator


General Walkthrough
================

* jQuery Mobile -- A mobile-style user interface theme. Includes jQuery which makes JavaScript useful.

* Leaflet -- Quick, pretty, easy tiled maps.

* File API and L.TileLayer caching system -- Cache Leaflet tiles to device storage for offline use.

* HTML/CSS/JS layout -- The _www_ folder has Leaflet, jQuery Mobile, etc. built into a nice starting place for your map app


Phonegap Build
================

The content of the _www_ folder should be ready-to-run app with Phonegap Build. You should be able to ZIP up that content and upload to PGB.

Tip: I myself don't use Phonegap Build due to some issues. Most notably, Android apps are not set to singleTask mode, meaning that when the user taps the icon and the app is already running, a new instance is started without the prior state, selections, etc. Additionally, you can't set more advanced settings such as hiding the taskbar in iOS, using plugins beyond the few supported by Build, and so on. If you have trouble with Build, consider setting up a Mac with a build environment.


Customizing Your App
================

Start with _index.js_ This includes basic settings such as default lat/lng/zoom and your Bing API key.

Check out _config.xml_ to start personalizing your app: the name, author attribution, permissions, and so on. You'll also need to do this in iOS via Xcode.

For iOS you probably want to disable the status bar. This is done via Xcode: see the _Info_ section and set "View Controller-Based Status Bar" to false, and the _General_ section to set "Status Bar Style" to "Hide during application launch".

Swap out splash screens and icons. See _platforms/ios/MobileMapStarter/Resources_ and _platforms/android/res_

Now start customizing HTML (index.html), CSS (index.css), and JavaScript code (index.js), and start swapping out icons and other graphics under the img/ folder.

Additional, possibly useful, utility functions are found in library.js


BUGS / TODO / WISHES
================

See the Issues page for a full list.
