//:module: primitives
//	:author:		infinte (aka. be5invis)
//	:info:			The Eisa Runtime

// The smallest Runtime environment for Lofn.
var Nai = function(){};
Nai.prototype = {
	constructor: undefined,
//	toString: undefined, // comment this line for debug.
	valueOf: undefined,
	hasOwnProperty: undefined,
	propertyIsEnumerable: undefined
};

var derive = Object.create ? Object.create : function(){
	var F = function(){};
	return function(obj){
		F.prototype = obj;
		return new F;
	}
}();

var EISA_OWNS = function(){
	var hop = {}.hasOwnProperty;
	return function(o,p){
		return hop.call(o,p)
	}
}();

var EISA_SLICE = function () {
	var s = Array.prototype.slice;
	return function (x, n) {
		return s.call(x, n);
	};
} ();
var EISA_UNIQ = function (arr) {
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

var EISA_M_TOP = function(){return this}();
var EISA_MINVOKE = function (p, s) {
	return p[s].apply(p,EISA_SLICE(arguments,2))
}
var EISA_IINVOKE = function (p, s) {
	return p.item(s).apply(p, EISA_SLICE(arguments,2))
}
var EISA_RMETHOD = function (l, r, m){
	return r[m](l)
}
var EISA_OBSTRUCT = function(x){
	return x;
}
var EISA_YIELDVALUE = function (a){
	this.value = a[0];
	this.values = a;
}
var EISA_RETURNVALUE = function (x){
	this.value = x
}
var EISA_WHILE = function(c, f){
	var r;
	while(c()){
		r = f()
	};
	return r;
}
var EISA_OBSTRUCTIVE = function(f){
	return {
		build: f
	}
}
var EISA_OBSTRUCTIVE_SCHEMATA_M = {
	'return': function(t, a, v){
		return v;
	}
}

var NamedArguments = function(){
	for(var i=arguments.length-2;i>=0;i-=2)
		this[arguments[i]]=arguments[i+1];
};
var EISA_NamedArguments = NamedArguments;
NamedArguments.prototype = {};
NamedArguments.fetch = function(o, p){
	if(EISA_OWNS(o, p)) return o[p]
}
NamedArguments.enumerate = function(o, f){	
	for(var each in o)
		if(EISA_OWNS(o, each))
			f.call(o[each], o[each], each);
}
NamedArguments.each = NamedArguments.enumerate;
NamedArguments.prototype.contains = function(name){
	return EISA_OWNS(this, name);
}
NamedArguments.prototype.toString = function(){
	return '[lfMRT NamedArguments]'
}
var EISA_CNARG = function(a){
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

// Essential ES5 prototype methods
if (!Array.prototype.map) {
	Array.prototype.map = function(fun /*, thisp */) {
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var res = new Array(len);
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in t)
				res[i] = fun.call(thisp, t[i], i, t);
		}

		return res;
	};
};
if (!Array.prototype.some){
	Array.prototype.some = function(fun /*, thisp */){
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var thisp = arguments[1];
		for (var i = 0; i < len; i++){
			if (i in t && fun.call(thisp, t[i], i, t))
				return true;
		}

		return false;
	};
}
if (!Array.prototype.reduceRight){
	Array.prototype.reduceRight = function(callbackfn /*, initialValue */){
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof callbackfn !== "function")
			throw new TypeError();

		// no value to return if no initial value, empty array
		if (len === 0 && arguments.length === 1)
			throw new TypeError();

		var k = len - 1;
		var accumulator;
		if (arguments.length >= 2){
			accumulator = arguments[1];
		} else {
			do {
				if (k in this){
					accumulator = this[k--];
					break;
				}

				// if array contains no values, no initial value to return
				if (--k < 0)
					throw new TypeError();
			} while (true);
		}

		while (k >= 0) {
			if (k in t)
				accumulator = callbackfn.call(undefined, accumulator, t[k], k, t);
			k--;
		}

		return accumulator;
	};
}
if (!Array.prototype.every)
{
	Array.prototype.every = function(fun /*, thisp */)
	{
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var thisp = arguments[1];
		for (var i = 0; i < len; i++)
		{
			if (i in t && !fun.call(thisp, t[i], i, t))
				return false;
		}

		return true;
	};
}
if (!Array.prototype.filter)
{
	Array.prototype.filter = function(fun /*, thisp */)
	{
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var res = [];
		var thisp = arguments[1];
		for (var i = 0; i < len; i++)
		{
			if (i in t)
			{
				var val = t[i]; // in case fun mutates this
				if (fun.call(thisp, val, i, t))
					res.push(val);
			}
		}

		return res;
	};
}
if (!Array.prototype.forEach)
{
	Array.prototype.forEach = function(fun /*, thisp */)
	{
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		var thisp = arguments[1];
		for (var i = 0; i < len; i++)
		{
			if (i in t)
				fun.call(thisp, t[i], i, t);
		}
	};
}

