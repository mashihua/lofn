//:module: lib:standard
//	:author:		infinte (aka. be5invis)
//	:info:			The standard library for Lofn.
eisa.stl = eisa.dev.lib.register(eisa.dev.lib.define('std', function(reg){

	// special hack
	Date['new'] = function () { return new Date() };
	Function['new'] = function (args, body) { return new Function(args, body) };

	reg('Rule', Rule);
	reg('derive', derive);
	reg('composing', function(obj_){
		var obj = derive(obj_);
		for(var i = 1; i < arguments.length; i++){
			if(arguments[i] instanceof EISA_Rule)
				obj[arguments[i].left] = arguments[i].right;
			else if (arguments[i] instanceof EISA_NamedArguments)
				NamedArguments.each(arguments[i], function(val, prop){
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
	reg('Math', Math);
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
	reg('YieldValue', {be: function(x){return x instanceof EISA_YIELDVALUE}});
	reg('ReturnValue', {be: function(x){return x instanceof EISA_RETURNVALUE}});

	reg('call', function(f){return f()});

	reg('enumerator', function(){
		var enumeratorSchemata = {
			'yield': function(t, a, g, restart){
				return new EISA_YIELDVALUE(g);
			},
			'bypass': function(t, a, g, restart){
				return new EISA_YIELDVALUE(g[0])
			}
		}
		return function(M){
			var G = M.build(enumeratorSchemata);
			return function(){
				var d = G.apply(this, arguments);
				var i = function(f){
					var v;
					while((v = d()) instanceof EISA_YIELDVALUE)
						f.apply(null, v.values)			
				}
				var r = function(f){
					if(f instanceof Function){
						return (r = i)(f)
					} else {
						return (r = d)();
					}
				}
				return function(f){return r(f)}
			}
		}
	}());

	reg('debugger', function(){debugger});

	reg('spawn', function(f){
		var o = {}
		var r = f.call(o);
		return r || o;
	});


	String.prototype.stripMargins = function(){
		return this.replace(/^\s*\|/gm, '')
	};

	Function.prototype.shiftIn = function(g){
		var f = this;
		return function(){
			return f(g.apply(this, arguments))
		}
	}

}));
