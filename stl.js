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
	reg('composing', function(obj_, na){
		var obj = derive(obj_);
		na.each(function(item, prop){
			obj[prop] = item
		});
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
