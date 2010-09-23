// The smallest Runtime environment for Lofn.
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
var M_TOP = this;

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

var NamedArguments = function(){this._ = new Nai}
NamedArguments.prototype = {};
NamedArguments.prototype.item = function(p){return this._[p]}
NamedArguments.prototype.itemset = function(p, v){return this._[p] = v}
NamedArguments.prototype.each = function(f){
	var _ = this._;
	for(var each in _)
		if(OWNS(_,each))
			f.call(_[each],_[each],each);
}
var T_NAMES = function(){
	var o = new NamedArguments;
	for(var i=arguments.length-2;i>=0;i-=2)
		o._[arguments[i]]=arguments[i+1]
	return o;
}
var C_NARG = function(a){
	if(a instanceof NamedArguments)
		return a
	else
		return new NamedArguments
}


Object.prototype.item = function (i) {
	if('length' in this
			&&	(typeof this.length === 'number')
			&&	(this.length - 1) in this
			&&	(typeof i === 'number')
			&&	i < 0 
			) {
		// arraioid and negative indexing
		return this[this.length + (i|0)]
	}
	return this[i];
};
Object.prototype.itemset = function (i, v) {
	return this[i] = v;
};
Object.prototype.compareTo = function (b) {
	return a == b ? 0 : a > b ? 1 : -1;
};
Object.prototype.be = function (b) {
	return this === b
};
Object.prototype.contains = function (b) {
	return b in this;
};
ISARRAIOID = function(a){
	return 'length' in this && (typeof this.length === 'number') && (this["length"] - 1) in this
};

Object.prototype.each = function(f){
	var i, l;
	if(ISARRAIOID){
		// array like
		for(i = 0,l = this.length; i<l; i++){
			f.call(this[i],this[i],i)
		}
	} else {
		for(var each in this)
			if(OWNS(this,each))
				f.call(this[each],this[each],each);
	}
};
Array.prototype.each = function (f) {
	for (var i = 0; i < this.length; i++) {
		f.call(this[i], this[i], i)
	};
	return this;
};
String.prototype.each = function(f){
	for(var i = 0; i<this.length; i++){
		var ch = this.charAt(i);
		f.call(ch, ch, i)
	};
	return this;
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
RegExp.g = {
	convertFrom : function(s){return new RegExp(s, 'g')}
}


// Rule
var CREATERULE = function (l, r) {
	return new Rule(l, r);
}
var Rule = function (l, r) {
	this.left = l,
	this.right = r;
}
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
lofn.stl = new Nai;


lofn.Script = function(source, config, libraries){
	var tree = lofn.parse(lofn.lex(source));
	var specL = new Nai;
	var vm;
	var inita = function(libs){
		return function(r){
			for(var i = 0; i<libs.length;i++)
				for(var each in libs[i])
					if(OWNS(libs[i], each))
						r(each, libs[i][each])
		}
	}([lofn.stl].concat(libraries || [], [specL]));
	return {
		setGlobalVariable: function(name, value){specL[name] = value},
		compile: function(){
			this.setGlobalVariable = null;
			vm = lofn.VM(tree, inita, config || lofn.standardTransform); 
			return vm
		},
		start: function(){
			if(!vm) this.compile();
			vm.compiled.apply(null, arguments)
		}
	};
}
