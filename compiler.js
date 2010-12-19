﻿//:module: compiler
//	:author:		infinte (aka. be5invis)
//	:info:			The code generator for Lofn

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
	var T_ARGS
	var BEFORE_BLOCK
	var AFTER_BLOCK
	var JOIN_STMTS
	var THIS_BIND
	var ARGS_BIND
	var ARGN_BIND
	var C_TEMP
	var BIND_TEMP
	var currentBlock

	var CTRLCHR = function (c) {
		var n = c.charCodeAt(0);
		return '\\x' + (n > 15 ? n.toString(16) : '0' + n.toString(16));
	}
	var strize = function (s) {
		return '"' + (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\x00-\x1f\x7f]/g, CTRLCHR).replace(/<\/(script)>/ig, '<\x2f$1\x3e') + '"';
	};

	var GETV = function (node, env) {
		return C_NAME(node.name);
	}
	var SETV = function (node, val, env) {
		return '(' + C_NAME(node.name) + '=' + val + ')';
	}
	schemata(nt.SCRIPT, function (n) {
		var a = [];
		for (var i = 0; i < n.content.length; i++) {
			if (n.content[i])
				a.push(transform(n.content[i]));
		}
		var joined = JOIN_STMTS(a)
		return joined;
	});
	schemata(nt['='], function (n, env) {
		switch (this.left.type) {
		case nt.ITEM:
			return '(LF_ITEMSET(' + transform(this.left.left) + ',[' + C_ARGS(this.left, env).args + '],' + transform(this.right) + '))';
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
	schemata(nt.MEMBER, function () {
		var memberName = this.right.name;
		if (/[^\w$]/.test(memberName) || SPECIALNAMES[memberName] === 1) return '(' + transform(this.left) + ')["' + memberName + '"]';
		return '(' + transform(this.left) + '.' + memberName + ')';
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
	schemata(nt.ITEM, function () {
		return '(' + transform(this.left) + ').item(' + C_ARGS(this, env).args + ')';
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

	var C_ARGS = function(node, env){
		var args = [],
			names = [],
			comp = '',
			cbef = '';
		// this requires special pipeline processing:
		var pipelineQ = node.pipeline && node.func // pipe line invocation...
			&& !(node.func.type === nt.VARIABLE || node.func.type === nt.THIS || node.func.type === nt.DO) // and side-effective.
		if (pipelineQ) env.grDepth += 1;
		for (var i = 0; i < node.args.length; i++) {
			if (node.names[i]) {
				names.push(strize(node.names[i]), transform(node.args[i]));
			} else args.push(transform(node.args[i]));
		}
		if (pipelineQ) env.grDepth -= 1;
		if (pipelineQ) {
			lofn.ScopedScript.useTemp(env, 'PIPE', env.grDepth);
			var arg0 = args[0];
			args[0] = C_TEMP('PIPE'+env.grDepth);
			cbef =  C_TEMP('PIPE'+env.grDepth) + '=' + arg0 + ',';
		};
		comp += args.join(',');
		if (node.nameused) comp += (args.length ? ',' : '') + '(new NamedArguments(' + names.join(',') + '))';
		return {before: cbef, args: comp};
	};
	schemata(nt.CALL, function (n, env) {
		var comp, head;
		switch (this.func.type) {
			case nt.ITEM:
				head = 'LF_IINVOKE(' + transform(this.func.left) + ',[' + C_ARGS(this.func, env).args + ']' + (this.args.length ? ',' : '');
				break;
			case nt.DO:
				if(this.args.length === 1) {
					var s = env; while(s.rebindThis) s = trees[s.upper - 1];
					lofn.ScopedScript.useTemp(s, 'DOF1');
					s.thisOccurs = true;
					s.argsOccurs = true;
					head = C_TEMP('DOF1') + '(';
					break;
				};
			default:
				head = transform(this.func) + '(';
		};
		var ca = C_ARGS(this, env)
		comp = ca.args + ')'
		return '(' + ca.before + head + comp + ')';
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
		return '(LF_CREATERULE(' + transform(this.left) + ',' + transform(this.right) + '))';
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
		lofn.ScopedScript.useTemp(s, 'DOF');
		s.thisOccurs = true;
		s.argsOccurs = true;
		return C_TEMP('DOF');
	});

	schemata(nt.FUNCTION, function (n, e, trees) {
		var _e = env,
			f = trees[this.tree - 1];
		var s = (f.coroid ? compileCoroid : compileFunctionBody) (f, '', '', trees);
		env = _e;
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
		var a = [], cond = '';
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
	schemata(nt.FORIN, function (nd, e) {
		lofn.ScopedScript.useTemp(e, 'ENUMERATOR', this.no);
		lofn.ScopedScript.useTemp(e, 'YV');
		lofn.ScopedScript.useTemp(e, 'YVC');
		var s_enum = '';
		s_enum += C_TEMP('YV') + '=(' + C_TEMP('ENUMERATOR' + this.no) + ')()'
		s_enum += ',' + C_TEMP('YVC') + '=' + C_TEMP('YV') + ' instanceof LF_YIELDVALUE';
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

		s += '){\n' + transform(this.body) + '\n}';
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
			lofn.ScopedScript.useTemp(e, 'IGNOREDEXCEPTION');
			s += 'catch(' + C_TEMP('IGNOREDEXCEPTION') + '){}'
		}
		return s;
	});
	schemata(nt.USING, function(n, e){
		lofn.ScopedScript.useTemp(e, 'USINGSCOPE');
		var s = [];
		s.push( C_TEMP('USINGSCOPE') + '=' + transform(this.expression));
		for(var i = 0; i < this.names.length; i ++)
			s.push( C_NAME(this.names[i].name) + '=' + C_TEMP('USINGSCOPE') + '[' + strize(this.names[i].name) + ']' )
		return JOIN_STMTS(s);
	});
	schemata(nt.IMPORT, function(n, e){
		return C_NAME(this.importVar.name) + '=' + transform(this.expression);
	});
	var env, g_envs;
	var transform = function (node, aux) {
		if (vmSchemata[node.type]) {
			return vmSchemata[node.type].call(node, node, env, g_envs, aux);
		} else {
			return '{!UNKNOWN}';
		}
	}
	var compileFunctionBody = function (tree, hook_enter, hook_exit, scopes) {
		if (tree.coroid) return compileCoroid(tree, hook_enter, hook_exit, scopes);
		if (tree.transformed) return tree.transformed;
		env = tree;
		g_envs = scopes;
		var s;
		s = transform(tree.code);
		var locals = LF_UNIQ(tree.locals),
			vars = [],
			temps = lofn.ScopedScript.listTemp(tree);

		for (var i = 0; i < locals.length; i++)
			if (!(tree.varIsArg[locals[i]])){
				if(typeof tree.initHooks[locals[i]] === 'string')
					vars.push(C_NAME(locals[i]) + '=' + tree.initHooks[locals[i]])
				else
				vars.push(C_NAME(locals[i]));
			}
		for (var i = 0; i < temps.length; i++)
			temps[i] = BIND_TEMP(tree, temps[i]);
		s = JOIN_STMTS([
				THIS_BIND(tree),
				ARGS_BIND(tree),
				ARGN_BIND(tree),
				(temps.length ? 'var ' + temps.join(','): ''),
				(vars.length ? 'var ' + vars.join(', ') : '')
			]) 
			+ (hook_enter || '') 
			+ s 
			+ (hook_exit || '');

		var pars = tree.parameters.names.slice(0), temppars = lofn.ScopedScript.listParTemp(tree);
		for (var i = 0; i < pars.length; i++)
			pars[i] = C_NAME(pars[i])
		for (var i = 0; i < temppars.length; i++)
			temppars[i] = C_TEMP(temppars[i])
		s = '(function(' + pars.concat(temppars).join(',') + '){\n' + s + '\n})';
	
		tree.transformed = s;
		return s;
	};

	var compileCoroid = function(tree, hook_enter, hook_exit, scopes){
/*	General schemata:
 *  while(_PROGRESS){
 *  	switch(_PROGESS){
 *  		case ...
 *  	}
 *  }
 * */
		if(tree.transformed) return tree.transformed;
		env = tree;
		g_envs = scopes;
		var cSchemata = vmSchemata.slice(0);
		var ct = function (node) {
			if (cSchemata[node.type]) {
				return cSchemata[node.type].call(node, node, env, g_envs);
			} else {
				return '{!UNKNOWN}';
			}
		}
		var labelN = 0;
		var label = function(){
			labelN += 1;
			return labelN
		};
		var lNearest = 0;
		var scopeLabels = {};

		lInital = label();

		var GOTO = function(label){
			return '{' + C_TEMP('PROGRESS') + '=' + label + '; break MASTERCTRL};\n'
		}
		var STOP = function(label){
			return '\n' + C_TEMP('PROGRESS') + '=' + label + ';\n';
		}
		var LABEL = function(label){
			return '\ncase ' + label + ':\n'
		}
		var OVER = function(){
			return '\n;{ ' + C_TEMP('PROGRESS') + '= 0; ' + C_TEMP('EOF') + '= true };\n'
		}
		var ps = function(s){ currentBlock.push(s) };
		var pct = function(node){ return ps(ct(node))};

		// get obstructiveness information
		(function(){
			var process = function(node){
				if(!node || !node.type) return false;
				var obs = false;
				if(node.type === nt.AWAIT){
					node.obstructive = true;
					obs = true
				};
				out: for(var each in node) if(node[each]){
					if(node[each].length){
						for(var i = 0; i < node[each].length; i++)
							if(node[each][i] && node[each][i].type && process(node[each][i])){
								obs = node.obstructive = true;
							}
					} else {
						if(node[each].type && process(node[each])){
							obs = node.obstructive = true;
						}
					}
				}
				return obs && node.type !== nt.EXPRSTMT;
			}
			return process
		})()(tree.code);

		var oschemata = function(type, func){
			var vmp = vmSchemata[type];
			cSchemata[type] = function(node){
				if(!node.obstructive)
					return vmp.apply(this, arguments)
				else
					return func.apply(this, arguments);
			}
		};
		var obstID = function(n){
			return function(){
				lofn.ScopedScript.useTemp(env, 'OBSTR', ++n);
				return C_TEMP('OBSTR' + n);
			}
		}(0);
		var otransform = function(node){
			var id = obstID();
			ps(id + ' = (' + ct(node) + ')');
			return id;
		}

		cSchemata[nt.EXPRSTMT] = function(){ ps(this.obstructive ? ct(this.expression) : transform(this.expression)) }


		// obstructive expressions

		oschemata(nt['='], function (n, env) {
			switch (this.left.type) {
				case nt.ITEM:
					return '(LF_ITEMSET(' + otransform(this.left.left) + ',[' + oC_ARGS(this.left, env).args + '],' + otransform(this.right) + '))';
				case nt.MEMBER:
					return '((' + otransform(this.left.left) + ')[' + strize(this.left.right.name) + ']=' + otransform(this.right) + ')';
				case nt.MEMBERREFLECT:
					return '((' + otransform(this.left.left) + ')[' + otransform(this.left.right) + ']=' + otransform(this.right) + ')';
				case nt.VARIABLE:
					return SETV(this.left, otransform(this.right), env);
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

			for(var i = (skip || 0); i < args.length; i++)
				args[i] = otransform(args[i]);
			for(var i = 1; i < names.length; i += 2)
				names[i] = otransform(names[i]);

			comp += (skip ? skips.concat(args) : args).join(',');
			if (node.nameused) comp += (args.length ? ',' : '') + '(new NamedArguments(' + names.join(',') + '))';
			return {args: comp};
		};

		oschemata(nt.CALL, function (node, env) {
			if(this.func && this.func.type === nt.AWAIT)
				return awaitCall.apply(this, arguments);
			var comp, head;
			var pipelineQ = node.pipeline && node.func // pipe line invocation...
				&& !(node.func.type === nt.VARIABLE || node.func.type === nt.THIS || node.func.type === nt.DO) 
				// and side-effective.
			var skip = 0;
			var skips = [];
			var obstructive;
			if(pipelineQ){
				skip = 1;
				skips = [otransform(this.args[0])];
			}

			switch (this.func.type) {
				case nt.ITEM:
					head = 'LF_IINVOKE(' + otransform(this.func.left) + ',[' + oC_ARGS(this.func, env).args + ']' + (this.args.length ? ',' : '');
					break;
				case nt.DO:
					if(this.args.length === 1) {
						var s = env; while(s.rebindThis) s = trees[s.upper - 1];
						lofn.ScopedScript.useTemp(s, 'DOF1');
						s.thisOccurs = true;
						s.argsOccurs = true;
						head = C_TEMP('DOF1') + '(';
						break;
					};
				default:
					head = otransform(this.func) + '(';
			};
			var ca = oC_ARGS(this, env, skip, skips)
			comp = ca.args + ')'
			return '(' + head + comp + ')';
		});

		var awaitCall = function(node, env){
			env.argsOccurs = true;
			env.thisOccurs = true;
			var head = C_TEMP('SCHEMATA') + '[' + strize(this.func.pattern) + ']';
			var callbody = oC_ARGS(this, env).args;
			var id = obstID();
			var l = label();
			ps(STOP(l));
			ps('return ' + head + '(' 
					+ T_THIS() + ',' 
					+ T_ARGS() + ',' 
					+ '[' + callbody + ']' + ','
					+ 'function(x){' + id + ' = x;' + C_TEMP('COROFUN') + '.apply(this, arguments) }'
				+ ')');
			ps(LABEL(l));
			return id;
		};
		oschemata(nt.AWAIT, function (n, e) {
			env.argsOccurs = true;
			env.thisOccurs = true;
			var head = C_TEMP('SCHEMATA') + '[' + strize(this.pattern) + ']';
			var id = obstID();
			var l = label();
			ps(STOP(l));
			ps('return ' + head + '(' 
					+ T_THIS() + ',' 
					+ T_ARGS() + ',' 
					+ '[]' + ','
					+ 'function(x){' + id + ' = x;' + C_TEMP('COROFUN') + '.apply(this, arguments) }'
				+ ')');
			ps(LABEL(l));
			return id;
		});
		oschemata(nt.OBJECT, function () {
			var comp = '{';
			var inits = [],
				x = 0;
			for (var i = 0; i < this.args.length; i++) {
				if (this.names[i]) {
					inits.push(strize(this.names[i]) + ':' + otransform(this.args[i]));
				} else {
					inits.push(strize('' + x) + ':' + otransform(this.args[i]));
					x++;
				}
			}
			comp += inits.join(',');
			comp += '}'
			return '(' + comp + ')';
		});
		oschemata(nt.ARRAY, function () {
			var comp = '(',
				args = [],
				names = [];
			for (var i = 0; i < this.args.length; i++) {
				args[i] = otransform(this.args[i]);
			};
			comp += '[' + args.join(',') + '])';
			return comp;
		});
		oschemata(nt.MEMBER, function () {
			var memberName = this.right.name;
			if (/[^\w$]/.test(memberName) || SPECIALNAMES[memberName] === 1)
				return '(' + otransform(this.left) + ')["' + memberName + '"]';
			else
				return '(' + otransform(this.left) + '.' + memberName + ')';
		});
		oschemata(nt.MEMBERREFLECT, function () {
			return '(' + otransform(this.left) + '[' + otransform(this.right) + '])';
		});
		oschemata(nt.ITEM, function () {
			return '(' + otransform(this.left) + ').item(' + oC_ARGS(this, env).args + ')';
		});

		var binoper = function (operator, tfoper) {
			oschemata(nt[operator], function () {
				return '(' + otransform(this.left) + tfoper + otransform(this.right) + ')';
			});
		};
		var methodoper = function (operator, method) {
			oschemata(nt[operator], function () {
				return '(' + otransform(this.right) + '.' + method + '(' + otransform(this.left) + '))'
			});
		};
		var lmethodoper = function (operator, method) {
			oschemata(nt[operator], function () {
				return '(' + otransform(this.left) + '.' + method + '(' + otransform(this.right) + '))';
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

		oschemata(nt['~~'], function(){
			return '(' + otransform(this.left) + ',' + otransform(this.right) + ')';
		});

		oschemata(nt['->'], function () {
			return '(LF_CREATERULE(' + otransform(this.left) + ',' + otransform(this.right) + '))';
		});
		oschemata(nt.NEGATIVE, function () {
			return '(-(' + otransform(this.operand) + '))';
		});
		oschemata(nt.NOT, function () {
			return '(!(' + otransform(this.operand) + '))';
		});

		oschemata(nt['and'], function(){
			var left = otransform(this.left);
			var lElse = label();
			ps('if(!(' + left + '))' + GOTO(lElse));
			var right = otransform(this.right);
			var lEnd = label();
			ps(GOTO(lEnd));
			ps(LABEL(lElse));
			ps(right + '= false');
			ps(LABEL(lEnd));
			return left + '&&' + right;
		});

		oschemata(nt['or'], function(){
			var left = otransform(this.left);
			var lElse = label();
			ps('if(' + left + ')' + GOTO(lElse));
			var right = otransform(this.right);
			var lEnd = label();
			ps(GOTO(lEnd));
			ps(LABEL(lElse));
			ps(right + '= true');
			ps(LABEL(lEnd));
			return left + '||' + right;
		});







		// statements
		cSchemata[nt.IF] = function(node){
			var lElse = label();
			var lEnd = label();
			ps('if(!(' + ct(this.condition) + '))' + GOTO(lElse));
			pct(this.thenPart);
			if(this.elsePart){
				ps(GOTO(lEnd));
				ps(LABEL(lElse));
				pct(this.elsePart);
				ps(LABEL(lEnd));
			} else {
				ps(LABEL(lElse));
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
				ps(LABEL(l[i]))
				pct(b[i])
				ps(GOTO(lEnd))
			}

			if (this.otherwise) {
				ps(LABEL(lElse));
				pct(this.otherwise);
				ps(GOTO(lEnd));
			}
	
			ps(LABEL(lEnd));
			return lEnd;
		};
		cSchemata[nt.CASE] = function(){
			var b = [], l = [], cond = '', lElse, expr = otransform(this.expression);
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
				ps(LABEL(l[i]))
				pct(b[i])
				if(!this.fallThrough) ps(GOTO(lEnd))
			}

			if (this.otherwise) {
				ps(LABEL(lElse));
				pct(this.otherwise);
				ps(GOTO(lEnd));
			}
	
			ps(LABEL(lEnd));
			return lEnd;
		};

		cSchemata[nt.WHILE] = function(){
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			ps(LABEL(lLoop));
			ps('if(!(' + ct(this.condition) + '))' + GOTO(lEnd)); 
			pct(this.body);
			ps(GOTO(lLoop));
			ps(LABEL(lEnd));
			lNearest = bk;
			return '';
		}
		cSchemata[nt.FOR] = function () {
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			ps(ct(this.start));
			ps(LABEL(lLoop));
			ps('if(!(' + ct(this.condition) + '))' + GOTO(lEnd));
			pct(this.body);
			ps(ct(this.step));
			ps(GOTO(lLoop));
			ps(LABEL(lEnd));
			lNearest = bk;
			return '';
		};
		cSchemata[nt.FORIN] = function(){
			lofn.ScopedScript.useTemp(env, 'ENUMERATOR', this.no);
			lofn.ScopedScript.useTemp(env, 'YV');
			lofn.ScopedScript.useTemp(env, 'YVC');
			var s_enum = '';
			s_enum += C_TEMP('YV') + '=(' + C_TEMP('ENUMERATOR' + this.no) + ')()'
			s_enum += ',' + C_TEMP('YVC') + '=' + C_TEMP('YV') + ' instanceof LF_YIELDVALUE';
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
			ps(LABEL(lLoop));
			ps('if(!(' + C_TEMP('YVC') + '))' + GOTO(lEnd));
			pct(this.body)
			ps(s_enum)
			ps(GOTO(lLoop))
			ps(LABEL(lEnd))
			lNearest = bk;
			return '';
	
		};
		cSchemata[nt.REPEAT] = function(){
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			ps(LABEL(lLoop));
			pct(this.body);
			ps('if(!(' + ct(this.condition) + '))' + GOTO(lLoop));
			ps(LABEL(lEnd));
			lNearest = bk;
			return ''
		};
	

		cSchemata[nt.RETURN] = function() {
			ps(OVER());
			ps('return new LF_RETURNVALUE(' + ct(this.expression) + ')');
			return '';
		}

		cSchemata[nt.LABEL] = function () {
			var l = scopeLabels[this.name] = label();
			return ct(this.body) + LABEL(l);
		};
		cSchemata[nt.BREAK] = function () {
			return GOTO(this.destination ? scopeLabels[this.destination] : lNearest);
		};
		cSchemata[nt.TRY] = function(){
			throw new Error('Unable to use TRY statement in a coroutine function.');
		};

		cSchemata[nt.SCRIPT] = function (n) {
			var b = currentBlock;
			var a = [];
			currentBlock = a;
			for (var i = 0; i < n.content.length; i++){
				if (n.content[i])
					a.push(ct(n.content[i]));
			}
			var joined = JOIN_STMTS(a);
			currentBlock = b;
			return joined;
		};

		schemata(nt.AWAIT, cSchemata[nt.AWAIT]);

		var currentBlock = [];

		var s = ct(tree.code);

		lofn.ScopedScript.useTemp(tree, 'PROGRESS');
		lofn.ScopedScript.useTemp(tree, 'SCHEMATA', '', 2);
		lofn.ScopedScript.useTemp(tree, 'EOF');
		lofn.ScopedScript.useTemp(tree, 'ISFUN');
		lofn.ScopedScript.useTemp(tree, 'COROFUN');
		lofn.ScopedScript.useTemp(tree, 'FUN', '', 2);


		var locals = LF_UNIQ(tree.locals),
			vars = [],
			temps = lofn.ScopedScript.listTemp(tree);
		for (var i = 0; i < locals.length; i++)
			if (!(tree.varIsArg[locals[i]])){
				if(typeof tree.initHooks[locals[i]] === 'string')
					vars.push(C_NAME(locals[i]) + '=' + tree.initHooks[locals[i]])
				else
				vars.push(C_NAME(locals[i]));
			}
		for (var i = 0; i < temps.length; i++)
			temps[i] = BIND_TEMP(tree, temps[i]);

		var pars = tree.parameters.names.slice(0), temppars = lofn.ScopedScript.listParTemp(tree);
		for (var i = 0; i < pars.length; i++)
			pars[i] = C_NAME(pars[i])
		for (var i = 0; i < temppars.length; i++)
			temppars[i] = C_TEMP(temppars[i])

		s = '(function(' + C_TEMP('SCHEMATA') + '){ return function(' + pars.concat(temppars).join(',') + '){\n' + JOIN_STMTS([
				THIS_BIND(tree),
				ARGS_BIND(tree),
				ARGN_BIND(tree),
				(temps.length ? 'var ' + temps.join(','): ''),
				(vars.length ? 'var ' + vars.join(', ') : ''),
				C_TEMP('PROGRESS') + '=' + lInital,
				C_TEMP('EOF') + '= false'
			]) 
				+ (hook_enter || '') 
				+ 'return ' + C_TEMP('COROFUN') + ' = function(' + C_TEMP('FUN') + '){\n'
				+ C_TEMP('ISFUN') + ' = typeof ' + C_TEMP('FUN') + ' === "function";\n'
				+ 'while(' + C_TEMP('PROGRESS') + ') {\n'
				+ 'MASTERCTRL: switch(' + C_TEMP('PROGRESS') + '){\n'
					+ LABEL(lInital) + s
				+ OVER()
				+ 'return ;'
				+ '}\n}\n}' 
				+ (hook_exit || '')
			+ '}})'

		tree.transformed = s;
		return s;
	}

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
		currentBlock = null;
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
			argsName: function(){
				return '_$A_ARGS_'
			},
			thisBind: function (env) {
				return (!env.thisOccurs || env.rebindThis) ? '' : 'var _$T_ = (this === LF_M_TOP ? null : this)'
			},
			argnBind: function (env) {
				return (env.argnOccurs && !env.rebindThis) ? 'var _$A_ARGN_ = LF_CNARG(arguments[arguments.length - 1])' : ''
			},
			argsBind: function (env) {
				return (!env.argsOccurs || env.rebindThis) ? '' : 'var _$A_ARGS_ = LF_SLICE(arguments, 0)'
			},
			bindTemp: function (env, tempName) {
				if(tempName === 'DOF')
					return c.tempName('DOF') + ' = (function(t, a){ return function(f){ if(arguments.length === 1) return f.apply(t, a);\nelse return f.apply(t, LF_SLICE(arguments, 1).concat(LF_SLICE(a, arguments.length - 1))) }})('
							+ c.thisName(env) + ',' + c.argsName(env) + ')';
				else if(tempName === 'DOF1')
					return c.tempName('DOF1') + ' = (function(t, a){ return function(f){ return f.apply(t, a) }})('
							+ c.thisName(env) + ',' + c.argsName(env) + ')';
				else
					return c.tempName(tempName);
			},
			joinStatements: function (statements) {
				return statements.join(';\n') + ';\n';
			},
			initGVM: {
				globally: function(){return 'var ' + c.varName('__global__') + ' = ' + c.thisName()+ ';\n'},
				itemly: function(env, initInterator, aSrc, initv, libsAcquired){
					initInterator(function(v, n){
						initv[n] = v;
						lofn.ScopedScript.registerVariable(env, n, false);
						aSrc[n] = '(' + c.thisName() + '[' + strize(n) + '])';
					}, function(lib){
						if(lib.identity)
							libsAcquired.push(lib.identity)	
					}, true);
				}
			},
			dumpGVM: function(initFunction){
				var aSrc = [];
				initFunction(function(v, n){
					aSrc.push(c.thisName() + '[' + strize(n) + '] = ' + c.varName(n)+';');
				});	
				return aSrc;
			}
		}
	}();
	//============
	lofn.Compiler = function (ast, initInterator, vmConfig) {
		bindConfig(vmConfig);
		var inits = {},
			initv = new Nai,
			trees = ast.scopes,
			options = ast.options,
			enter = trees[0],
			libsAcquired = [];
		
		enter.thisOccurs = true;
		lofn.ScopedScript.registerVariable(enter, '__global__');
		
		vmConfig.initGVM.itemly(enter, initInterator, inits, initv, libsAcquired);
		
		inits.__global__ = vmConfig.thisName();
		enter.initHooks = inits;

		lofn.ScopedScript.generateVariableResolver(enter, trees, options.explicit);
		
		var body = '';
		var enterText //= vmConfig.initGVM.globally() + inits.join('\n') + '\n';
		var exitText //= vmConfig.dumpGVM(initInterator).join('\n');

		var getFs = function(generatedSource){
			var f_ = Function('return ' + generatedSource)();
			var f = function () {
				return f_.apply(initv, arguments)
			};

			return {
				wrappedF: f,
				rawF: f_,
				generatedSource: generatedSource
			}
		}

		return {
			compile: function(){
				body = compileFunctionBody(enter, enterText, exitText, trees);
				return getFs(body);
			},
			asyncCompile: function(onSuccess, onStep){
				var queue = lofn.ScopedScript.generateQueue(enter, trees, []);
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

	lofn.Script = function(source, config, libraries){
		var tokens = lofn.lex(source);
		var ast = lofn.parse(tokens, source);

		// ast = JSON.parse(JSON.stringify(ast));

		config = config || lofn.standardTransform
	
		var vm;
		var inita = lofn.forLibraries([lofn.stl].concat(libraries || []));
		var lfcr;
	
		tokens = null;
	
		return {
			compile: function(){
				this.setGlobalVariable = null;
				lfcr = lofn.Compiler(ast, inita, config).compile(); 
				return lfcr;
			},
			asyncCompile: function(onSuccess, onStep){
				lofn.Compiler(ast, inita, config).asyncCompile(
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

