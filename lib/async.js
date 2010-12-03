//:module: lib/async
//	:author:		infinte (aka. be5invis)
//	:info:			perform essential asynchronous support with YIELD
var asynclib = function(){
	var Task = function(){};
	Task.prototype.start = function(){
		this.flow__();
	}
	Task.prototype.wait = function(T){
		if(T instanceof Task){
			T.ondone = this.flow__;
			T.start();
		}
	}
	Task.prototype.ondone = function(){};
	var async = function(G){
		return function(){
			var t = new Task;
			var yf = G.apply(t, arguments);
			t.flow__ = function(){
				var r = yf();
				if(!(r instanceof LF_YIELDVALUE)){
					t.ondone();
				};
				return r;
			};
			return t;
		}
	}

	var delay = function(f, time){
		var t = new Task;
		t.flow__ = function(){
			setTimeout(function(){
				f()
				t.ondone();
			}, time || 0);
		};
		return t;
	}

	var join = function(){
		var t = new Task;
		var args = arguments;
		var completed = 0;
		var len = args.length;
		t.flow__ = function(){
			for(var i = 0; i < len; i ++){
				args[i].ondone = function(){
					completed += 1;
					if(completed === len) t.ondone();
				};
				args[i].start();
			};
		};
		return t;
	}

	var asynclib = {
		async: async,
		delay: delay,
		sleep: function(time){
			return delay(function(){}, time)
		},
		join: join
	}
	asynclib.asynclib = asynclib;
	return asynclib
}()
