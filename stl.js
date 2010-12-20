//:module: lib:standard
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
	reg('YieldValue', {be: function(x){return x instanceof LF_YIELDVALUE}});
	reg('ReturnValue', {be: function(x){return x instanceof LF_RETURNVALUE}});

	reg('call', function(f){return f()});

	reg('enumerator', function(){
		var enumeratorSchemata = {
			'yield': function(t, a, g, restart){
				return new LF_YIELDVALUE(g);
			},
			'bypass': function(t, a, g, restart){
				return new LF_YIELDVALUE(g[0])
			}
		}
		return function(M){
			var G = M(enumeratorSchemata);
			return function(){
				var d = G.apply(this, arguments);
				var i = function(f){
					var v;
					while((v = d()) instanceof LF_YIELDVALUE)
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

	String.prototype.stripMargins = function(){
		return this.replace(/^\s*\|/gm, '')
	}

}));
