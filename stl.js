// Lofn standard linrary
Array.prototype.each = function (f) {
	for (var i = 0; i < this.length; i++) if (i in this) {
		DINVOKE(f, this, false, null, this[i], i);
	};
	return this;
};
var gEnvRec = new Nai;
var globalEnv = new Nai
var globalEnvPlc = new Nai;
globalEnv[''] = gEnvRec;
var reg = function(n,x){
	globalEnv[n] = gEnvRec;
	globalEnvPlc[n] = YES;
	gEnvRec[n] = x
}

reg('trace',trace)
reg('tracel',tracel);
reg('object', lofnize(function (t, a) {
	var obj = {};
	for (var i = 0; i < a.length; i++)
		if (a.names[i])
			obj[a.names[i]] = a[i];
	return obj;
}));
reg('try',lofnize(function (t, a) {
	try {
		DINVOKE(a.resolved[0], null, false,null);
	} catch (e) {
		if (a.resolved[1] instanceof Function) {
			DINVOKE(a.resolved[1], null, false,null,e);
		}
	} finally {
		if (a.resolved[2] instanceof Function) {
			DINVOKE(a.resolved[2], null, false,null);
		}
	}
}, ['try', 'catch', 'finally']));

// special hack
Date['new'] = function(){return new Date()};
Function['new'] = function(args,body){return new Function(args,body)};

reg('Rule',Rule);
reg('derive',derive);
reg('now',function(){return new Date()});
reg('Date',Date);
reg('itself',function(x){return x});
reg('cout', {
	shiftIn:function(item){trace(item);return this}
});
reg('endl', '\n');

/*Array.prototype.map = (Array.prototype.map ? function (h) {
	return function (f) {
		return h.call(this, function (item) {
			return DINVOKE(f, this, [item])
		})
	};
} (Array.prototype.map) : function () { });*/