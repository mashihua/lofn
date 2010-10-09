lofn.stl = new Nai;

0, function(){
	// Lofn standard linrary
	var reg = function (n, x) {
		lofn.stl[n] = x
	}

	0, function () {
		var output = G_TRACE('output');
		reg('trace', output.trace);
		reg('tracel', output.tracel);
		reg('cout', {
			shiftIn: function (item) { output.trace(item); return this }
		});
	} ();

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
}();
