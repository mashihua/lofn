//:module: primitives
//	:author:		infinte (aka. be5invis)
//	:info:			The smallest runtime for Lifn.

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
var LF_OWNS = function(){
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
var LF_UNIQ = function (arr) {
	var b = arr.slice(0).sort();
	if(b.length === 0) return [];
	var t = [b[0]], tn = 1;
	for (var i = 1; i < b.length; i++)
		if (b[i] && b[i] != b[i - 1])
			t[tn++] = b[i];
	return t;
}
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
var LF_YIELDVALUE_P = function (x){
	this.value = x[0];
	this.values = LF_SLICE(x, 0);
}
LF_YIELDVALUE_P.prototype = new LF_YIELDVALUE();
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
		if(LF_OWNS(_,each))
			f.call(_[each],_[each],each);
}
NamedArguments.prototype.contains = function(name){
	return LF_OWNS(this._, name);
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


// lofn/dijbris library system.
0, function(){
	var libl = new Nai;
	var YES = {};
	var libraries = new Nai,
		obtained = new Nai;

	var lib_m = lofn.libary_m = {
		enumerate: function(f){}
	}

	var register = function(lib, libname){
		var name = lib.identity || libname;
		obtained[name] = YES;
		libraries[name] = lib;
		return lib;
	};

	var stdlib_m = derive(lib_m);

	var define = function(libname, definition){
		if(arguments.length < 2) {
			return function(definition){
				return define(libname, definition)
			}
		}
		var lib = derive(stdlib_m);
		var traits = [];
		var vals = {};
		lib.enumerate = function(f){
			for(var i = 0; i < traits.length; i++)
				f(vals[traits[i]], traits[i]);
		};
		var export = function(name, val){
			if(name instanceof LF_NamedArguments){
				name.each(function(val, name){
					export(name, val)
				});
			} else if (name instanceof LF_Rule){
				export(name.left, name.right)
			} else {
				traits.push(name);
				vals[name] = val;
			}
		}
		definition(export);
		lib.identity = libname;
		return lib;
	}

	var acquire = function(name){
		return obtained[name] === YES ? libraries[name] : null;
	};

	lofn.libmod = {
		acquire: acquire
	}
	lofn.dev = {
		lib: {
			define: define,
			register: register,
			fromObject: function(obj){
				var lib = derive(lib_m);
				var traits = [], vals = {};
				for(var each in obj)
					if(LF_OWNS(obj, each)){
						traits.push(each);
						vals[each] = obj[each]
					};
				lib.enumerate = function(r){
					for(var i = 0; i < traits.length; i++)
						r(vals[traits[i]], traits[i]);
				};
				return lib;
			}
		}
	}
	register(lofn.dev.lib.fromObject(lofn.libmod), 'mod');
	register(lofn.dev.lib.fromObject(lofn.dev), 'dev');
}();

lofn.forLibraries = function(libs){
	return function(r, fl){
		fl = fl || function(){};
		for(var i = 0; i<libs.length;i++){
			fl(libs[i]);
			libs[i].enumerate(r);
		}
	}
};
lofn.squashLibs = function(libs){
	var squashed = {};
	lofn.forLibraries(libs)(function(v, n){ squashed[n] = v });
	return squashed;
}