if (!Array.prototype.reduce)
{
	Array.prototype.reduce = function(fun /*, initialValue */)
	{
		"use strict";

		if (this === void 0 || this === null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function")
			throw new TypeError();

		// no value to return if no initial value and an empty array
		if (len == 0 && arguments.length == 1)
			throw new TypeError();

		var k = 0;
		var accumulator;
		if (arguments.length >= 2)
		{
			accumulator = arguments[1];
		}
		else
		{
			do
			{
				if (k in t)
				{
					accumulator = t[k++];
					break;
				}

				// if array contains no values, no initial value to return
				if (++k >= len)
					throw new TypeError();
			}
			while (true);
		}

		while (k < len)
		{
			if (k in t)
				accumulator = fun.call(undefined, accumulator, t[k], k, t);
			k++;
		}

		return accumulator;
	};
};



// Rule
var EISA_CREATERULE = function (l, r) {
	return new Rule(l, r);
}
var Rule = function (l, r) {
	this.left = l,
	this.right = r;
}
var EISA_Rule = Rule;
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



var EISA_eisa = {};
var eisa = EISA_eisa;
EISA_eisa.version = 'hoejuu';

EISA_eisa.log = function(message){};

var EISA_DEBUGTIME = false;

// lofn/dijbris library system.
"Essential library system", function(eisa){
	var libl = new Nai;
	var YES = {};
	var libraries = new Nai,
		obtained = new Nai;

	var lib_m = eisa.libary_m = {
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
		var xport = function(name, val){
			if(name instanceof EISA_NamedArguments){
				NamedArguments.enumerate(name, function(val, name){
					xport(name, val)
				});
			} else if (name instanceof EISA_Rule){
				xport(name.left, name.right)
			} else {
				traits.push(name);
				vals[name] = val;
			}
		}
		definition(xport);
		lib.identity = libname;
		return lib;
	}

	var acquire = function(name){
		if(obtained[name] !== YES)
			throw new Error("Eisa: Unable To Acquire Library \"" + name + '"');
		return obtained[name] === YES ? libraries[name] : null;
	};

	eisa.libmod = {
		acquire: acquire,
		library: function(){
			var a = [];
			for(var i = 0; i < arguments.length; i += 1)
				a[i] = acquire(arguments[i]);
			return eisa.squashLibs(a)
		}
	}
	eisa.dev = {
		lib: {
			define: define,
			register: register,
			fromObject: function(obj){
				var lib = derive(lib_m);
				var traits = [], vals = {};
				for(var each in obj)
					if(EISA_OWNS(obj, each)){
						traits.push(each);
						vals[each] = obj[each]
					};
				lib.enumerate = function(r){
					for(var i = 0; i < traits.length; i++)
						r(vals[traits[i]], traits[i]);
				};
				return lib;
			}
		},
		compileTime: false
	}
	register(eisa.dev.lib.fromObject(eisa.libmod), 'mod');
	register(eisa.dev.lib.fromObject(eisa.dev), 'dev');

	eisa.forLibraries = function(libs){
		return function(r, fl, compileTime){
			fl = fl || function(){};
			for(var i = 0; i<libs.length;i++){
				fl(libs[i]);
				libs[i].enumerate(r, compileTime);
			}
		}
	};
	eisa.squashLibs = function(libs){
		var squashed = {};
		eisa.forLibraries(libs)(function(v, n){ squashed[n] = v });
		return squashed;
	};

}(EISA_eisa);
