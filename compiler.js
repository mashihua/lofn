//:module: compiler
//	:author:		infinte (aka. be5invis)
//	:info:			The code generator for Eisa Runtime

0, function (eisa) {
	var TO_ENCCD = function (name) {
		return name.replace(/[^a-zA-Z0-9_]/g, function (m) {
			return '$' + m.charCodeAt(0).toString(36) + '$'
		});
	};

	var nt = eisa.ast.NodeType;
	var ScopedScript = eisa.ast.ScopedScript;

	var config, vmSchemata = [],
		schemata = function (tf, trans) {
			vmSchemata[tf] = trans;
		};

	var C_NAME
	var C_LABELNAME
	var T_THIS
	var T_ARGN
	var T_ARGS
	var BEFORE_BLOCK
	var AFTER_BLOCK
	var JOIN_STMTS
	var THIS_BIND
	var ARGS_BIND
	var ARGN_BIND
	var C_TEMP
	var BIND_TEMP
	var INDENT
	var currentBlock
	var SEQ = function(a, b){
		return '(' + a + ',' + b + ')';
	}

	var CTRLCHR = function (c) {
		var n = c.charCodeAt(0);
		return '\\x' + (n > 15 ? n.toString(16) : '0' + n.toString(16));
	}
	var strize = function (s) {
		return '"' + (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\x00-\x1f\x7f]/g, CTRLCHR).replace(/<\/(script)>/ig, '<\x2f$1\x3e') + '"';
	};

	var GETV = function (node, env) { return C_NAME(node.name) };
	var SETV = function (node, val, env) { return '(' + C_NAME(node.name) + '=' + val + ')' };
	var SPECIALNAMES = {
		"break":1,"continue":1,"do":1,"for":1,"import":1,
		"new":1,"this":1,"void":1,"case":1,
		"default":1,"else":1,"function":1,"in":1,
		"return":1,"typeof":1,"while":1,"comment":1,
		"delete":1,"export":1,"if":1,"label":1,
		"switch":1,"var":1,"with":1,"abstract":1,
		"implements":1,"protected":1,"boolean":1,"instanceof":1,
		"public":1,"byte":1,"int":1,"short":1,
		"char":1,"interface":1,"static":1,"double":1,
		"long":1,"synchronized":1,"false":1,"native":1,
		"throws":1,"final":1,"null":1,"transient":1,
		"float":1,"package":1,"true":1,"goto":1,
		"private":1,"catch":1,"enum":1,"throw":1,
		"class":1,"extends":1,"try":1,"const":1,
		"finally":1,"debugger":1,"super":1
	};
	var IDENTIFIER = /^[a-zA-Z$][\w$]*$/;
	var PART = function(left, right){
		if (!IDENTIFIER.test(right) || SPECIALNAMES[right] === 1)
			return left + '[' + strize(right) + ']';
		else 
			return left + '.' + right;
	};


	var transform;
	
	// Standard Schemata
	schemata(nt['='], function (n, env) {
		switch (this.left.type) {
		case nt.ITEM:
			return '(' + transform(this.left.left) + '.itemset(' + transform(this.left.member) + ',' + transform(this.right) + '))';
		case nt.MEMBER:
			return '(' + PART(transform(this.left.left), this.left.right.name) + '=' + transform(this.right) + ')';
		case nt.MEMBERREFLECT:
			return '((' + transform(this.left.left) + ')[' + transform(this.left.right) + ']=' + transform(this.right) + ')';
		case nt.VARIABLE:
			return SETV(this.left, transform(this.right), env);
		case nt.TEMPVAR:
			return '(' + C_TEMP(this.left.name) + '=' + transform(this.right) + ')';
		default:
			throw new Error('Invalid assignment left value: only VARIABLE, MEMBER, MEMBERREFLECT or ITEM avaliable');
		}
	});

	schemata(nt.MEMBER, function () {
		return '(' + PART(transform(this.left), this.right.name) + ')';
	});
	schemata(nt.MEMBERREFLECT, function () {
		return '(' + transform(this.left) + '[' + transform(this.right) + '])';
	});
	schemata(nt.SHARP, function(n, env){
		if(this.id >= env.parameters.names.length){
			return C_TEMP('IARG' + this.id);
		}
		return C_NAME(env.parameters.names[this.id]);
	});
	schemata(nt.ITEM, function (node, env) {
		return '(' + transform(this.left) + ').item(' + transform(this.member) + ')';
	});
	schemata(nt.VARIABLE, function (n, env) {
		return GETV(n, env);
	});
	schemata(nt.TEMPVAR, function(){
		return C_TEMP(this.name);
	})
	schemata(nt.GROUP, function(n, env){
		env.grDepth += 1;
		var r = '('+transform(this.operand)+')';
		env.grDepth -= 1;
		return r;
	});
	schemata(nt.THIS, function (nd, e, trees) {
		var n = e;
		while (n.rebindThis) n = trees[n.upper - 1];
		n.thisOccurs = true;
		return T_THIS(e);
	});
	schemata(nt.ARGN, function (nd, e, trees){
		while(e.rebindThis) e = trees[e.upper - 1];
		e.argnOccurs = true;
		e.argsOccurs = true;
		return T_ARGN();
	});
	schemata(nt.ARGUMENTS, function (n, e, trees) {
		var s = e;
		while(s.rebindThis) s = trees[s.upper - 1];
		s.argsOccurs = true;
		return T_ARGS();
	});
	schemata(nt.CALLEE, function () {
		return '(' + T_ARGS() + '.callee)';
	});
	schemata(nt.PARAMETERS, function () {
		throw new Error('Unexpected parameter group');
	});

	var C_ARGS = function(node, env, skip, skips){
		var args = [],
			names = [];
		
		for (var i = (skip || 0); i < node.args.length; i++) {
			if (node.names[i]) {
				names.push(strize(node.names[i]), transform(node.args[i]));
			} else args.push(transform(node.args[i]));
		};

		if(skip)
			args = skips.concat(args);
		if(names.length)
			args.push('(new NamedArguments(' + names.join(',') + '))');

		return {args: args.join(', ')};
	};

	schemata(nt.CALL, function (node, env, trees) {
		var comp, head;
		var skip = 0, skips = [], pipe;

		// this requires special pipeline processing:
		var pipelineQ = node.pipeline && node.func // pipe line invocation...
			&& !(node.func.type === nt.VARIABLE || node.func.type === nt.THIS || node.func.type === nt.DO) // and side-effective.

		if (pipelineQ) {
			// processing pipelined invocations
			env.grDepth += 1;
			skip = 1;
			ScopedScript.useTemp(env, 'PIPE', env.grDepth);
			pipe = C_TEMP('PIPE' + env.grDepth) + '=' + transform(this.args[0])
			skips = [C_TEMP('PIPE' + env.grDepth)];
		}

		switch (this.func.type) {
			case nt.ITEM:
				head = 'EISA_IINVOKE(' + transform(this.func.left) + ',' + transform(this.func.member) + (this.args.length ? ',' : '');
				break;
			case nt.DO:
				if(this.args.length === 1) {
					var s = env; while(s.rebindThis) s = trees[s.upper - 1];
					ScopedScript.useTemp(s, 'DOF1');
					s.thisOccurs = true;
					s.argsOccurs = true;
					head = C_TEMP('DOF1') + '(';
					break;
				};
			default:
				head = transform(this.func) + '(';
		};
		if(pipelineQ) env.grDepth -= 1;
		var ca = C_ARGS(this, env, skip, skips);
		comp = ca.args + ')';
		return '(' + (pipe ? (pipe + ', ') : '') + head + comp + ')';
	});
	schemata(nt.OBJECT, function () {
		var comp = '{';
		var inits = [],
			x = 0;
		for (var i = 0; i < this.args.length; i++) {
			if (typeof this.names[i] === "string") {
				inits.push(strize(this.names[i]) + ': ' + transform(this.args[i]));
			} else {
				inits.push(strize('' + x) + ': ' + transform(this.args[i]));
				x++;
			}
		}
		comp += (this.args.length < 4 ? inits.join(',') : '\n' + INDENT(inits.join(',\n')) + '\n');
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
			return '(' + transform(this.left) + tfoper + transform(this.right) + ')';
		});
	};
	var methodoper = function (operator, method) {
		schemata(nt[operator], function () {
			return '(' + transform(this.right) + '.' + method + '(' + transform(this.left) + '))'
		});
	};
	var lmethodoper = function (operator, method) {
		schemata(nt[operator], function () {
			return '(' + transform(this.left) + '.' + method + '(' + transform(this.right) + '))';
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
	lmethodoper('of', 'of');

	schemata(nt['~~'], function(){
		return '(' + transform(this.left) + ',' + transform(this.right) + ')';
	});

	schemata(nt['->'], function () {
		return '(EISA_CREATERULE(' + transform(this.left) + ',' + transform(this.right) + '))';
	});
	schemata(nt.NEGATIVE, function () {
		return '(-(' + transform(this.operand) + '))';
	});
	schemata(nt.NOT, function () {
		return '(!(' + transform(this.operand) + '))';
	});

	schemata(nt.DO, function(nd, e, trees){
		var s = e;
		while(s.rebindThis) s = trees[s.upper - 1];
		ScopedScript.useTemp(s, 'DOF');
		s.thisOccurs = true;
		s.argsOccurs = true;
		return C_TEMP('DOF');
	});

	schemata(nt.FUNCTION, function (n, e, trees) {
		var	f = trees[this.tree - 1];
		var s = (f.coroid ? compileCoroid : compileFunctionBody) (f, '', '', trees);
		return s;
	});



	schemata(nt.EXPRSTMT, function(){
		return transform(this.expression)
	});
	schemata(nt.VARDECLS, function(){
		var a = this.items;
		var ans = []
		for(var i = 0; i < a.length; i += 1){
			if(a[i].initalizer)
				ans.push( '(' + C_NAME(a[i].name) + '=(' + transform(a[i].initalizer) + '))')
		}
		return ans.join(',');
	});
	schemata(nt.RETURN, function () {
		return 'return ' + transform(this.expression);
	});
	schemata(nt.THROW, function () {
		return 'throw ' + transform(this.expression);
	});
	schemata(nt.IF, function () {
		var s = 'if (' + transform(this.condition) + '){';
		s += transform(this.thenPart);
		if (this.elsePart) {
			s += ('} else {') + transform(this.elsePart) + ('}');
		} else {
			s += ('}')
		}
		return s;
	});
	schemata(nt.PIECEWISE, function () {
		var a = [], cond = '';
		for (var i = 0; i < this.conditions.length; i++) {
			if (!this.bodies[i]) { // fallthrough condition
				cond += '(' + transform(this.conditions[i]) + ') || ';
			} else {
				cond += '(' + transform(this.conditions[i]) + ')';
				a.push('if (' + cond + '){' + transform(this.bodies[i]) + '}');
				cond = '';
			}
		}

		var s = a.join(' else ');
		if (this.otherwise) {
			s += ' else {' + transform(this.otherwise) + '}';
		}

		return s;
	});

	schemata(nt.CASE, function () {
		var s = 'switch (' + transform(this.expression) + '){\n';
		var stmts = [];
		for (var i = 0; i < this.conditions.length; i++) {
			stmts.push('  case ' + transform(this.conditions[i]) + ' :')
			if (this.bodies[i]) {
				stmts.push(transform(this.bodies[i]));
				stmts.push('    break;');
			}
		}

		if (this.otherwise) {
			stmts.push('  default:', transform(this.otherwise));
		}
		s += stmts.join('\n');
		s += '\n}';
		return s;
	});
	schemata(nt.REPEAT, function () {
		return 'do{' + transform(this.body) + '} while(!(' + transform(this.condition) + '))';
	});
	schemata(nt.WHILE, function () {
		return 'while(' + transform(this.condition) + '){' + transform(this.body) + '}';
	});
	schemata(nt.FORIN, function (nd, e) {
		ScopedScript.useTemp(e, 'ENUMERATOR', this.no);
		ScopedScript.useTemp(e, 'YV');
		ScopedScript.useTemp(e, 'YVC');
		var s_enum = '';
		s_enum += C_TEMP('YV') + '=(' + C_TEMP('ENUMERATOR' + this.no) + ')()'
		s_enum += ',' + C_TEMP('YVC') + '=' + C_TEMP('YV') + ' instanceof EISA_YIELDVALUE';
		s_enum += ',' + C_TEMP('YVC') + '?(';
		if(this.pass){
			s_enum += C_NAME(this.passVar.name) + '=' + C_TEMP('YV') + '.values'
		} else {
			s_enum += C_NAME(this.vars[0].name) + '=' + C_TEMP('YV') + '.value' ; // v[0] = enumerator.value
			for(var i = 1; i < this.vars.length; i += 1){
				s_enum += ', ' + C_NAME(this.vars[i].name) + '=' + C_TEMP('YV') + '.values[' + i + ']' ; // v[i] = enumerator.values[i]
			}
		}
		s_enum = '(' + s_enum + '):undefined)';
		var s = 'for(';
		s += '(' + C_TEMP('ENUMERATOR' + this.no) + '=' + transform(this.range) + ')'; // get enumerator;
		s += ',' + s_enum
		s += ';\n' + C_TEMP('YVC')
		s += ';' + s_enum;
		if (this.step) {
			s += transform(this.step);
		};

		s += '){' + transform(this.body) + '}';
		return s;
	});
	schemata(nt.FOR, function(){
		var s = 'for(';
		if (this.start) {
			s += transform(this.start);
		};
		s += ';' + transform(this.condition);
		s += ';';
		if (this.step) {
			s += transform(this.step);
		};

		s += '){' + transform(this.body) + '}';
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
			ScopedScript.useTemp(e, 'IGNOREDEXCEPTION');
			s += 'catch(' + C_TEMP('IGNOREDEXCEPTION') + '){}'
		}
		return s;
	});
	schemata(nt.USING, function(n, e){
		ScopedScript.useTemp(e, 'USINGSCOPE');
		var s = [];
		s.push( C_TEMP('USINGSCOPE') + '=' + transform(this.expression));
		for(var i = 0; i < this.names.length; i ++)
			s.push( C_NAME(this.names[i].name) + '=' + PART(C_TEMP('USINGSCOPE'), this.names[i].name))
		return JOIN_STMTS(s);
	});
	schemata(nt.IMPORT, function(n, e){
		return C_NAME(this.importVar.name) + '=' + transform(this.expression);
	});

	schemata(nt.SCRIPT, function (n) {
		var a = [];
		for (var i = 0; i < n.content.length; i++) {
			if (n.content[i]){
				a.push(transform(n.content[i]));
			}
		}
		return JOIN_STMTS(a)
	});

	var compileFunctionBody;
	var compileCoroid;

	0, function(){
		var env, g_envs;
		transform = function (node, aux) {
			if (vmSchemata[node.type]) {
				return vmSchemata[node.type].call(node, node, env, g_envs, aux);
			} else {
				return '{!UNKNOWN}';
			}
		}
		compileFunctionBody = function (tree, hook_enter, hook_exit, scopes) {
			if (tree.coroid) return compileCoroid(tree, hook_enter, hook_exit, scopes);
			if (tree.transformed) return tree.transformed;
			env = tree;
			g_envs = scopes;
			var s;
			s = transform(tree.code);
			var locals = EISA_UNIQ(tree.locals),
				vars = [],
				temps = ScopedScript.listTemp(tree);

			for (var i = 0; i < locals.length; i++)
				if (!(tree.varIsArg[locals[i]])){
					if(tree.initHooks[locals[i]] && tree.initHooks[locals[i]].type)
						vars.push(C_NAME(locals[i]) + '=' + transform(tree.initHooks[locals[i]]))
					else
					vars.push(C_NAME(locals[i]));
				}
			for (var i = 0; i < temps.length; i++)
				temps[i] = BIND_TEMP(tree, temps[i]);

			s = JOIN_STMTS([
					THIS_BIND(tree),
					ARGS_BIND(tree),
					ARGN_BIND(tree),
					(temps.length ? 'var ' + temps.join(', '): ''),
					(vars.length ? 'var ' + vars.join(',\n    ') : ''),
					hook_enter || '',
					s.replace(/^    /gm, ''),
					hook_exit || '']);

			var pars = tree.parameters.names.slice(0), temppars = ScopedScript.listParTemp(tree);
			for (var i = 0; i < pars.length; i++)
				pars[i] = C_NAME(pars[i])
			for (var i = 0; i < temppars.length; i++)
				temppars[i] = C_TEMP(temppars[i])
			s = '(function(' + pars.concat(temppars).join(',') + '){' + s + '})';
		
			tree.transformed = s;
			return s;
		};

		var coroidFlow = function(){
			var block = [];
			var joint = function(){
				return '\n' + block.join('\n') + '\n';
			};
			var labelN = 0;
			var label_dispatch = function(){
				return ++labelN
			};

			var GOTO = function(label){
				return '{' + C_TEMP('PROGRESS') + '=' + label + '; break MASTERCTRL}'
			}
			var STOP = function(label){
				return C_TEMP('PROGRESS') + '=' + label;
			}
			var LABEL = function(label){
				return block.push('  case ' + label + ':')
			}
			var OVER = function(){
				return '{ ' + C_TEMP('PROGRESS') + '= 0; ' + C_TEMP('COROFUN') + '.stopped = true }'
			}
			var pushStatement = function(s){
				if(s) block.push(INDENT(s) + ';')
			};

			return {
				ps: pushStatement,
				GOTO: GOTO,
				STOP: STOP,
				LABEL: LABEL,
				OVER: OVER,
				label: label_dispatch,
				joint: joint
			}
		}

		compileCoroid = function(tree, hook_enter, hook_exit, scopes){
			
			if(tree.transformed) return tree.transformed;
			var backupenv = env;
			env = tree;
			g_envs = scopes;
			var cSchemata = vmSchemata.slice(0);
			var ct = function (node) {
				if (!node.obstructive)
					return transform(node);
				if (cSchemata[node.type]) {
					return cSchemata[node.type].call(node, node, env, g_envs);
				} else {
					return '{!UNKNOWN}';
				}
			}

			// import flow manager
			var flowM = coroidFlow();
			var ps = flowM.ps;
			var label = flowM.label;
			var GOTO = flowM.GOTO;
			var LABEL = flowM.LABEL;
			var STOP = flowM.STOP;
			var OVER = flowM.OVER;
			var pct = function(node){ return ps(ct(node))};

			var lNearest = 0;
			var scopeLabels = {};
			lInital = label();


			var oSchemata = function(type, func){
				cSchemata[type] = func;
			};
			var obstPartID = function(n){
				return function(){
					ScopedScript.useTemp(env, 'OBSTR', ++n);
					return C_TEMP('OBSTR' + n);
				}
			}(0);
			var expPart = function(node){
				var id = obstPartID();
				ps(id + ' = (' + ct(node) + ')');
				return id;
			};



			// obstructive expressions

			oSchemata(nt['='], function (n, env) {
				switch (this.left.type) {
					case nt.ITEM:
						return '(' + expPart(this.left.left) + '.itemset(' + expPart(this.left.member) + ',' + expPart(this.right) + '))';
					case nt.MEMBER:
						return '(' + PART(expPart(this.left.left), this.left.right.name) + '=' + expPart(this.right) + ')';
					case nt.MEMBERREFLECT:
						return '((' + expPart(this.left.left) + ')[' + expPart(this.left.right) + ']=' + expPart(this.right) + ')';
					case nt.VARIABLE:
						return SETV(this.left, expPart(this.right), env);
					case nt.TEMPVAR:
						return '(' + C_TEMP(this.left.name) + '=' + expPart(this.right) + ')';
					default:
						throw new Error('Invalid assignment left value: only VARIABLE, MEMBER, MEMBERREFLECT or ITEM avaliable');
				}
			});

			var oC_ARGS = function(node, env, skip, skips){
				var args = [],
					names = [],
					comp = '';
				// if skip is 1, the first item is not named.

				for (var i = (skip || 0); i < node.args.length; i++) {
					if (node.names[i]) {
						names.push(strize(node.names[i]), node.args[i]);
					} else args.push(node.args[i]);
				}

				for(var i = 0; i < args.length; i++)
					args[i] = expPart(args[i]);
				for(var i = 1; i < names.length; i += 2)
					names[i] = expPart(names[i]);

				if(skip)
					args = skips.concat(args);
				if(names.length)
					args.push('(new NamedArguments(' + names.join(',') + '))')
				
				return {args: args.join(', ')};
			};

			oSchemata(nt.CALL, function (node, env, trees) {
				if(this.func && this.func.type === nt.AWAIT)
					return awaitCall.apply(this, arguments);
				var comp, head;
				var pipelineQ = node.pipeline && node.func // pipe line invocation...
					&& !(node.func.type === nt.VARIABLE || node.func.type === nt.THIS || node.func.type === nt.DO) 
					// and side-effective.
				var skip = 0;
				var skips = [];
				var obstructive;
				debugger;

				if(pipelineQ){
					skip = 1;
					skips = [expPart(this.args[0])];
				};

				switch (this.func.type) {
					case nt.ITEM:
						head = 'EISA_IINVOKE(' + expPart(this.func.left) + ',' + expPart(this.func.member) + (this.args.length ? ',' : '');
						break;
					case nt.DO:
						if(this.args.length === 1) {
							var s = env; while(s.rebindThis) s = trees[s.upper - 1];
							ScopedScript.useTemp(s, 'DOF1');
							s.thisOccurs = true;
							s.argsOccurs = true;
							head = C_TEMP('DOF1') + '(';
							break;
						};
					default:
						head = expPart(this.func) + '(';
				};
				var ca = oC_ARGS(this, env, skip, skips);
				comp = ca.args + ')'
				return '(' + head + comp + ')';
			});

			var awaitCall = function(node, env){
				env.argsOccurs = true;
				env.thisOccurs = true;
				var head = PART(C_TEMP('SCHEMATA'), this.func.pattern);
				var callbody = oC_ARGS(this, env).args;
				var id = obstPartID();
				var l = label();
				ps(STOP(l));
				ps('return ' + head + '(' 
						+ T_THIS() + ',' 
						+ T_ARGS() + ',' 
						+ '[' + callbody + ']' + ','
						+ 'function(x){' + id + ' = x;' + C_TEMP('COROFUN') + '() }'
					+ ')');
				LABEL(l);
				return id;
			};
			oSchemata(nt.AWAIT, function (n, env) {
				env.argsOccurs = true;
				env.thisOccurs = true;
				var head = PART(C_TEMP('SCHEMATA'), this.pattern);
				var id = obstPartID();
				var l = label();
				ps(STOP(l));
				ps('return ' + head + '(' 
						+ T_THIS() + ',' 
						+ T_ARGS() + ',' 
						+ '[]' + ','
						+ 'function(x){' + id + ' = x;' + C_TEMP('COROFUN') + '() }'
					+ ')');
				LABEL(l);
				return id;
			});
			oSchemata(nt.OBJECT, function () {
				var comp = '{';
				var inits = [],
					x = 0;
				for (var i = 0; i < this.args.length; i++) {
					if (typeof this.names[i] === 'string') {
						inits.push(strize(this.names[i]) + ':' + expPart(this.args[i]));
					} else {
						inits.push(strize('' + x) + ':' + expPart(this.args[i]));
						x++;
					}
				}
				comp += inits.join(',');
				comp += '}'
				return '(' + comp + ')';
			});
			oSchemata(nt.ARRAY, function () {
				var comp = '(',
					args = [],
					names = [];
				for (var i = 0; i < this.args.length; i++) {
					args[i] = expPart(this.args[i]);
				};
				comp += '[' + args.join(',') + '])';
				return comp;
			});
			oSchemata(nt.MEMBER, function () {
				return '(' + PART(expPart(this.left), this.right.name) + ')';
			});
			oSchemata(nt.MEMBERREFLECT, function () {
				return '(' + expPart(this.left) + '[' + expPart(this.right) + '])';
			});
			oSchemata(nt.ITEM, function (node, env) {
				return '(' + expPart(this.left) + ').item(' + expPart(this.member) + ')';
			});

			var binoper = function (operator, tfoper) {
				oSchemata(nt[operator], function () {
					return '(' + expPart(this.left) + tfoper + expPart(this.right) + ')';
				});
			};
			var methodoper = function (operator, method) {
				oSchemata(nt[operator], function () {
					return '(' + expPart(this.right) + '.' + method + '(' + expPart(this.left) + '))'
				});
			};
			var lmethodoper = function (operator, method) {
				oSchemata(nt[operator], function () {
					return '(' + expPart(this.left) + '.' + method + '(' + expPart(this.right) + '))';
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
			methodoper('in', 'contains');
			methodoper('is', 'be');
			methodoper('as', 'convertFrom');
			methodoper('>>', 'acceptShiftIn');
			lmethodoper('<=>', 'compareTo');
			lmethodoper('<<', 'shiftIn');
			lmethodoper('of', 'of');

			oSchemata(nt['~~'], function(){
				return '(' + expPart(this.left) + ',' + expPart(this.right) + ')';
			});

			oSchemata(nt['->'], function () {
				return '(EISA_CREATERULE(' + expPart(this.left) + ',' + expPart(this.right) + '))';
			});
			oSchemata(nt.NEGATIVE, function () {
				return '(-(' + expPart(this.operand) + '))';
			});
			oSchemata(nt.NOT, function () {
				return '(!(' + expPart(this.operand) + '))';
			});

			oSchemata(nt['and'], function(){
				var left = expPart(this.left);
				var lElse = label();
				ps('if(!(' + left + '))' + GOTO(lElse));
				var right = expPart(this.right);
				var lEnd = label();
				ps(GOTO(lEnd));
				(LABEL(lElse));
				ps(right + '= false');
				(LABEL(lEnd));
				return left + '&&' + right;
			});

			oSchemata(nt['or'], function(){
				var left = expPart(this.left);
				var lElse = label();
				ps('if(' + left + ')' + GOTO(lElse));
				var right = expPart(this.right);
				var lEnd = label();
				ps(GOTO(lEnd));
				(LABEL(lElse));
				ps(right + '= true');
				(LABEL(lEnd));
				return left + '||' + right;
			});


			// Statements
			cSchemata[nt.EXPRSTMT] = function(){
				return this.obstructive ? ct(this.expression) : transform(this.expression);
			}

			cSchemata[nt.IF] = function(node){
				var lElse = label();
				var lEnd = label();
				ps('if(!(' + ct(this.condition) + '))' + GOTO(lElse));
				pct(this.thenPart);
				if(this.elsePart){
					ps(GOTO(lEnd));
					(LABEL(lElse));
					pct(this.elsePart);
					(LABEL(lEnd));
				} else {
					(LABEL(lElse));
				}
				return '';
			}
			cSchemata[nt.PIECEWISE] = function () {
				var b = [], l = [], cond = '', lElse;
				for (var i = this.conditions.length-1; i >= 0; i--) {
					if (!this.bodies[i]) { // fallthrough condition
						l[i] = l[i+1]
					} else {
						var li = label();
						l[i] = li;
						b[i] = this.bodies[i];
					}
				};

				for (var i = 0; i < this.conditions.length; i++) {
					ps('if (' + ct(this.conditions[i]) + '){\n' + GOTO(li) + '\n}');
				};

				var lEnd = label();	
				if (this.otherwise) {
					var lElse = label()
					ps(GOTO(lElse));
				} else {
					ps(GOTO(lEnd));
				}

				for(var i = 0; i < b.length; i += 1) if(b[i]) {
					(LABEL(l[i]))
					pct(b[i])
					ps(GOTO(lEnd))
				}

				if (this.otherwise) {
					(LABEL(lElse));
					pct(this.otherwise);
					ps(GOTO(lEnd));
				}
		
				(LABEL(lEnd));
				return '';
			};
			cSchemata[nt.CASE] = function(){
				var b = [], l = [], cond = '', lElse, expr = expPart(this.expression);
				ps(expr);
				for (var i = this.conditions.length-1; i >= 0; i--) {
					if (!this.bodies[i]) { // fallthrough condition
						l[i] = l[i+1]
					} else {
						var li = label();
						l[i] = li;
						b[i] = this.bodies[i];
					}
				};
				
				for (var i = 0; i < this.conditions.length; i++) {
					ps('if (' + expr + '=== (' + ct(this.conditions[i]) + ')){\n' + GOTO(li) + '\n}');
				};

				var lEnd = label();	
				if (this.otherwise) {
					var lElse = label()
					ps(GOTO(lElse));
				} else {
					ps(GOTO(lEnd));
				}

				for(var i = 0; i < b.length; i += 1) if(b[i]) {
					(LABEL(l[i]))
					pct(b[i])
					ps(GOTO(lEnd))
				}

				if (this.otherwise) {
					(LABEL(lElse));
					pct(this.otherwise);
					ps(GOTO(lEnd));
				}
		
				(LABEL(lEnd));
				return '';
			};

			cSchemata[nt.WHILE] = function(){
				var lLoop = label();
				var bk = lNearest;
				var lEnd = lNearest = label();
				(LABEL(lLoop));
				ps('if(!(' + ct(this.condition) + '))' + GOTO(lEnd)); 
				pct(this.body);
				ps(GOTO(lLoop));
				(LABEL(lEnd));
				lNearest = bk;
				return '';
			}
			cSchemata[nt.FOR] = function () {
				var lLoop = label();
				var bk = lNearest;
				var lEnd = lNearest = label();
				ps(ct(this.start));
				(LABEL(lLoop));
				ps('if(!(' + ct(this.condition) + '))' + GOTO(lEnd));
				pct(this.body);
				ps(ct(this.step));
				ps(GOTO(lLoop));
				(LABEL(lEnd));
				lNearest = bk;
				return '';
			};
			cSchemata[nt.FORIN] = function(node, env){
				ScopedScript.useTemp(env, 'ENUMERATOR', this.no);
				ScopedScript.useTemp(env, 'YV');
				ScopedScript.useTemp(env, 'YVC');
				var s_enum = '';
				s_enum += C_TEMP('YV') + '=(' + C_TEMP('ENUMERATOR' + this.no) + ')()'
				s_enum += ',' + C_TEMP('YVC') + '=' + C_TEMP('YV') + ' instanceof EISA_YIELDVALUE';
				s_enum += ',' + C_TEMP('YVC') + '?(';
				if(this.pass){
					s_enum += C_NAME(this.passVar.name) + '=' + C_TEMP('YV') + '.values'
				} else {
					s_enum += C_NAME(this.vars[0].name) + '=' + C_TEMP('YV') + '.value' ; // v[0] = enumerator.value
					for(var i = 1; i < this.vars.length; i += 1){
						s_enum += ', ' + C_NAME(this.vars[i].name) + '=' + C_TEMP('YV') + '.values[' + i + ']' ; // v[i] = enumerator.values[i]
					}
				}
				s_enum = '(' + s_enum + '):undefined)';
				var lLoop = label();
				var bk = lNearest;
				var lEnd = lNearest = label();
				ps(C_TEMP('ENUMERATOR' + this.no) + '=' + ct(this.range));
				ps(s_enum);
				(LABEL(lLoop));
				ps('if(!(' + C_TEMP('YVC') + '))' + GOTO(lEnd));
				pct(this.body);
				ps(s_enum);
				ps(GOTO(lLoop));
				(LABEL(lEnd))
				lNearest = bk;
				return '';
		
			};
			cSchemata[nt.REPEAT] = function(){
				var lLoop = label();
				var bk = lNearest;
				var lEnd = lNearest = label();
				(LABEL(lLoop));
				pct(this.body);
				ps('if(!(' + ct(this.condition) + '))' + GOTO(lLoop));
				(LABEL(lEnd));
				lNearest = bk;
				return ''
			};
		

			cSchemata[nt.RETURN] = function() {
				ps(OVER());
				ps('return new EISA_RETURNVALUE(' + ct(this.expression) + ')');
				return '';
			};

			cSchemata[nt.THROW] = function () {
				ps(OVER());
				ps('throw ' + ct(this.expression));
				return '';
			};

			cSchemata[nt.LABEL] = function () {
				var l = scopeLabels[this.name] = label();
				pct(this.body);
				(LABEL(l));
				return ''
			};
			cSchemata[nt.BREAK] = function () {
				ps(GOTO(this.destination ? scopeLabels[this.destination] : lNearest));
				return ''
			};
			cSchemata[nt.TRY] = function(){
				throw new Error('Unable to use TRY statement in a coroutine function.');
			};
			cSchemata[nt.USING] = function(n, e){
				ScopedScript.useTemp(e, 'USINGSCOPE');
				ps(C_TEMP('USINGSCOPE') + '=' + expPart(this.expression));
				for(var i = 0; i < this.names.length; i ++)
					ps(C_NAME(this.names[i].name) + '=' + PART(C_TEMP('USINGSCOPE') , this.names[i].name))
				return '';
			};
			cSchemata[nt.IMPORT] = function(n, e){
				ps(C_NAME(this.importVar.name) + '=' + transform(this.expression));
				return ''
			};


			cSchemata[nt.SCRIPT] = function (n) {
				var gens;
				for (var i = 0; i < n.content.length; i++){
					if (n.content[i]){
						gens = ct(n.content[i]);
						if(gens) ps(gens);
					}
				}
			};


			LABEL(lInital);
			ct(tree.code);
			ps(OVER());
			ps('return');

			var s = flowM.joint();
				

			ScopedScript.useTemp(tree, 'PROGRESS');
			ScopedScript.useTemp(tree, 'SCHEMATA', '', 2);
			ScopedScript.useTemp(tree, 'EOF');
			ScopedScript.useTemp(tree, 'ISFUN');
			ScopedScript.useTemp(tree, 'COROFUN');
			ScopedScript.useTemp(tree, 'FUN', '', 2);
			ScopedScript.useTemp(tree, 'COEXCEPTION', '', 2);


			var locals = EISA_UNIQ(tree.locals),
				vars = [],
				temps = ScopedScript.listTemp(tree);
			for (var i = 0; i < locals.length; i++)
				if (!(tree.varIsArg[locals[i]])){
					if(tree.initHooks[locals[i]] && tree.initHooks[locals[i]].type)
						vars.push(C_NAME(locals[i]) + '=' + transform(tree.initHooks[locals[i]]))
					else
					vars.push(C_NAME(locals[i]));
				}
			for (var i = 0; i < temps.length; i++)
				temps[i] = BIND_TEMP(tree, temps[i]);

			var pars = tree.parameters.names.slice(0), temppars = ScopedScript.listParTemp(tree);
			for (var i = 0; i < pars.length; i++)
				pars[i] = C_NAME(pars[i])
			for (var i = 0; i < temppars.length; i++)
				temppars[i] = C_TEMP(temppars[i])

			s = '(EISA_OBSTRUCTIVE(function(' + C_TEMP('SCHEMATA') + '){ return function(' + pars.concat(temppars).join(', ') + '){' + JOIN_STMTS([
					THIS_BIND(tree),
					ARGS_BIND(tree),
					ARGN_BIND(tree),
					(temps.length ? 'var ' + temps.join(', '): ''),
					(vars.length ? 'var ' + vars.join(', ') : ''),
					C_TEMP('PROGRESS') + '=' + lInital,
					C_TEMP('EOF') + '= false',
					hook_enter || '',
					'return ' + C_TEMP('COROFUN') + ' = function(' + C_TEMP('FUN') + '){'
						+ JOIN_STMTS([
							C_TEMP('ISFUN') + ' = typeof ' + C_TEMP('FUN') + ' === "function"',
							'while(' + C_TEMP('PROGRESS') + ') {\n' +
								INDENT('MASTERCTRL: switch(' + C_TEMP('PROGRESS') + '){' + s + '}') +
							'\n}',
						]) + '}',
					hook_exit  || ''
				]) 
 
				+ '}}))'

			tree.transformed = s;
			env = backupenv;
			return s;
		}

	}();
	var bindConfig = function (vmConfig) {
		config = vmConfig;
		C_NAME = config.varName;
		C_LABELNAME = config.label;
		T_THIS = config.thisName;
		JOIN_STMTS = config.joinStatements;
		THIS_BIND = config.thisBind;
		ARGN_BIND = config.argnBind;
		ARGS_BIND = config.argsBind;
		T_ARGN = config.argnName;
		T_ARGS = config.argsName;
		C_TEMP = config.tempName;
		BIND_TEMP = config.bindTemp;
		INDENT = config.indent;
		currentBlock = null;
	};
	// Default Lofn compilation config
	eisa.standardTransform = function () {
		var _indent = 0,
			c;
		return c = {
			varName: function (name) {
				return TO_ENCCD(name) + '_$'
			},
			label: function (name) {
				return TO_ENCCD(name) + '_$_L'
			},
			tempName: function (type){
				return type + '_$_'
			},
			thisName: function (env) {
				return '_$_THIS'
			},
			argnName: function(){
				return '_$_ARGND'
			},
			argsName: function(){
				return '_$_ARGS'
			},
			thisBind: function (env) {
				return (!env.thisOccurs || env.rebindThis) ? '' : 'var ' + c.thisName() + ' = (this === EISA_M_TOP ? null : this)'
			},
			argnBind: function (env) {
				return (env.argnOccurs && !env.rebindThis) ? 'var ' + c.argnName() + ' = EISA_CNARG(arguments[arguments.length - 1])' : ''
			},
			argsBind: function (env) {
				return (!env.argsOccurs || env.rebindThis) ? '' : 'var ' + c.argsName() + ' = EISA_SLICE(arguments, 0)'
			},
			bindTemp: function (env, tempName) {
				if(tempName === 'DOF')
					return c.tempName('DOF') + ' = (function(t, a){ return function(f){ if(arguments.length === 1) return f.apply(t, a);\nelse return f.apply(t, EISA_SLICE(arguments, 1).concat(EISA_SLICE(a, arguments.length - 1))) }})('
							+ c.thisName(env) + ',' + c.argsName(env) + ')';
				else if(tempName === 'DOF1')
					return c.tempName('DOF1') + ' = (function(t, a){ return function(f){ return f.apply(t, a) }})('
							+ c.thisName(env) + ',' + c.argsName(env) + ')';
				else
					return c.tempName(tempName);
			},
			joinStatements: function (statements) {
				var ans = [], ansl = 0, statement;
				for(var i = 0; i < statements.length; i++) if((statement = statements[i])){
					statement = statement.replace(/^[\s;]+/g, '').replace(/[\s;]+$/g, '')
					if(/[^\s]/.test(statement))
						ans[ansl++] = statement;
				}
				return '\n' + c.indent(ans.join(';\n')) + ';\n';
			},
			initGVM: {
				globally: function(){return 'var ' + c.varName('__global__') + ' = ' + c.thisName()+ ';\n'},
				itemly: function(env, initInterator, aSrc, initv, libsAcquired){
					initInterator(function(v, n){
						initv[n] = v;
						ScopedScript.registerVariable(env, n, false);
						aSrc[n] = PART(c.thisName(), n);
					}, function(lib){
						if(lib.identity)
							libsAcquired.push(lib.identity)	
					}, true);
				}
			},
			dumpGVM: function(initFunction){
				var aSrc = [];
				initFunction(function(v, n){
					aSrc.push(PART(c.thisName() ,n) + ' = ' + c.varName(n)+';');
				});	
				return aSrc;
			},
			indent: function(s){
				return s.replace(/^/gm, '    ')
			}
		}
	}();
	//============
	eisa.Compiler = function (ast, vmConfig) {

		bindConfig(vmConfig);
		
		var trees = ast.scopes;
		var enter = trees[0];

		var body = '';
		var enterText; //= vmConfig.initGVM.globally() + inits.join('\n') + '\n';
		var exitText; //= vmConfig.dumpGVM(initInterator).join('\n');

		var getFs = function(generatedSource){
			var f = Function('return ' + generatedSource)();

			return {
				wrappedF: f,
				rawF: f,
				generatedSource: generatedSource
			}
		}

		return {
			compile: function(){
				body = compileFunctionBody(enter, enterText, exitText, trees);
				return getFs(body);
			},
			asyncCompile: function(onSuccess, onStep){
				var queue = ScopedScript.generateQueue(enter, trees, []);
				var onStep = onStep || function(){};
				var i = 0, body;
				var step = function(){
					if(i < queue.length){
						body = compileFunctionBody(queue[i], queue[i] === enter ? enterText : '', queue[i] === enter ? exitText : '', trees);
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
	};

	eisa.Script = function(source, language, config, libraries){

		var libs = [eisa.stl].concat(libraries || [])

		var inita = eisa.forLibraries(libs);
		var tokens = language.lex(source);
		var ast = language.parse(tokens, source, inita);

		// ast = JSON.parse(JSON.stringify(ast));

		config = config || eisa.standardTransform
	
		var vm;
		var lfcr;

		var initvs;
	
		tokens = null;	

		return {
			compile: function(){
				this.setGlobalVariable = null;
				lfcr = eisa.Compiler(ast, config).compile(); 
				return lfcr;
			},
			asyncCompile: function(onSuccess, onStep){
				eisa.Compiler(ast, config).asyncCompile(
					function(cm){
						lfcr = cm;
						onSuccess.apply(this, arguments)
					}, onStep);
			},
			start: function(){
				if(!lfcr) this.compile();
				if(!initvs)
					initvs = eisa.squashLibs(libs)
				lfcr.wrappedF.apply(initvs, arguments);
			}
		};
	};	
}(EISA_eisa);
