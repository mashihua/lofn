var Nai = function(){};
Nai.prototype = {
	constructor: undefined,
//	toString: undefined, // comment this line for debug.
	valueOf: undefined,
	hasOwnProperty: undefined
}

var derive = function(){
	var F = function(){};
	return function(obj){
		F.prototype = obj;
		return new F;
	}
}();

var YES = {};
var NUSED = {};
var SLICE = function () {
	var s = [].slice;
	return function (x, n) {
		return s.call(x, n);
	};
} ();
var NARG = function () {
	var o = new Nai, i = 0, argn = arguments.length;
	for (; i < argn; i += 2) {
		o[arguments[i]] = arguments[i + 1];
	}
	return o;
}

var noth = void 0;

var Lofn = {};
