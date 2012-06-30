/*global tacion, Rainbow*/
(function(tacion, highlighter){

	"use strict";

	var files = {};
	function loadFile(path) {
		if (path in files) {
			return files[path];
		} else {
			return files[path] = $.ajax({
				url: path,
				dataType: 'text'
			});
		}
	}

	function indexOf(string, pattern, start) {
		start = start || 0;
		var regex = new RegExp(pattern);
		var index = string.substring(start).search(regex);
		return (index >= 0) ? (index + start) : index;
	}

	function parseCode(code, basename) {
		return function(text){
			var start = code.data('start');
			var end = code.data('end');
			var unindent = parseInt(code.data('unindent')||0, 10);
			var header = '// ' + basename;
			var length;
			if (start) {
				start = indexOf(text, start);
				start = start >= 0 ? start : 0;
			} else {
				start = 0;
			}
			if (end) {
				length = end.length;
				end = indexOf(text, end, start)-1;
			}
			if (end > start) {
				length += end - start;
			}
			text = text.substr(start, length);
			if (unindent > 0) {
				while (unindent--) {
					text = text.replace(/\t(\t*)/g, '$1');
				}
			}
			text = header + '\n\n' + text;
			highlighter.highlightBlock(code.text(text).get(0), '   ');
		};
	}

	function checkLoadFile(i, element) {
		var code = $(element);
		var file = code.data('file');
		if (file) {
			var basename = file.substr(file.lastIndexOf('/')+1);
			code.text('Loading ' + basename + '...');
			return loadFile(file).then(parseCode(code, basename));
		} else {
			highlighter.highlightBlock(code.get(0));
			return undefined;
		}
	}

	function checkForCode(event, data) {
		var code = data.page.find('code:not(.rainbow)');
		if (code.size()) {
			tacion.spinner('loading code...');
			var jobs = $.makeArray(code.map(checkLoadFile));
			$.when.apply($, jobs).then(function(){
				tacion.spinner(false);
			});
		}
	}

	tacion.on('update', checkForCode);

})(tacion, hljs);