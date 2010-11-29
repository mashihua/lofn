// The smallest Runtime environment for Lofn.
var Nai = function(){};
Nai.prototype = {
	constructor: undefined,
//	toString: undefined, // comment this line for debug.
	valueOf: undefined,
	hasOwnProperty: undefined,
	propertyIsEnumerable: undefined
}

var derive = Object.create ? Object.create : function(){
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
var COPYSTRING = function(s,n){
	if(n <= 0) return '';
	if(n <= 1) return s;
	var t = COPYSTRING(s,n >>> 2);
	t = t + t;
	if(n % 2) t += s;
	return t;
}

var YES = {};
var NUSED = {};
var LF_SLICE = function () {
	var s = Array.prototype.slice;
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

var LF_M_TOP = function(){return this}();
var LF_MINVOKE = function (p, s) {
	return p[s].apply(p,LF_SLICE(arguments,2))
}
var LF_IINVOKE = function (p, s) {
	return p.item.apply(p, s).apply(p,LF_SLICE(arguments,2))
}
var LF_ITEMSET = function (p, s, v){
	return p.itemset.apply(p, [v].concat(s));
}
var LF_RMETHOD = function (l, r, m){
	return r[m](l)
}
var LF_YIELDVALUE = function (x){
	this.value = x;
	this.values = LF_SLICE(arguments, 0);
}
var LF_RETURNVALUE = function (x){
	this.value = x
}

var NamedArguments = function(){
	var _ = new Nai;
	for(var i=arguments.length-2;i>=0;i-=2)
		_[arguments[i]]=arguments[i+1];
	this._ = _;
};
var LF_NamedArguments = NamedArguments;
NamedArguments.prototype = {};
NamedArguments.prototype.item = function(p){return this._[p]}
NamedArguments.prototype.itemset = function(p, v){return this._[p] = v}
NamedArguments.prototype.each = function(f){
	var _ = this._;
	for(var each in _)
		if(OWNS(_,each))
			f.call(_[each],_[each],each);
}
NamedArguments.prototype.contains = function(name){
	return OWNS(this._, name);
}
NamedArguments.prototype.toString = function(){
	return '[lfMRT NamedArguments]'
}
var LF_CNARG = function(a){
	if(a instanceof NamedArguments)
		return a
	else
		return new NamedArguments
}


Object.prototype.item = function (i) {
	return this[i];
};
Object.prototype.itemset = function (i, v) {
	return this[i] = v;
};
Object.prototype.compareTo = function (b) {
	return this == b ? 0 : this > b ? 1 : -1;
};
Object.prototype.be = function (b) {
	return this === b
};
Object.prototype.contains = function (b) {
	return b in this;
};
Object.prototype.of = function(v){
	return v[this];
}
Function.prototype.be = function (b) {
	return b instanceof this;
};

Function.prototype['new'] = function () {
	var obj = derive(this.prototype);
	this.apply(obj, arguments);
	return obj;
};
Function.prototype.be = function(that){
	return that instanceof this;
}
String.be = function(s){
	return (typeof(s) === 'string') || s instanceof this
}
Number.be = function(s){
	return (typeof(s) === 'string') || s instanceof this
}
Boolean.be = function(s){
	return (typeof(s) === 'string') || s instanceof this
}
RegExp.convertFrom = function(s){
	return new RegExp(s);
}

// Rule
var LF_CREATERULE = function (l, r) {
	return new Rule(l, r);
}
var Rule = function (l, r) {
	this.left = l,
	this.right = r;
}
var LF_Rule = Rule;
Rule.prototype.reverse = function () {
	return new Rule(this.right, this.left);
}
Rule.prototype.toString = function () {
	return this.left + ' -> ' + this.right;
}
Rule.prototype.each = function (f) {
	if (typeof this.left === 'number' && typeof this.right === 'number') {
		if (this.left <= this.right) {
			for (var i = this.left; i <= this.right; i++) {
				f.call(this, i);
			}
		} else {
			for (var i = this.left; i >= this.right; i--) {
				f.call(this, i);
			}
		}
	}
}


var lofn = {};
lofn.version = 'hoejuu';
