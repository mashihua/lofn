//:module: lib/async
//	:author:		infinte (aka. be5invis)
//	:info:			perform essential asynchronous support with YIELD
lofn.dev.lib.register(lofn.dev.lib.define('async', function(xport){
	var Task_P = function(f){
		if(!(f instanceof Function)) f = function(){};
		this.start = function(){
			f.call(this)
		}
	};
	Task_P.prototype.wait = function(T, f){
		var that = this;
		if(!f instanceof Function) f = function(x){this.sent = x};
		if(T instanceof Task_P){
			T.resend = function(x){
				f(x);
				that.start();
			}
			T.start();
		}
	}
	Task_P.prototype.resend = function(){};

	var async = function(G){
		return function(){
			var yf;
			var t = new Task_P(function(){
				var r = yf();
				if(!(r instanceof LF_YIELDVALUE)){
					t.resend();
				};
				return r;
			});
			yf = G.apply(t, arguments);
			return t;
		}
	}

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
				args[i].start();
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
		this.start = function(){ 
			var ret = f.call(this);
			this.resend();
			return ret;
		};
	}
	Task.prototype = new Task_P();
	Task.prototype.start = function(){};
	Task.prototype.then = function(f){
		var that = this;
		return new Task(function(){
			that.start();
			var ret = f.call(this);
			this.resend();
			return ret;
		})
	}

	xport('async', async);
	xport('delay', delay);
	xport('Task', Task);
	xport('join', join);
	xport('sleep', function(time){return delay(function(){}, time)});
	xport('event', evt);
}));
