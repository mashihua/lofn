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
var OWNS = function(){
	var hop = {}.hasOwnProperty;
	return function(o,p){
		return hop.call(o,p)
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
var SLICE = Array.prototype.slice;

var DINVOKE = function (pivot, shift, nameused, names) {
	return INVOKEP(pivot, shift, SLICE(arguments, 4), nameused, names);
}
var MINVOKE = function (p, s) {
	return p[s].apply(p,SLICE.call(arguments,2))
}
var IINVOKE = function (p, s) {
	return p.item(s).apply(p,SLICE.call(arguments,2))
}

var NAMEMETA = new Nai;
var T_NAMES = function(){
	var o = derive(NAMEMETA);
	for(var i=arguments.length-2;i>=0;i-=2)
		o[arguments[i]]=arguments[i+1]
	return o;
}
