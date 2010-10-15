// The backend.

0, function () {
	var TO_ENCCD = function (name) {
		return name.replace(/[^a-zA-Z0-9_]/g, function (m) {
			return '$' + m.charCodeAt(0).toString(36) + '$'
		});
	};
	var nt = lofn.NodeType;

	var config, vmSchemata = [],
		schemata = function (tf, trans) {
			vmSchemata[tf] = trans;
		};

	var C_NAME
	var C_LABELNAME
	var T_THIS
	var T_ARGN
	var BEFORE_BLOCK
	var AFTER_BLOCK
	var JOIN_STMTS
	var THIS_BIND
	var C_TEMP

	var CTRLCHR = function (c) {
		var n = c.charCodeAt(0);
		return '\\x' + (n > 15 ? n.toString(16) : '0' + n.toString(16));
	}
	var strize = function (s) {
		return '"' + (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\x00-\x1f\x7f]/g, CTRLCHR) + '"';
	};

	var GETV = function (node, env) {
		return C_NAME(node.name);
	}
	var SETV = function (node, val, env) {
		var depth = env.useVar(node.name)
		return C_NAME(node.name) + '=' + val;
	}
	schemata(nt.SCRIPT, function (n) {
		var a = [];
		for (var i = 0; i < n.content.length; i++)
		if (n.content[i]) {
			a[i] = transform(n.content[i]);
		}
		var joined = JOIN_STMTS(a)
		return joined;
	});
	schemata(nt['='], function (n, env) {
		switch (this.left.type) {
		case nt.ITEM:
			return '(' + transform(this.left.left) + '.itemset(' + transform(this.left.item) + ',' + transform(this.right) + '))';
		case nt.MEMBER:
			return '((' + transform(this.left.left) + ')[' + strize(this.left.right.name) + ']=' + transform(this.right) + ')';
		case nt.MEMBERREFLECT:
			return '((' + transform(this.left.left) + ')[' + transform(this.left.right) + ']=' + transform(this.right) + ')';
		case nt.VARIABLE:
			return SETV(this.left, transform(this.right), env);
		default:
			throw new Error('Invalid assignment left value: only VARIABLE, MEMBER, MEMBERREFLECT or ITEM avaliable');
		}
	});
	var SPECIALNAMES = {"break":1,
"continue":1,"do":1,
"for":1,"import":1,
"new":1,"this":1,
"void":1,"case":1,
"default":1,"else":1,
"function":1,"in":1,
"return":1,"typeof":1,
"while":1,"comment":1,
"delete":1,"export":1,
"if":1,"label":1,
"switch":1,"var":1,
"with":1,"abstract":1,
"implements":1,"protected":1,
"boolean":1,"instanceOf":1,
"public":1,"byte":1,
"int":1,"short":1,
"char":1,"interface":1,
"static":1,"double":1,
"long":1,"synchronized":1,
"false":1,"native":1,
"throws":1,"final":1,
"null":1,"transient":1,
"float":1,"package":1,
"true":1,"goto":1,
"private":1,"catch":1,
"enum":1,"throw":1,
"class":1,"extends":1,
"try":1,"const":1,
"finally":1,"debugger":1,
"super":1
};
	schemata(nt.MEMBER, function () {
		var memberName = this.right.name;
		if (SPECIALNAMES[memberName] === 1) return '(' + transform(this.left) + ')["' + memberName + '"]';
		return '(' + transform(this.left) + ').' + memberName;
	});
	schemata(nt.MEMBERREFLECT, function () {
		var memberName = this.right.name;
		return '(' + transform(this.left) + ')[' + transform(this.right) + ']';
	});
	schemata(nt.SHARP, function(n, env){
		if(this.id >= env.parameters.names.length){
			return C_TEMP('IARG' + this.id);
		}
		return C_NAME(env.parameters.names[this.id]);
	});
	schemata(nt.ITEM, function () {
		return '(' + transform(this.left) + ').item(' + transform(this.item) + ')';
	});
	schemata(nt.VARIABLE, function (n, env) {
		return GETV(n, env);
	});
	schemata(nt.GROUP, function(n, env){
		env.grDepth += 1;
		var r = '('+transform(this.operand)+')';
		env.grDepth -= 1;
		return r;
	});
	schemata(nt.THIS, function (nd, e) {
		var n = e;
		while (n.rebindThis) n = n.upper;
		n.thisOccurs = true;
		return T_THIS(e);
	});
	schemata(nt.ARGN, function (nd, e){
		e.argnOccurs = true;
		return T_ARGN();
	});
	schemata(nt.ARGUMENTS, function () {
		return 'arguments';
	});
	schemata(nt.CALLEE, function () {
		return '(arguments.callee)';
	});
	schemata(nt.PARAMETERS, function () {
		throw new Error('Unexpected parameter group');
	});
	schemata(nt.CALL, function (n, env) {
		var comp;
		switch (this.func.type) {
		case nt.MEMBER: case nt.MEMBERREFLECT:
			comp = transform(this.func) + '(';
			break;
		case nt.ITEM:
			comp = 'LF_IINVOKE(' + transform(this.func.left) + ',' + transform(this.func.item) + ',';
			break;
		default:
			comp = transform(this.func) + '(';
		};
		var args = [],
			names = [];
		for (var i = 0; i < this.args.length; i++) {
			if (this.names[i]) {
				names.push(strize(this.names[i]), transform(this.args[i]));
			} else args.push(transform(this.args[i]));
		}
		if (this.pipeline) {
			env.useTemp('PIPE', env.grDepth);
			var arg0 = args[0];
			args[0] = C_TEMP('PIPE'+env.grDepth);
			comp =  C_TEMP('PIPE'+env.grDepth) + '=' + arg0 + ',' + comp;
		};
		comp += args.join(',');
		if (this.nameused) comp += (args.length ? ',' : '') + 'LF_TNAMES(' + names.join(',') + ')';
		comp += ')'
		return '(' + comp + ')';
	});
	schemata(nt.OBJECT, function () {
		var comp = '{';
		var inits = [],
			x = 0;
		for (var i = 0; i < this.args.length; i++) {
			if (this.names[i]) {
				inits.push(strize(this.names[i]) + ':' + transform(this.args[i]));
			} else {
				inits.push(strize('' + x) + ':' + transform(this.args[i]));
				x++;
			}
		}
		comp += inits.join(',');
		comp += '}'
		return '(' + comp + ')';
	});
	schemata(nt.ARRAY, function () {
		var comp = '(',
			args = [],
			names = [];
		for (var i = 0; i < this.args.length; i++) {
			args[i] = transform(this.args[i]);
		};
		comp += '[' + args.join(',') + '])';
		return comp;
	});
	schemata(nt.LITERAL, function () {
		if (typeof this.value === 'string') {
			return strize(this.value);
		} else if (typeof this.value === 'number'){
			return '(' + this.value + ')';	
		} else return '' + this.value;
	});

	var binoper = function (operator, tfoper) {
		schemata(nt[operator], function () {
			return transform(this.left) + tfoper + transform(this.right);
		});
	};
	var methodoper = function (operator, method) {
		schemata(nt[operator], function () {
			return '(' + transform(this.right) + ').' + method + '(' + transform(this.left) + ')'
		});
	};
	var lmethodoper = function (operator, method) {
		schemata(nt[operator], function () {
			return '(' + transform(this.left) + ').' + method + '(' + transform(this.right) + ')';
		});
	};

	binoper('+', '+');
	binoper('-', '-');
	binoper('*', '*');
	binoper('/', '/');
	binoper('%', '%');
	binoper('<', '<');
	binoper('>', '>');
	binoper('<=', '<=');
	binoper('>=', '>=');
	binoper('==', '===');
	binoper('=~', '==');
	binoper('===', '===');
	binoper('!==', '!==');
	binoper('!=', '!==');
	binoper('!~', '!=');
	binoper('and', '&&');
	binoper('or', '||');
	methodoper('in', 'contains');
	methodoper('is', 'be');
	methodoper('as', 'convertFrom');
	methodoper('>>', 'acceptShiftIn');
	lmethodoper('<=>', 'compareTo');
	lmethodoper('<<', 'shiftIn');

	schemata(nt['->'], function () {
		return 'LF_CREATERULE(' + transform(this.left) + ',' + transform(this.right) + ')';
	});
	schemata(nt.NEGATIVE, function () {
		return '(-(' + transform(this.operand) + '))';
	});
	schemata(nt.NOT, function () {
		return '(!(' + transform(this.operand) + '))';
	});

	schemata(nt.DO, function(nd, e){
		var n = e;
		while (n.rebindThis) n = n.upper;
		n.thisOccurs = true;
		return '(('+transform(this.operand)+').apply('+T_THIS(e)+', arguments))';
	});

	schemata(nt.FUNCTION, function () {
		var _e = env,
			f = this.tree;
		var s = compileFunctionBody(f);
		var pars = f.parameters.names.slice(0), temppars = f.listParTemp();
		for (var i = 0; i < pars.length; i++)
			pars[i] = C_NAME(pars[i])
		for (var i = 0; i < temppars.length; i++)
			temppars[i] = C_TEMP(temppars[i])
		s = 'function(' + pars.concat(temppars).join(',') + '){\n' + s + '\n}';

		env = _e;
		return s;
	});

	schemata(nt.RETURN, function () {
		return 'return ' + transform(this.expression);
	});
	schemata(nt.THROW, function () {
		return 'throw ' + transform(this.expression);
	});
	schemata(nt.IF, function () {
		var s = 'if (' + transform(this.condition) + '){\n';
		s += transform(this.thenPart);
		if (this.elsePart) {
			s += ('} else {') + transform(this.elsePart) + ('}');
		} else {
			s += ('}')
		}
		return s;
	});
	schemata(nt.PIECEWISE, function () {
		var a = [];
		cond = '';
		for (var i = 0; i < this.conditions.length; i++) {
			if (!this.bodies[i]) { // fallthrough condition
				cond += '(' + transform(this.conditions[i]) + ') || ';
			} else {
				cond += '(' + transform(this.conditions[i]) + ')';
				a.push('if (' + cond + '){\n' + transform(this.bodies[i]) + '\n}');
				cond = '';
			}
		}

		var s = a.join(' else ');
		if (this.otherwise) {
			s += ' else {\n' + transform(this.otherwise) + '\n}';
		}

		return s;
	});

	schemata(nt.CASE, function () {
		var s = 'switch (' + transform(this.expression) + '){';
		for (var i = 0; i < this.conditions.length; i++) {
			s += '\ncase ' + transform(this.conditions[i]) + ' :'
			if (this.bodies[i]) {
				s += '{\n' + transform(this.bodies[i]);
				if (!this.fallThrough) s += ';\nbreak; \n}';
				else s += '\n }'
			}
		}

		if (this.otherwise) {
			s += '\ndefault:{\n' + transform(this.otherwise) + '\n}';
		}
		s += '\n}';
		return s;
	});
	schemata(nt.REPEAT, function () {
		return 'do{\n' + transform(this.body) + '\n} while(!(' + transform(this.condition) + '))';
	});
	schemata(nt.WHILE, function () {
		return 'while(' + transform(this.condition) + '){\n' + transform(this.body) + '\n}';
	});
	schemata(nt.FOR, function () {
		var s = 'for(';
		if (this.start) {
			s += transform(this.start);
		};
		s += ';' + transform(this.condition);
		s += ';';
		if (this.step) {
			s += transform(this.step);
		};

		s += '){\n' + transform(this.body) + '\n}';
		return s;
	});
	schemata(nt.BREAK, function () {
		return 'break ' + (this.destination ? C_LABELNAME(this.destination) : '');
	});
	schemata(nt.LABEL, function () {
		return C_LABELNAME(this.name) + ':{' + transform(this.body) + '}';
	});
	schemata(nt.TRY, function(n, e){
		var s = 'try {' + transform(this.trystmts) + '}';
		if(this.catchvar){
			s += 'catch('+C_NAME(this.catchvar.name)+'){'+transform(this.catchstmts)+'};'
		} else {
			s += 'catch(___$EXCEPTION){}'
		}
		return s;
	});

	var env;
	var transform = function (node) {
		if (vmSchemata[node.type]) {
			return vmSchemata[node.type].call(node, node, env);
		} else {
			return '{!UNKNOWN}';
		}
	}
	var compileFunctionBody = function (tree, hook_enter, hook_exit) {
		if (tree.transformed) return tree.transformed;
		env = tree;
		var s;
		// SEF processing
		s = transform(tree.code);
		var locals = tree.locals,
			vars = [],
			temps = tree.listTemp();
		for (var i = 0; i < locals.length; i++)
			if (!(tree.varIsArg[locals[i]])) vars.push(C_NAME(locals[i]));
		for (var i = 0; i < temps.length; i++)
			temps[i] = C_TEMP(temps[i]);

		s = JOIN_STMTS(['var ___$EXCEPTION' + (temps.length ? ',' + temps.join(','): ''), THIS_BIND(tree), ARGN_BIND(tree), (vars.length ? 'var ' + vars.join(', ') : '')]) 
			+ (hook_enter || '') 
			+ s 
			+ (hook_exit || '');

		tree.transformed = s;
		return s;
	};

	var bindConfig = function (vmConfig) {
		config = vmConfig;
		C_NAME = config.varName;
		C_LABELNAME = config.label;
		T_THIS = config.thisName;
		JOIN_STMTS = config.joinStatements;
		THIS_BIND = config.thisBind;
		ARGN_BIND = config.argnBind;
		T_ARGN = config.argnName;
		C_TEMP = config.tempName;
	};
	// Default Lofn compilation config
	lofn.standardTransform = function () {
		var _indent = 0,
			c;
		return c = {
			varName: function (name) {
				return '_$$_' + TO_ENCCD(name)
			},
			label: function (name) {
				return '_$L_' + TO_ENCCD(name)
			},
			tempName: function (type){
				return '___$' + type
			},
			thisName: function (env) {
				return '_$T_'
			},
			argnName: function(){
				return '_$A_ARGN_'
			},
			thisBind: function (env) {
				return (!env.thisOccurs || env.rebindThis) ? '' : 'var _$T_ = (this === LF_M_TOP ? null : this)'
			},
			argnBind: function (env) {
				return env.argnOccurs ? 'var _$A_ARGN_ = LF_CNARG(arguments[arguments.length - 1])' : ''
			},
			joinStatements: function (statements) {
				return statements.join(';\n') + ';\n';
			},
			initGVM: {
				globally: function(){return 'var ' + c.varName('__global__') + ' = ' + c.thisName()+ ';\n'},
				itemly: function(env, initFunction, aSrc, initv){
					initFunction(function(n, v){
						initv[n] = v;
						env.newVar(n, true);
						aSrc.push('var ' + c.varName(n) + '=(' + c.varName('__global__') + '[' + strize(n) + ']);');
					});
				}
			},
			dumpGVM: function(initFunction){
				var aSrc = [];
				initFunction(function(n, v){
					aSrc.push(c.varName('__global__') + '[' + strize(n) + '] = ' + c.varName(n)+';');
				});	
				return aSrc;
			}
		}
	}();
	//============
	lofn.Compiler = function (tree, inital, vmConfig) {
		bindConfig(vmConfig);
		var inits = [], initv = new Nai, enter = tree[0];
		enter.thisOccurs = true, enter.newVar('__global__', true);
		var REG_VAR = vmConfig.initGVM.itemly;
		REG_VAR(enter, inital, inits, initv);
		enter.listVar();
		var body = '', enterText = vmConfig.initGVM.globally() + inits.join('\n') + '\n', exitText = vmConfig.dumpGVM(inital).join('\n');
		var getFs = function(body){
			var f_ = Function(body);
			var f = function () {
				return f_.apply(initv, arguments)
			};
			return {
				wrappedF: f,
				rawF: f_,
				generatedSource: body
			}
		}

		return {
			compile: function(){
				body = compileFunctionBody(enter, enterText, exitText);
				return getFs(body);
			},
			asyncCompile: function(onSuccess, onStep){
				var queue = enter.generateQueue([]);
				var onStep = onStep || function(){};
				var i = 0, body;
				var step = function(){
					if(i < queue.length){
						body = compileFunctionBody(queue[i], queue[i] === enter ? enterText : '', queue[i] === enter ? exitText : '');
						onStep(queue[i], i, body);
						i += 1;
						setTimeout(step, 10);
					} else {
						return onSuccess(getFs(body))
					}
				}
				setTimeout(step, 0);
			}
		}
	}
	lofn.Script = function(source, config, libraries){
		var tokens = lofn.lex(source);
		var tree = lofn.parse(tokens, source);
		config = config || lofn.standardTransform
	
		var specL = new Nai;
		var vm;
		var inita = function(libs){
			return function(r){
				for(var i = 0; i<libs.length;i++) for(var each in libs[i])
					if(OWNS(libs[i], each))
						r(each, libs[i][each])
			}
		}([lofn.stl].concat(libraries || [], [specL]));
	
		tokens = null;
	
		return {
			expose: function(name, value){
				specL[name] = value
			},
			compile: function(){
				this.setGlobalVariable = null;
				lfcr = lofn.Compiler(tree, inita, config).compile(); 
				return lfcr;
			},
			asyncCompile: function(onSuccess, onStep){
				lofn.Compiler(tree, inita, config).asyncCompile(
					function(cm){
						lfcr = cm;
						onSuccess.apply(this, arguments)
					}, onStep
				);
			},
			start: function(){
				if(!lfcr) this.compile();
				lfcr.wrappedF.apply(null, arguments);
			}
		};
	};	
}();

