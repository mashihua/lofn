//:module: lib/async
//	:author:		infinte (aka. be5invis)
//	:info:			perform essential asynchronous support with YIELD
lofn.dev.lib.register(lofn.dev.lib.define('async', function(xport){
	var Task_P = function(f){
		if(!(f instanceof Function)) f = function(){};
		this.resume = function(){
			f.call(this)
		}
	};
	Task_P.prototype.wait = function(T, f){
	}
	Task_P.prototype.resend = function(){};

	var asyncSchemata = {
		wait: function(thisp, argsp, given, restart){
			var T = given[0];
			var thatresend = T.resend;
			if(T instanceof Task_P){
				T.resend = function(x){
					T.resend = thatresend;
					restart(x);
				}
				T.resume();
			}

		}
	}
	var async = function(){
		return function(G){
			return function(){
				var yf;
				var t = new Task_P(function(){
					var r = yf();
					if(!(r instanceof LF_YIELDVALUE)){
						t.resend();
					};
					return r;
				});
				yf = G(asyncSchemata).apply(t, arguments);
				return t;
			}
		}
	}()

	var delay = function(f, time){
		var t = new Task_P(function(){
			setTimeout(function(){
				var r = f();
				t.resend(r);
			}, time || 0);
		});
		return t;
	}

	var join = function(){
		var args = arguments;
		var completed = 0;
		var len = args.length;
		var t = new Task_P(function(){
			for(var i = 0; i < len; i ++){
				args[i].resend = function(){
					completed += 1;
					if(completed === len) t.resend();
				};
				args[i].resume();
			};
		});
		return t;
	}

	var evt = function(what){
		return {
			'of' : function(object){
				var f = function(){ object.removeEventListener(what, f, false); t.resend() };
				var t = new Task_P(function(){
					object.addEventListener(what, f, false);
				});
				return t;
			}
		}
	}

	var Task = function(f){
		this.resume = function(){ 
			var ret = f.call(this);
			this.resend();
			return ret;
		};
	}
	Task.prototype = new Task_P();
	Task.prototype.resume = function(){};
	Task.prototype.then = function(f){
		var that = this;
		return new Task(function(){
			that.resume();
			var ret = f.call(this);
			this.resend();
			return ret;
		})
	}
	
	var Timer = function(interval, period){
		var t = derive(Task.prototype);
		var running = false;
		var tid;
		t.resume = function(){
			var resume = new Date();
			if(!running){
				tid = setInterval(function(){
					var delta = new Date() - resume;
					t.resend(delta / period);
				}, interval);
				running = true;
			}
		};
		t.stop = function(){
			clearInterval(tid);
			running = false;
		};
		return t;
	}

	xport('async', async);
	xport('delay', delay);
	xport('Task', Task);
	xport('join', join);
	xport('sleep', function(time){return delay(function(){}, time)});
	xport('event', evt);
	xport('Timer', Timer);
}));
