(function(tacion, highlighter){

	"use strict";

	function checkLoadFile() {
		var code = $(this);
		var file = code.data('file');
		if (file) {
			return $.get(file).then(function(text){
				code.text(text);
				highlighter.color(code);
			});
		} else {
			highlighter.color(code);
			return undefined;
		}
	}

	function checkForCode(event, data) {
		var code = data.slide.find('code:not(.rainbow)');
		if (code.size()) {
			tacion.spinner('loading code...');
			var jobs = $.makeArray(code.map(checkLoadFile));
			$.when.apply($, jobs).then(function(){
				tacion.spinner(false);
			});
		}
	}

	tacion.on('update', checkForCode);

})(window.tacion, Rainbow);