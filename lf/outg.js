var G_TRACE = function (element) {
	var _output = document.getElementById(element);
	function trace(x) {
		var s = '';
		for (var i = 0; i < arguments.length; i++) s += arguments[i];
		_output.appendChild(document.createTextNode(s));
		return arguments[arguments.length - 1];
	};
	function tracel() {
		var v = trace.apply(this, arguments);
		trace('\n');
		return v;
	};
	return {
		trace: trace,
		tracel: tracel,
		clrscr: clrscr
	}
}
var clrscr = function () {
	document.getElementById('output').innerHTML = '';
}

