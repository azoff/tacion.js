(function($){

	"use strict";

	function getframe() {
		return parseInt(slider.val(), 10);
	}

	function update() {
		var value = getframe();
		var index = 8;
		while (index--) {
			megaman.toggleClass('frame-' + index, index <= value);
		}
	}

	function frame() {
		if (loop.run) {
			var value = getframe()+1;
			slider.val(value < 8 ? value : 0);
			slider.slider('refresh');
			setTimeout(frame, 1000/18);
		}
	}

	function loop() {
		var on = button.prop('checked');
		if (on && !loop.run) {
			loop.run = true;
			frame();
		} else {
			loop.run = false;
		}
	}

	var container = $('#interactive');
	var slider = container.find('#frame-index').change(update);
	var button = container.find('#frame-index-loop').change(loop);
	var megaman = container.find('.megaman');

})(jQuery);