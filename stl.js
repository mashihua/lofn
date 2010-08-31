// Lofn standard linrary
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
				DINVOKE(f, this, false, null, i);
			}
		} else {
			for (var i = this.left; i >= this.right; i--) {
				DINVOKE(f, this, false, null, i);
			}
		}
	}
}

Array.prototype.each = function (f) {
	for (var i = 0; i < this.length; i++) if (i in this) {
		DINVOKE(f, this, false, null, this[i], i);
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
reg('object', function(){
	return arguments[arguments.length-1]
});
reg('operators', {
	add: function(a,b){return a+b},
	minus:function(a,b){return a-b},
	times:function(a,b){return a*b},
	divide:function(a,b){return a/b}
});
reg('NamedArguments', NamedArguments);
