tacionJS
=========
A [jQuery Mobile](http://jquerymobile.com) framework for creating real-time presentations

Examples
--------
Currently, [the only example](http://azoff.github.com/tacion.js/examples/spain.js) is the one made for [Spain.JS](http://spainjs.org). The presentation is set up to be controlled by a presenter, so you will need to disable syncing in order to manually move between slides. Moving between slides can be done by use of the arrow keys, or swiping (for touch devices).

- [Spain.JS Presentation](http://azoff.github.com/tacion.js/examples/spain.js)

Licensing
---------
Tacion is licensed to be compatible with jQuery, and hence is dual-licensed under the same licenses:

- [GPL License (v2)](http://github.com/azoff/tacion.js/blob/master/GPL-LICENSE.md)
- [MIT License](http://github.com/azoff/tacion.js/blob/master/MIT-LICENSE.md)

Feature Requests and Bug Reports
--------------------------------
If you would like to submit a bug report or suggest a feature to add to tacion, then please use the [official tracker](https://github.com/azoff/tacion.js/issues). If you would like to contribute to the project, please [fork the project](https://github.com/azoff/tacion.js), make your changes, and submit a pull request.

Getting Started
---------------
In order to get started with tacion, the implementor must include it's dependencies. Of course, the first obvious dependency is [jQuery Mobile](http://jquerymobile.com). To include jQuery mobile, just add the following markup to your source code:

```html
<!--- Add to near the top of <head> --->
<link rel="stylesheet" href="//code.jquery.com/mobile/1.1.0/jquery.mobile-1.1.0.min.css">

<!--- Add near the bottom of <body> --->
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
<script src="//code.jquery.com/mobile/1.1.0/jquery.mobile-1.1.0.min.js"></script>
```

That should take care of loading jQuery Mobile. The only other external dependency is [yepnope](http://yepnopejs.com), a conditional script loader that tacion will use to load the JavaScript and CSS for each slide. If you use [Modernizr](http://modernizr.com), chances are that you are already including it. Unfortunately, yepnope is no longer packaged with a CSS loader by default - so you will have to either include [the plugin](http://github.com/SlexAxton/yepnope.js/blob/master/plugins/yepnope.css.js) yourself, or just include tacion's [custom build of yepnope](http://github.com/azoff/tacion.js/blob/master/libs/yepnope.custom.min.js):

```html
<!--- Using tacion's custom build of yepnope --->
<script src="libs/yepnope.custom.min.js"></script>
```

Finally, you are free to include tacion and start your presentation:


```html
<!--- Base styles for tacion are in 'src/client/tacion.css' --->
<link rel="stylesheet" href="src/client/tacion.css">

<!--- The tacion client is also in the same folder --->
<script src="src/client/tacion.min.js"></script>

<!-- Assuming your presentation is in the 'my_presentation' folder --->
<script>
tacion.start('./my_presentation');
</script>
``` 

That's it! If you made it this far, tacion should begin loading your presentation from the presentation folder. For details about what to include in the presentation folder, continue to the next section.

The Presentation Folder
-----------------------
The presentation folder should contain all the html files that compose your slides, as well as any assets your slides may require. The file paths realtive to the presentation folder are left up to the implementor, so long as a valid `manifest.json` file lives in its root. This file will be used by tacion to determine where to load slides, and what order to load them in. The next section breaks down the manifest file, and explains its internal definitions.

The Manifest File (manifest.json)
---------------------------------
The manifest file declares the slides in your presentation to tacion; it is the only required file in the root of your presentation folder. Inside of the manifest file is a single JSON object, whose properties define the presentation:

```json
{
	/**
	* this is a Pusher API key. It is optional and only necessary if you would like to enable
	* syncing across people watching your presentation (a.k.a. passengers). Pusher is a socket
	* WebService that tacion uses to do real-time communication. If you're interested in this
	* functionality, check out the section on syncing below
	*/
	"pusher": "ff4d7585176a252fe649",

	/**
	* if you plan on sending real-time sync messages (see above), you need to define a server
	* that can send messages. Tacion comes packaged with one such server; you can find it in
	* the 'src/server' folder.
	*/
	"server": "http://127.0.0.1:8080",

	/**
	* the presentation relative path to the template file for each slide. template files wrap each slide
	* content file, saving you on re-typing markup. For more information on template files, see the section
	* below
	*/
	"template": "page.html",

	/**
	* a list of presentation relative paths to content files for eac slide. each content file represents
	* a new slide. For more information on content slide files, see the section below.
	*/
	"slides": [
		"relative/path/to/slide_1.html",
		"relative/path/to/slide_two.html",
		// ...
		"relative/path/to/my_last_slide.html"
	]
}
```

Syncing (and The Pusher WebService)
-----------------------------------
One of the great features you get with tacion is syncing. Syncing is a mechanism that allows the presenter and his audience to keep in sync. To help add clarity to the notion of syncing, tacion employs the metaphor of a **driver** (the presenter) and **passengers** (the audience). When the driver's device transitions to a new slide, he triggers an event on a **sync channel**. Passengers, viewing the presentation on their own devices, consume events on the sync channel, and transition to the same state as the driver.

Syncing allows a for a new, distributed type of presentation that can engage the audience in never-before seen ways. However, because not every implementation may call for syncing, its inclusion in each presentation is optional. To opt-in to syncing, one only need to define the "pusher" property in their `manifest.json` file. This property should provide a valid API key to the Pusher WebService.

So, what is Pusher? [Pusher is an online service](http://app.pusherapp.com) that makes it easy to add real-time communication to your web app. Pusher is [free to sign up](http://app.pusherapp.com/accounts/sign_up), and their free usage limits are pretty generous. Tacion uses Pusher to establish a "sync channel", all without forcing the implementor to host their own server.

Of course, integration with Pusher is arbitrary, and tacion will eventually support running your own socket server (if you so wish). 

Running The Sync Server
-----------------------
Assuming that you are the driver, you will need a mechanism to send messages to your passengers. Due to Pusher restrictions, the client API will only allow users to subscribe to events on the sync channel. In order to actually trigger these events, the driver needs to run a simple server to send events to the channel. Pusher enforces this restriction to ensure that arbitrary passengers can not hijack the presentation. To run the server, the driver need only run the packaged [nodejs](http://nodejs.org) server:

```sh
$> node src/server/tacion.js [app_id] [api_key] [api_secret]
```

You may also need to install the Pusher client, which you can do easily by installing the package:

```sh
$> npm install node-pusher
```

The [node-pusher package](https://github.com/crossbreeze/node-pusher) is maintained by [Jaewoong Kim](https://github.com/crossbreeze); it is not maintained as part of tacion.

The Slide Template File
-----------------------
Slide templates are simple html files that are used to wrap the content of each slide. Defining a template in your `manifest.json` file is not required, but doing so will allow the implementor to expose shared slide features. Here is an example page template, with comments to explait the different components.

```html
<!-- To work with jQuery mobile, templates should have one root element, with a "date-role" of "page"  -->
<div data-role="page">
	<!-- include a CSS file if you have styles that you would like to include across all slides -->
	<link rel="stylesheet" href="css/template.css">

	<!-- the same is true for a javascript, but make sure to include it as a link so that it is not executed! -->
	<link rel="script" href="js/page.js">

	<!-- if you want a header, include a div with a "data-role" of "header"; "data-id" and "data-position" fix the header  -->
	<!-- if you want to transition the header on sync, add a "data-sync-theme" to switch between -->
	<div data-id="header" data-role="header" data-position="fixed" data-sync-theme="b">

		<!-- if you would like to allow switching between manual and sync mode, add this div anywhere in your markup -->
		<div class="sync-control">
			<select class="sync" data-role="slider" data-theme="c" data-mini="true">
				<option value="off">Off</option>
				<option value="syncing">Sync</option>
			</select>
		</div>

		<-- The title of your presentation goes in the header -->
		<h1>My Presentation</h1>
	</div>

	<!-- if you want to support markup-based alerts, then add the following div -->
	<div class="alert ui-bar ui-bar-e">
		<a class="closer" data-role="button" data-icon="delete" data-iconpos="notext" data-corners="true"
		   data-shadow="true" data-iconshadow="true" data-inline="true" data-wrapperels="span" title="Dismiss"></a>
		<strong class="message"></strong>
	</div>

	<!-- wherever you put the content marker, slide content will be interpolated in! -->
	{{content}}

	<!-- much like the header, adding a div with "data-role" of footer will add a footer -->
	<div data-id="footer" data-role="footer" data-position="fixed">

		<!-- the "index" and "count" markers will be swapped out for the slide index and slide count, respectively -->
		<h1>{{index}} of {{count}}</h1>
	</div>
</div>
```

Slide Content Files
-------------------
Slide content files contain the main content of each slide in your presentation. The more slide content files you list in your `manifest.json` file, the more slides your presentation will have. Like the template file, slide content files can also declare assets. Here is an example content file:

```html
<!-- the top level div needs a "data-role" of "content"; also, give it a unique id -->
<div id="my-super-slide" data-role="content">
	<!-- like templates, slides can define their own CSS files relative to the presentation root -->
	<link rel="stylesheet" href="css/my-super-slide.css">
	<!-- slide templates can also declare their own JavaScript files -->
	<link rel="script" href="js/interactive.js">

	<!-- your slide content goes here! -->

	<h1>My Super Slide!</h1>
	<span>This slide is great because:</span>

	<ul>
		<!-- adding "data-step" to a node makes it a step in the slide -->
		<li data-step="1">It can declare its own assets</li>

		<!-- steps represent stops in the slide before transitioning to the next slide --> 
		<li data-step="2">It is cached in memory</li>

		<!-- in order to allow you to style steps, tacion only adds a class of "active" to steps as they are reached -->
		<li data-step="3">It let's you load jQuery mobile elements</li>

		<!-- if you want to use built-in step behaviors, give the node a class of step and a behavior class (e.g. opacity) -->
		<li class="step opacity" data-step="4">And they look sweet!</li>
	</ul>

</div>
``` 

The Public API
--------------
Tacion's public API was created to allow presenters to deeply integrate and extend
tacion's built-in functionality. Below, you will find a list of methods and their
associated documentation:

- `tacion.alert(message)` Displays a message to the user in an alert box. If an alert box is defined in the slide template or content, then that will be used over the native implementation
  - `message` `String|Boolean` The message to alert to the user. A booelan `false` value will close the alert.

```javascript
tacion.alert('Whoops! An error has occurred.');
```

- `tacion.change(step, slide, options)` Changes the slide (or step) by updating the URL hash
  - `step` `Number` The step to change to
  - `slide` `Number` The slide to change to
  - `options` `Object` Any options to override for the pending transition (optional)

```javascript
// go to the first step on the second slide, transition using the "flip" animation.
tacion.change(0, 1, {
	transition: 'flip'
});
```

- `tacion.next()` Transitions presentation to the next step, or slide

- `tacion.off(event, callback)` Removes an event handler from the API
  - `event` `String` The event to unbind
  - `callback` `Function` The event listener to remove

```javascript
// removes the "onupdate" handler from the "update" event 
tacion.off('update', onupdate);
```

- `tacion.on(event, callback(event, state))` Adds an event handler to the API
  - `event` `String` The event to bind the listener to
		- Currently, tacion only supports the `"update"` event, which is triggered after a slide or step transition.
  - `callback` `Function` The event listener to add, it receives the following parameters:
		- `event` `jQuery.Event` An event object describing the triggered event
		- `state` `Object` An object that provides accessors into the internal components.

```javascript
// adds a handler to the "update" event 
tacion.on('update', function(event, state){
	console.log(state.slide); // index of current slide
	console.log(state.step);  // index of current step
	console.log(state.page);  // jQuery element of the current slide
});
```

- `tacion.prev()` Transitions presentation to the previous step, or slide

- `tacion.spinner(msgText)` Shows or hides a loading message in the UI
  - `msgText` `String|Boolean` The text to show in the loading message, or false to hide it

```javascript
tacion.spinner('Loading Components');
```

- `tacion.start(folder)` Starts a presentation by loading its manifest and initializing the presentation.
  - `folder` `String` The folder that `manifest.json` lives in

```javascript
tacion.start('/my_presentation');
```

On the horizon
--------------
- Add interface for loader
- Vanity URLs
- Figure out CI for client code
- Add npm packaging?
- Add to site and cv
- Improve landing site (tac.io?)