﻿//:module: lib:standard
//	:author:		infinte (aka. be5invis)
//	:info:			The standard library for Lofn.
lofn.stl = lofn.dev.lib.register(lofn.dev.lib.define('std', function(reg){
	// special hack
	Date['new'] = function () { return new Date() };
	Function['new'] = function (args, body) { return new Function(args, body) };

	reg('Rule', Rule);
	reg('derive', derive);
	reg('composing', function(obj_){
		var obj = derive(obj_);
		for(var i = 1; i < arguments.length; i++){
			if(arguments[i] instanceof LF_Rule)
				obj[arguments[i].left] = arguments[i].right;
			else if (arguments[i] instanceof LF_NamedArguments)
				arguments[i].each(function(val, prop){
					obj[prop] = val
				});
			else {
				for(var each in arguments[i])
					if(OWNS(arguments[i], each))
						obj[each] = arguments[i][each];
			}
		}
		return obj;
	});
	reg('endl', '\n');

	reg('Object', Object);
	reg('Number', Number);
	reg('Boolean', Boolean);
	reg('Array', Array);
	reg('Function', Function);
	reg('String', String);
	reg('RegExp', function(){
		var R = function(){
			return RegExp.apply(this, arguments)
		}
		R.prototype = RegExp;
		R.convertFrom = function(s){
			return RegExp(s)
		};
		
		var rType = function(options){
			R[options] = function(s){
				return RegExp(s, options)
			};
			R[options].convertFrom = function(s){
				return RegExp(s, options)
			}
		}

		rType('g');
		rType('i');
		rType('m');
		rType('gi');
		rType('gm');
		rType('im');
		rType('gim');

		return R;
	}());
	reg('Date', Date);
	reg('now', function(){ return new Date() });
	
	reg('operator', {
		add: function (a, b) { return a + b },
		minus: function (a, b) { return a - b },
		times: function (a, b) { return a * b },
		divide: function (a, b) { return a / b },
		shl: function (a, n) { return a << n },
		shr: function (a, n) { return a >> n },
		shrf: function (a, n) { return a >>> n }
	});
	
	reg('NamedArguments', NamedArguments);

	reg('tee', function (x, f) {
		f(x);
		return x
	});

	reg('type', { of : function(x){return typeof x} });
	reg('present', { be : function(x){return x !== undefined && x !== null}});
	reg('absent', { be : function(x){return x === undefined || x === null }});
	reg('YieldValue', {be: function(x){return x instanceof LF_YIELDVALUE}});
	reg('ReturnValue', {be: function(x){return x instanceof LF_RETURNVALUE}});

	reg('call', function(f){return f()});


	Array.prototype.each = function(){
		/* Generated by LFC */
		var _$$_I = function(___$FUN){
			var _$T_ = (this === LF_M_TOP ? null : this);
			var _$A_ARGS_ = arguments;
			var ___$PROGRESS = 1;
			var ___$EOF= false;
			var _$$_len, _$$_i;
			return function (___$FUN) {
				var ___$ISFUN = typeof ___$FUN === "function";
				while (___$PROGRESS) {
				MASTERCTRL:
					switch (___$PROGRESS) {
					  case 1:
						_$$_len = _$T_.length;
						_$$_i = 0;
					  case 2:
						if (!(_$$_i < _$$_len)) {
							___$PROGRESS = 3;
							break MASTERCTRL;
						}
						// yield this[i], i
						if (___$ISFUN) {
							___$FUN(_$T_[_$$_i], _$$_i);
						} else {
							___$PROGRESS = 4;
							return new LF_YIELDVALUE(_$T_[_$$_i], _$$_i);
						}
					  case 4:
						_$$_i = _$$_i + 1;
						___$PROGRESS = 2;
						break MASTERCTRL;
					  case 3:
						___$PROGRESS = 0;
						___$EOF = true;
						return;
					  default: 
					}
				}
			}
		};
		return function(f){
			if (typeof(f) === 'function'){
				return _$$_I.call(this)(f);
			} else {
				return _$$_I.call(this);
			};
		};
	}();
	
	String.prototype.eachLine = function(){
		return Array.prototype.each.apply(this.split('\n'), arguments)
	};

	Function.prototype.shiftIn = function(g){
		var f = this;
		return function(){
			return f(g.apply(this, arguments))
		}
	};
}));
