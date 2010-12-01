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

	return {
		async: async,
		delay: delay
	}
}()
