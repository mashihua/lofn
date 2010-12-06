//:module: compiler
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
		return '(' + C_NAME(node.name) + '=' + val + ')';
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
			return 'LF_ITEMSET(' + transform(this.left.left) + ',[' + C_ARGS(this.left).args + '],' + transform(this.right) + ')';
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
		return '(' + transform(this.left) + ').item(' + C_ARGS(this).args + ')';
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
		while (n.rebindThis) n = trees[n.upper - 1];
		n.thisOccurs = true;
		return T_THIS(e);
	});
	schemata(nt.ARGN, function (nd, e){
		while(e.rebindThis) e = trees[e.upper - 1];
		e.argnOccurs = true;
		e.argsOccurs = true;
		return T_ARGN();
	});
	schemata(nt.ARGUMENTS, function (n, e) {
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

	var C_ARGS = function(node){
		var args = [],
			names = [],
			comp = '',
			cbef = '';
		for (var i = 0; i < node.args.length; i++) {
			if (node.names[i]) {
				names.push(strize(node.names[i]), transform(node.args[i]));
			} else args.push(transform(node.args[i]));
		}
		if (node.pipeline) {
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
				head = 'LF_IINVOKE(' + transform(this.func.left) + ',[' + C_ARGS(this.func).args + ']' + (this.args.length ? ',' : '');
				break;
			default:
				head = transform(this.func) + '(';
		};
		var ca = C_ARGS(this)
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
	lmethodoper('of', 'of');

	schemata(nt['~~'], function(){
		return '((' + transform(this.left) + '),(' + transform(this.right) + '))';
	});

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
		var s = e;
		while(s.rebindThis) s = trees[s.upper - 1];
		lofn.ScopedScript.useTemp(s, 'DOF');
		s.thisOccurs = true;
		s.argsOccurs = true;
		return C_TEMP('DOF');
	});

	schemata(nt.FUNCTION, function () {
		var _e = env,
			f = trees[this.tree - 1];
		var s = (f.corout ? compileCoroutine : compileFunctionBody) (f, '', '', trees);
		var pars = f.parameters.names.slice(0), temppars = lofn.ScopedScript.listParTemp(f);
		for (var i = 0; i < pars.length; i++)
			pars[i] = C_NAME(pars[i])
		for (var i = 0; i < temppars.length; i++)
			temppars[i] = C_TEMP(temppars[i])
		s = '(function(' + pars.concat(temppars).join(',') + '){\n' + s + '\n})';
		env = _e;
		return s;
	});

	schemata(nt.CONDITIONAL, function(){
		return '(' + transform(this.condition) + ')?(' + transform(this.thenPart) + '):' + ( this.elsePart ? transform(this.elsePart) : ' undefined ');
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
		s_enum += ',' + C_TEMP('YVC') + '?('
		s_enum += C_NAME(this.vars[0].name) + '=' + C_TEMP('YV') + '.value' ; // v[0] = enumerator.value
		for(var i = 1; i < this.vars.length; i += 1){
			s_enum += ', ' + C_NAME(this.vars[i].name) + '=' + C_TEMP('YV') + '.values[' + i + ']' ; // v[i] = enumerator.values[i]
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

	var env, envs;
	var transform = function (node) {
		if (vmSchemata[node.type]) {
			return vmSchemata[node.type].call(node, node, env, envs);
		} else {
			return '{!UNKNOWN}';
		}
	}
	var compileFunctionBody = function (tree, hook_enter, hook_exit, scopes) {
		if (tree.corout) return compileCoroutine(tree, hook_enter, hook_exit, scopes);
		if (tree.transformed) return tree.transformed;
		env = tree;
		trees = scopes;
		var s;
		s = transform(tree.code);
		var locals = tree.locals,
			vars = [],
			temps = lofn.ScopedScript.listTemp(tree);
		for (var i = 0; i < locals.length; i++)
			if (!(tree.varIsArg[locals[i]])) vars.push(C_NAME(locals[i]));
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

		tree.transformed = s;
		return s;
	};

	var compileCoroutine = function(tree, hook_enter, hook_exit, scopes){
/*	General schemata:
 *  while(_PROGRESS){
 *  	switch(_PROGESS){
 *  		case ...
 *  	}
 *  }
 * */
		if(tree.transformed) return tree.transformed;
		env = tree;
		trees = scopes;
		var cSchemata = vmSchemata.slice(0);
		var ct = function (node) {
			if (cSchemata[node.type]) {
				return cSchemata[node.type].call(node, node, env, envs);
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

		lofn.ScopedScript.useTemp(tree, 'PROGRESS', '');
		lofn.ScopedScript.useTemp(tree, 'EOF', '');
		lofn.ScopedScript.useTemp(tree, 'ISFUN');
		lofn.ScopedScript.useTemp(tree, 'FUN', '', 1);
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
		cSchemata[nt.IF] = function(node){
			var lElse = label();
			var lEnd = label();
			var s = 'if(!(' + ct(this.condition) + '))' + GOTO(lElse);
			s += ct(this.thenPart);
			if(this.elsePart){
				s += GOTO(lEnd);
				s += LABEL(lElse);
				s += ct(this.elsePart);
				s += LABEL(lEnd);
			} else {
				s += LABEL(lElse);
			}
			return s;			
		}
		cSchemata[nt.PIECEWISE] = function () {
			var a = [], b = [], l = [], cond = '';
			for (var i = 0; i < this.conditions.length; i++) {
				if (!this.bodies[i]) { // fallthrough condition
					cond += '(' + transform(this.conditions[i]) + ') || ';
				} else {
					cond += '(' + transform(this.conditions[i]) + ')';
					var li = label();
					l.push(li);
					b.push(this.bodies[i]);
					a.push('if (' + cond + '){\n' + GOTO(li) + '\n}');
					cond = '';
				}
			};

			var lEnd = label();	
			var bodies = '';
			for(var i = 0; i < l.length; i += 1){
				bodies += LABEL(l[i]) + ct(b[i]) + GOTO(lEnd) + ';\n';
			}

			var conds = a.join(' else ');
			if (this.otherwise) {
				var lElse = label()
				conds += ' else {\n' + GOTO(lElse) + '\n}';
				bodies += LABEL(lElse) + ct(this.otherwise) + GOTO(lEnd) + ';\n'
			} else {
				cond += GOTO(lEnd);
			}
	
			return conds + bodies + LABEL(lEnd);
		};
		cSchemata[nt.CASE] = function(){
			var b = [], l = [], li;
			var bk = lNearest;
			var lEnd = lNearest = label();

			var s = 'switch (' + transform(this.expression) + '){';
			for (var i = 0; i < this.conditions.length; i++) {
				s += '\ncase ' + transform(this.conditions[i]) + ' :'
				if (this.bodies[i]) {
					l.push(li = label());
					b.push(this.bodies[i]);
					s += GOTO(li);
				}
			}
	
			if (this.otherwise) {
				l.push(li = label());
				b.push(this.otherwise);
				s += '\ndefault:{\n' + GOTO(li) + '\n}';
			}
			s += '\n};\n' + GOTO(lEnd);
			var bodies = '';

			for(var i = 0; i < l.length; i += 1){
				bodies += LABEL(l[i]) + ct(b[i]) + (this.fallThrough ? '' : GOTO(lEnd))
			}
			
			lNearest = bk;
			return s + bodies + LABEL(lEnd);
		};



		cSchemata[nt.WHILE] = function(){
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			var s = LABEL(lLoop)
			s += 'if(!(' + ct(this.condition) + '))' + GOTO(lEnd); 
			s += ct(this.body);
			s += GOTO(lLoop);
			s += LABEL(lEnd);
			lNearest = bk;
			return s;
		}
		cSchemata[nt.FOR] = function () {
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			var s = ct(this.start) + ';\n' + LABEL(lLoop)
				+ 'if(!(' + ct(this.condition) + '))' + GOTO(lEnd)
				+ ct(this.body) + ';\n'
				+ ct(this.step) + ';\n'
				+ GOTO(lLoop)
				+ LABEL(lEnd)
			lNearest = bk;
			return s;
		};
		cSchemata[nt.FORIN] = function(){
			lofn.ScopedScript.useTemp(env, 'ENUMERATOR', this.no);
			lofn.ScopedScript.useTemp(env, 'YV');
			lofn.ScopedScript.useTemp(env, 'YVC');
			var s_enum = '';
			s_enum += C_TEMP('YV') + '=(' + C_TEMP('ENUMERATOR' + this.no) + ')()'
			s_enum += ',' + C_TEMP('YVC') + '=' + C_TEMP('YV') + ' instanceof LF_YIELDVALUE';
			s_enum += ',' + C_TEMP('YVC') + '?('
			s_enum += C_NAME(this.vars[0].name) + '=' + C_TEMP('YV') + '.value' ; // v[0] = enumerator.value
			for(var i = 1; i < this.vars.length; i += 1){
				s_enum += ', ' + C_NAME(this.vars[i].name) + '=' + C_TEMP('YV') + '.values[' + i + ']' ; // v[i] = enumerator.values[i]
			}
			s_enum = '(' + s_enum + '):undefined)';
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			var s = C_TEMP('ENUMERATOR' + this.no) + '=' + ct(this.range) + ';\n'
				+ s_enum + ';\n' + LABEL(lLoop)
				+ 'if(!(' + C_TEMP('YVC') + '))' + GOTO(lEnd)
				+ ct(this.body) + ';\n'
				+ s_enum + ';\n'
				+ GOTO(lLoop)
				+ LABEL(lEnd)
			lNearest = bk;
			return s;
	
		};
		cSchemata[nt.REPEAT] = function(){
			var lLoop = label();
			var bk = lNearest;
			var lEnd = lNearest = label();
			var s = LABEL(lLoop)
				 + ct(this.body)
				 + 'if(!(' + ct(this.condition) + '))' + GOTO(lLoop)
				 + LABEL(lEnd);
			lNearest = bk;
			return s
		};
	
		cSchemata[nt.YIELD] = function(node){
			var l = label();
			var e = this.args ?  C_ARGS(this).args : '';
			return 'if(' + C_TEMP('ISFUN') + ') ' + C_TEMP('FUN') +'(' + e + 
					');\n else {' +STOP(l) + 'return new LF_YIELDVALUE(' + e + ')} ;' + LABEL(l);
		}
		cSchemata[nt.RETURN] = function() {
			return OVER() + 'return new LF_RETURNVALUE(' + transform(this.expression) + ')'
		}

		cSchemata[nt.LABEL] =  function () {
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
			var a = [];
			for (var i = 0; i < n.content.length; i++)
			if (n.content[i]) {
				a[i] = ct(n.content[i]);
			}
			var joined = JOIN_STMTS(a)
			return joined;
		};



		var s = ct(tree.code);

		var locals = tree.locals,
			vars = [],
			temps = lofn.ScopedScript.listTemp(tree);
		for (var i = 0; i < locals.length; i++)
			if (!(tree.varIsArg[locals[i]])) vars.push(C_NAME(locals[i]));
		for (var i = 0; i < temps.length; i++)
			temps[i] = BIND_TEMP(tree, temps[i]);
		s = JOIN_STMTS([
				THIS_BIND(tree),
				ARGS_BIND(tree),
				ARGN_BIND(tree),
				(temps.length ? 'var ' + temps.join(','): ''),
				(vars.length ? 'var ' + vars.join(', ') : ''),
				C_TEMP('PROGRESS') + '=' + lInital,
				C_TEMP('EOF') + '= false'
			]) 
				+ (hook_enter || '') 
				+ 'return function(' + C_TEMP('FUN') + '){\n'
				+ C_TEMP('ISFUN') + ' = typeof ' + C_TEMP('FUN') + ' === "function";\n'
				+ 'while(' + C_TEMP('PROGRESS') + ') {\n'
				+ 'MASTERCTRL: switch(' + C_TEMP('PROGRESS') + '){\n'
					+ LABEL(lInital) + s
				+ OVER()
				+ 'return ;'
				+ '}\n}\n}' 
				+ (hook_exit || '');

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
					return c.tempName('DOF') + ' = (function(t, a){ return function(f){ return f.apply(t, a)}})('
							+ c.thisName(env) + ',' + c.argsName(env) + ')';
				else
					return c.tempName(tempName);
			},
			joinStatements: function (statements) {
				return statements.join(';\n') + ';\n';
			},
			initGVM: {
				globally: function(){return 'var ' + c.varName('__global__') + ' = ' + c.thisName()+ ';\n'},
				itemly: function(env, initFunction, aSrc, initv){
					initFunction(function(n, v){
						initv[n] = v;
						lofn.ScopedScript.registerVariable(env, n, true);
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
	lofn.Compiler = function (ast, inital, vmConfig) {
		bindConfig(vmConfig);
		var inits = [], initv = new Nai, trees = ast.scopes, options = ast.options, enter = trees[0];
		enter.thisOccurs = true, lofn.ScopedScript.registerVariable(enter, '__global__', true);
		
		var REG_VAR = vmConfig.initGVM.itemly;
		REG_VAR(enter, inital, inits, initv);

		lofn.ScopedScript.generateVariableResolver(enter, trees, options.explicit);
		
		var body = '',
			enterText = vmConfig.initGVM.globally() + inits.join('\n') + '\n',
			exitText = vmConfig.dumpGVM(inital).join('\n');
		
		var getFs = function(body){

			var pars = enter.parameters.names.slice(0),
				temppars = lofn.ScopedScript.listParTemp(enter);
			for (var i = 0; i < pars.length; i++) pars[i] = C_NAME(pars[i])
			for (var i = 0; i < temppars.length; i++) temppars[i] = C_TEMP(temppars[i])

			var f_ = Function('return function(' + pars.concat(temppars).join() + '){' + body + '}')();
			var f = function () {
				return f_.apply(initv, arguments)
			};
			return {
				wrappedF: f,
				rawF: f_,
				generatedSource: body,
				joinedParameters: pars.concat(temppars)
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
	}
	lofn.Script = function(source, config, libraries){
		var tokens = lofn.lex(source);
		var ast = lofn.parse(tokens, source);

		// ast = JSON.parse(JSON.stringify(ast));

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

