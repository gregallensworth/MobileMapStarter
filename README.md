MobileMapStarter
================

https://github.com/gregallensworth/MobileMapStarter

A starting framework for mobile maps using Cordova/Phonegap.
A minimal but functional, standalone mobile app from which to build your own creations.

_This is the jQuery Mobile version of MobileMapStarter If you use Ionic, you may be interested in https://github.com/greeninfo/IonicMapStarter instead._


Getting It
================

I recommend a tested, known-stable build:

    https://github.com/gregallensworth/MobileMapStarter/releases

You can grab master if you're feeling adventurous, or if you want to help with MobileMapStarter.


Compiling and Launching
================

This is a ready-to-run starter application for Phonegap/Cordova.
Assuming that you have the Cordova build environment all set (run "cordova" from CLI, for instance) you should be able to run this and have a map app:

    # Android
    git clone https://github.com/gregallensworth/MobileMapStarter.git
    cordova prepare android
    cordova run android

    # iOS / Xcode
    git clone https://github.com/gregallensworth/MobileMapStarter.git
    cordova prepare ios
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

Check out _config.xml_ to start personalizing your app: the name, author attribution, permissions, and so on. You'll also need to do this in iOS via Xcode.

To change the name of the app after you've edited _config.xml_, it's easiest to simply remove and re-add the platforms using _cordova platform rm ios android_ and _cordova platform add ios android_. The platform tool will read _config.xml_ and generate the Xcode file and the AndroidManifest based on the <name> tag in _config.xml_ But then you'll want to re-instate a few platform-specific hacks:
+ For iOS you probably want to disable the status bar. This is done via Xcode: see the _Info_ section and set "View Controller-Based Status Bar" to false, and the _General_ section to set "Status Bar Style" to "Hide during application launch".
+ For Android, you'll want to set _singleTask_ mode, so the app can be reopened if the user switches to something else. Open _platforms/android/AndroidManifest.xml_ and look for the <activity> element. Add this attribute: _android:launchMode="singleTask"_

Swap out splash screens and icons. See _platforms/ios/MobileMapStarter/Resources_ and _platforms/android/res_

Now start customizing _index.html_ and _index.css_ and _index.js_ to make your app.

And check out the possibly useful utility functions library.js

Enjoy!


Bugs / Todo / Wishes
================

See the Issues page on Github for a full list.
