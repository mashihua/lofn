// Lofn standard linrary
Array.prototype.each = function (f) {
	for (var i = 0; i < this.length; i++) {
		f.call(this[i],this[i],i)
	};
	return this;
};
var global = new Nai;
var reg = function(n,x){
	global[n] = x
}

0, function(){
	var output = G_TRACE('output');
	reg('trace',output.trace);
	reg('tracel',output.tracel);
	reg('cout', {
		shiftIn:function(item){output.trace(item);return this}
	});
}();

// special hack
Date['new'] = function(){return new Date()};
Function['new'] = function(args,body){return new Function(args,body)};

reg('Rule',Rule);
reg('derive',derive);
reg('now',function(){return new Date()});
reg('Date',Date);
reg('itself',function(x){return x});
reg('endl', '\n');

reg('Function', Function);
reg('String', String);
reg('Regex', RegExp);
reg('operator', {
	add: function(a,b){return a+b},
	minus:function(a,b){return a-b},
	times:function(a,b){return a*b},
	divide:function(a,b){return a/b},
	shl:function(a,n){return a << n},
	shr:function(a,n){return a >> n},
	shrf:function(a,n){return a >>> n}
});
reg('strcpy', COPYSTRING);
reg('NamedArguments', NamedArguments);
reg('tee', function(x,f){
	f(x);
	return x
});
