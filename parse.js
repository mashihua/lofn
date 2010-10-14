lofn.parse = function(){

var HAS_DUPL = function (arr) {
	var b = arr.slice(0).sort();
	for (var i = 0; i < b.length - 1; i++)
		if (b[i] && b[i] == b[i + 1])
			return true;
}

var itself = function () { return this };
var typename;
var NodeType = lofn.NodeType = function () {

	var types = typename = [
		'UNKNOWN', 'VARIABLE', 'THIS', 'LITERAL', 'ARRAY', 'OBJECT', 'ARGUMENTS', 'CALLEE', 'ARGN', 'GROUP',

		'MEMBER', 'ITEM', 'MEMBERREFLECT', 

		'DO',

		'CALL', 'NEW',

		'NEGATIVE', 'NOT',

		'*', '/','%',

		'+', '-',
		'<<', '>>',

		'<', '>', '<=', '>=', '<=>', 'is', 'in',
		'+=','-=','*=','/=','%=','<<=','>>=',

		'==', '!=', '=~', '!~', '===', '!==',
		'and', 'or',

		'as',

		'->',
		'/@',
		':>',

		'=',

		'IF', 'FOR', 'WHILE', 'REPEAT', 'CASE', 'PIECEWISE', 'VAR', 'BREAK', 'CONTINUE', 'LABEL', 'THROW', 'RETURN', 'TRY',

		'VARDECL',

		'BLOCK',

		'FUNCTION', 'PARAMETERS', 'BODY',

		'SCRIPT',
		'SCOPE'
	];
	var T = {};
	for (var i = 0; i < types.length; i++) T[types[i]] = i;
	return T;
} ();



return function (input, source) {
	var PE = function(message, p){
		if(token || p != undefined){
			var pos = p == undefined ? token.position : p;
			var lineno = ('\n' + source.slice(0, pos)).match(/\n/g).length;
			var lineno_l = lineno.toString().length;
			message += '\nat line: ' + lineno;
			message += '\n ' + lineno + ' : ' + (source.split('\n')[lineno - 1]);
			message += '\n-' + (lineno + '').replace(/./g, '-') + '---' + (source.slice(0, pos).split('\n')[lineno - 1].replace(/./g, '-').replace(/$/, '^'));
		}
		var e = new Error(message);
		return e;
	}
	var ensure = function(c, m, p){
		if(!c) throw PE(m, p);
		return c;
	}
	var Node = function (type, props) {
		var p = props || {};
		p.type = type, p.bp = p.bp || 0, p.line = curline;
		return p
	};
	var ScopedScript = function (id, env) {
		this.code = new Node(NodeType.SCRIPT);
		this.variables = env ? derive(env.variables) : new Nai;
		this.varIsArg = new Nai;
		this.labels = {};
		this.upper = null;
		this.type = NodeType.SCOPE;
		this.nest = [];
		this.locals = [];
		this.id = id;
		this.parent = env;
		this.usedVariables = new Nai;
		this.usedVariablesOcc = new Nai;
		this.usedTemps = {};
		this.grDepth = 0;
		this.sharpNo = 0;
	};
	ScopedScript.prototype.newVar = function (name, isarg) {
		if (this.variables[name] >= 0) return;
		this.locals.push(name);
		this.varIsArg[name] = isarg === true;
		return this.variables[name] = this.id;
	};
	ScopedScript.prototype.resolveVar = function (name) {
		if (this.variables[name] >= 0)
			return this.variables[name];
		else
			return this.newVar(name)
	};
	ScopedScript.prototype.useVar = function (name, position) {
		this.usedVariables[name] = true;
		if(this.usedVariablesOcc[name] === undefined)
			this.usedVariablesOcc[name] = position;
	}
	ScopedScript.prototype.useTemp = function (type, id){
		this.usedTemps[type+id] = true;
	}
	ScopedScript.prototype.listVar = function () {
		for (var each in this.usedVariables) {
			if (this.usedVariables[each] === true && !(this.variables[each] > 0)){
				if(!opt_explicit)
					this.newVar(each);
				else
					throw PE('Undeclared variable "' + each + '" when using `!option explicit`.', this.usedVariablesOcc[each])
			}
		};
		for (var i = 0; i < this.nest.length; i++)
			this.nest[i].listVar();
	}
	ScopedScript.prototype.listTemp = function(){
		var l = []
		for(var each in this.usedTemps)
			if(this.usedTemps[each] === true)
				l.push(each);
		return l;
	}
	ScopedScript.prototype.generateQueue = function(arr){
		if(!arr) arr = [];
		for(var i = 0; i < this.nest.length; i++)
			this.nest[i].generateQueue(arr);
		arr.push(this);
		return arr;
	};
	ScopedScript.prototype.ready = function () {
		if (this.parameters) {
			for (var i = 0; i < this.parameters.names.length; i++) {
				this.newVar(this.parameters.names[i], true)
			}
		}
	};


	var 
		tokens = input.tokens,
		scopes = [],
		token = tokens[0],
		next = tokens[1], 
		i = 0, 
		len = tokens.length, 
		workingScopes = [],
		workingScope, 
		nt = NodeType,
		curline, 
		token_type = token ? token.type : undefined,
		token_value = token ? token.value : undefined,
		opt_explicit = !!input.options.explicit,
		opt_colononly = !!input.options.colononly,
		opt_sharpno = !!input.options.sharpno;
	if (token) curline = token.line;
	function acquire(){};
	var moveNext = function () {
		var t = token;
		acquire();
		i += 1;
		token = tokens[i];
		if(token){
			token_type = token.type;
			token_value = token.value;
		} else {
			token_type = token_value = undefined;
		}
		next = tokens[i + 1];
		if (token) curline = token.line;
		return t;
	};
	var newScope = function (isLE) {
		var n = scopes.length;
		var s = new ScopedScript(n + 1, workingScope);
		s.rebindThis = isLE;
		if (workingScope) {
			workingScope.hasNested = true;
			workingScope.hasRebindThisNested = isLE && !workingScope.rebindThis;
			workingScope.nest.push(s);
		}
		s.upper = workingScopes[workingScopes.length - 1];
		scopes[n] = s;
		workingScopes.push(s);
		workingScope = s;

		return n;
	};
	var endScope = function () {
		var s = workingScopes.pop();
		workingScope = workingScopes[workingScopes.length - 1];
	}
	var advance = function (type, test) {
		var nt, value, t, node;
		if (type !== undefined && token.type !== type)
			throw PE('Unexpected token: got' + token);
		if (test !== undefined && token.value !== test)
			throw PE('Unexpected token: got' + token);
		return moveNext();
	};
	var SQSTART = 91, SQEND = 93, RDSTART = 40, RDEND = 41, CRSTART = 123, CREND = 125;

	var tokenIs = function (t, v) {
		return token && token_type === t && (v ? token_value === v : true);
	}
	var nextIs = function (t, v) {
		return next && next.type === t && (v ? next.value === v : true);
	}
	var shiftIs = function (n, t, v) {
		return tokens[i + n] && tokens[i + n].type === t && (v ? tokens[i + n].value === v : true);
	}

	// Identifier: like the javascript
	var variable = function () {
		var t = advance(ID);
		workingScope.useVar(t.value, t.position);
		return new Node(NodeType.VARIABLE, { name: t.value });
	};
	var lname = function () {
		var t = advance(ID);
		return new Node(NodeType.VARIABLE, { name: t.value });
	};
	var name = function () {
		if(token.isName) 
			var t = advance();	
		else 
			throw PE("A name is needed!");
		return new Node(NodeType.VARIABLE, { name: t.value });
	};

	// literals: number, string
	// number: stricter than javascript, 0.0E(-)0
	// strings: single and double quote. Single quotes only support escaping '' into '
	// Double quotes support \\ \n \" \t \uxxxx
	var literal = function () {
		var t = advance();
		return new Node(NodeType.LITERAL,
		{ value: t.value });
	};

	// constants
	var consts = {
		'true': true,
		'false': false,
		'null': null,
		'undefined': void 0
	};
	var constant = function () {
		var t = advance(CONSTANT);
		return new Node(nt.LITERAL, { value: consts[t.value] });
	};

	// this pointer
	var thisp = function () {
		var t = advance(ME);
		return new Node(nt.THIS);
	};

	// callee
	var calleep = function () {
		var t = advance(CALLEE);
		return new Node(nt.CALLEE);
	};

	// object
	var objinit = function () {
		var arr = [], ams = [];
		advance(STARTBRACE, CRSTART);
		var node = new Node(nt.OBJECT);
		if (tokenIs(ENDBRACE, CREND)) {
			node.args = [];
			advance();
			return node
		};
		arglist(node);
		advance(ENDBRACE, CREND);
		return node;
	};

	// 'my' construct: "my" Identifier
	var thisprp = function () {
		var t = advance(MY);
		var n = name();
		return new Node(nt.MEMBER, { left: new Node(nt.THIS), right: n });
	};

	// 'arguments' pointer
	var argsp = function () {
		var t = advance(ARGUMENTS);
		return new Node(nt.ARGUMENTS);
	};

	// Function body: 
	//		"{" statements "}"
	var functionBody = function (p) {
		advance(STARTBRACE, 123);
		var n = newScope(), s = workingScope, code;
		workingScope.parameters = p || new Node(nt.PARAMETERS, { names: [], anames: [] });
		workingScope.ready();
		workingScope.code = code = statements();
		if(code.content.length === 1 && code.content[0].type === nt.GROUP){
			code.content[0] = new Node(nt.RETURN, {expression: code.content[0]});
		}
		endScope();
		advance(ENDBRACE, 125);
		return new Node(nt.FUNCTION, { tree: s });
	};
	// Function body using
	//		COLON
	//			statements
	//		"end"
	var colonBody = function (p) {
		advance(COLON);
		var n = newScope(), s = workingScope;
		workingScope.parameters = p || new Node(nt.PARAMETERS, { names: [], anames: [] });
		workingScope.ready();
		workingScope.code = statements(END);
		endScope();
		advance(END);
		return new Node(nt.FUNCTION, { tree: s });
	};

	var curryBody = function (p) {
		var n = newScope(), s = workingScope;
		workingScope.parameters = p;
		workingScope.ready();
		workingScope.code = new Node(nt.SCRIPT, {
			content: [new Node(nt.RETURN, { expression: functionLiteral() })]
		});
		endScope();
		return new Node(nt.FUNCTION, { tree: s });
	};


	// Function literal
	// "function" [Parameters] FunctionBody
	var functionLiteral = function () {
		var f;
		if (tokenIs(STARTBRACE, RDSTART)) {
			var p = parameters();
		};
		if (tokenIs(STARTBRACE, RDSTART)) { // currying arguments
			f = curryBody(p);
		} else if (tokenIs(COLON))
			f = colonBody(p)
		else
			f = functionBody(p);
		return f;
	};

	// Parameters ->
	// "(" Parameter { "," Parameter } ")"
	// Parameter ->
	// Identifier

	// Only parameters explicitly defined names can be a named parameter
	var parameters = function () {
		var arr = [];
		advance(STARTBRACE, 40);
		if (!tokenIs(ENDBRACE, RDEND)) {
			arr[0] = name().name;
			while (tokenIs(COMMA)) {
				advance(COMMA);
				arr[arr.length] = name().name;
			};
		};
		advance(ENDBRACE, RDEND);
		ensure(!HAS_DUPL(arr), 'Parameter list contains duplicate');
		return new Node(nt.PARAMETERS, { names: arr });
	};

	// Array literal
	// "[" CI { "," CI } "]"
	var arrayLiteral = function () {
		advance(STARTBRACE, SQSTART);
		var n = new Node(nt.ARRAY);
		itemlist(n);
		advance(ENDBRACE, SQEND);
		return n;
	};

	// Lambda Expression content
	var lambdaCont = function (p) {
		var right;
		advance(LAMBDA);
		if (tokenIs(STARTBRACE, CRSTART) && !((next && next.isName || nextIs(STRING)) && shiftIs(2, COLON))) { // statement lambda
			right = functionBody(p);
			return right;
		} else {
			var r = newScope(true), s = workingScope;
			right = expression();
			workingScope.parameters = p;
			workingScope.ready();
			workingScope.code = new Node(nt.RETURN, { expression: right });
			endScope();
			return new Node(nt.FUNCTION, {
				tree: s
			});
		}
	}
	var isLambdaPar = function () {
		return (
			nextIs(ENDBRACE, RDEND) && shiftIs(2, LAMBDA) ||
			nextIs(ID) && (shiftIs(2, ENDBRACE, RDEND) && shiftIs(3, LAMBDA) || shiftIs(2, COMMA))
		)
	}
	var primary = function () {
		ensure(token, 'Unable to get operand: missing token');
		switch (token.type) {
			case ID:
				// x :> BODY
				// lambda
				if (nextIs(LAMBDA)) {
					var v = name();
					return lambdaCont(new Node(nt.PARAMETERS, {
						names: [v.name],
						anames: [null]
					}));
					// or variable
				} else return variable();
			case NUMBER:
			case STRING:
				return literal();
			case CONSTANT:
				return constant();
			case ME:
				return thisp();
			case CALLEE:
				return calleep();
			case MY:
				return thisprp();
			case ARGUMENTS:
				return argsp();
			case OBJECT:
				advance(OBJECT);
				return objinit();
			case STARTBRACE:
				if (token.value === SQSTART) {
					// array
					return arrayLiteral();
				} else if (token.value === RDSTART && isLambdaPar()) {
					return lambdaCont(parameters());
				} else if (token.value === RDSTART) {
					// braced expression (expr)
					advance();
					var n = expression(true);
					advance(ENDBRACE, 41);
					return n;
				} else if (token.value === CRSTART) {
					if((next && next.isName || nextIs(STRING)) && shiftIs(2, COLON)){
						// object literal
						return objinit()
					}
					// Raw function body
					// with no arguments
					else return functionBody(undefined, true);
				}
			case SHARP:
				// # form
				// depended on coming token
				// #{number} --> Arguments[number]
				// #{identifier} --> ArgNS[identifier]
				advance();
				if (tokenIs(NUMBER)) {
					return new Node(nt.MEMBERREFLECT, {
						left : new Node(nt.ARGUMENTS),
						right : literal()
					});
				} else if (tokenIs(ID)) {
					return new Node(nt.ITEM, {
						left : new Node(nt.ARGN),
						item : new Node(nt.LITERAL, {value: name().name})
					});
				} else if (tokenIs(SHARP)) {
					return new Node(nt.ARGUMENTS);
				} else {
					// implicit SHARPs
					if(opt_sharpno)
						throw PE('Implicit # was disabled due to !option sharono');
					return new Node(nt.MEMBERREFLECT, {
						left : new Node(nt.ARGUMENTS),
						right : new Node(nt.LITERAL, {
							value: workingScope.sharpNo ++
						})
					});
				};
			case LAMBDA:
				return lambdaCont(new Node(nt.PARAMETERS, {
					names: [],
					anames: []
				}));
			case FUNCTION:
				// function literal started with "function"
				advance(FUNCTION);
				return functionLiteral();
			default:
				throw PE('Unexpected token' + token);
		};
	};
	var memberitem = function (left) {
		var right;
		if (tokenIs(STARTBRACE, SQSTART)) {  // .[ Expressuib ]  format
			advance();
			right = expression();
			advance(ENDBRACE, SQEND);
			return new Node(nt.MEMBERREFLECT, { left: left, right: right });
		} else if (tokenIs(STRING)) {
			right = literal();
			return new Node(nt.MEMBERREFLECT, { left: left, right: right });
		} else { // . Identifier  format
			right = name();
			return new Node(nt.MEMBER, { left: left, right: right });
		}
	}
	var member = function () {
		var node = primary();
		// a.b.[e1].c[e2]			...
		while (tokenIs(DOT) || tokenIs(STARTBRACE, SQSTART) && !token.spaced) {
			var t = advance();
			if (t.type === DOT) {
				node = memberitem(node);
			} else {
				// ITEM
				// x[e] === x.item(e)
				node = new Node(nt.ITEM, { left: node, item: expression() });
				advance(ENDBRACE, SQEND);
			}
		};
		return node;
	};
	var callExpression = function () {
		var m = primary();
		out: while (
					 tokenIs(STARTBRACE, RDSTART)
					 || tokenIs(STARTBRACE, SQSTART) && !token.spaced
					 || tokenIs(DOT)
					 ) {
			switch (token.type) {
				case STARTBRACE:
					if (token.value === RDSTART && !token.spaced) { // invocation f(a,b,c...)
						advance();
						m = new Node(nt.CALL, {
							func: m
						});
						if (token.type === ENDBRACE && token.value === RDEND) { m.args = []; advance(); continue; };
						arglist(m);
						advance(ENDBRACE, RDEND);
					} else if (token.value === SQSTART) { // ITEM operator
						// a[e] === a.item(e)
						advance();
						m = new Node(nt.ITEM, {
							left: m,
							item: expression()
						});
						advance(ENDBRACE, SQEND);
					} else {
						break out;
					}
					continue;
				case DOT:
					advance();
					m = memberitem(m);
					continue;
			}
		};
		return m;
	};
	var arglist = function (nc) {
		var args = [], names = [], pivot, name, sname, nameused;
		do {
			if ((token.isName || tokenIs(STRING)) && nextIs(COLON)) {
				// named argument
				// name : value
				name = token.value, sname = true, nameused = true;
				advance();
				advance();
			}
			// callItem is the "most strict" expression.
			// without omissioned calls and implicit calls.
			// so you cannot write `f(1, 2, a:3)` like `f 1, 2, a:3`.
			pivot = callItem();
			args.push(pivot);
			if (sname) {
				names[args.length - 1] = name;
				sname = false;
			}
			if (!token || token.type !== COMMA) {
				break
			};
			advance();
		} while (true);
		ensure(!HAS_DUPL(names), 'Named argument list contains duplicate');
		nc.args = (nc.args || []).concat(args);
		nc.names = (nc.names || []).concat(names);
		nc.nameused = nc.nameused || nameused;
	};

	var itemlist = function (nc) {
		var args = [], names = [], pivot, name, sname, nameused;
		if (!tokenIs(ENDBRACE, SQEND))
			do {
				pivot = callItem();
				args.push(pivot);
				if (sname) {
					names[args.length - 1] = name;
					sname = false;
				}
				if (!token || token.type !== COMMA) {
					break
				};
				advance();
			} while (true);

		nc.args = args;
	};

	var unary = function () {
		// unary expression
		if (tokenIs(OPERATOR) && (token.value === '-' || token.value === 'not')) {
			var t = advance(OPERATOR);
			var n = callExpression();
			return new Node(t.value === '-' ? nt.NEGATIVE : nt.NOT, { operand: n });
		} else if (tokenIs(DO)){
			advance();
			return new Node(nt.DO, {operand: callExpression()});
		} else {
			return callExpression();
		}
	};
/*
	var operating = function(){
		var g = function(operators, lower){
			var tbl = {};
			for(var i = 0; i < operators.length; i += 1)
				tbl[operators[i]] = true;
			
			return function(){
				var n = lower();
				while(tokenIs(OPERATOR) && tbl[token_value] === true){
					var t = advance(OPERATOR);
					n = new Node(nt[t.value], {
						left: n,
						right: lower()
					});
				};
	
				return n;
			}
		};
		var gr = function(operators, lower){
			var tbl = {};
			for(var i = 0; i < operators.length; i += 1)
				tbl[operators[i]] = true;
			var opt = function(){
				var n = lower();
				if(tokenIs(OPERATOR) && tbl[token_value] === true){
					var t = advance(OPERATOR);
					return new Node(nt[t.value], {
						left: n,
						right: opt()
					});
				};
				return n;
			};
			return opt;
		};
		var gu = function(operators, lower){
			var tbl = {};
			for(var i = 0; i < operators.length; i += 1)
				tbl[operators[i]] = true;
			return function(){
				var n = lower();
				if(tokenIs(OPERATOR) && tbl[token_value] === true){
					var t = advance(OPERATOR);
					return new Node(nt[t.value], {
						left: n,
						right: lower()
					});
				};
				return n;
			};
		};

	
		var l1 = g(['*', '/', '%'], unary);
		var l2 = g(['+', '-'], l1);
		var l3 = g(['<<'], l2);
		var l3r = gr(['>>'], l3);
		var lsp = gu(['<=>'], l3r);
		var l4 = gu(['<', '>', '<=', '>='], lsp);
		var l5 = g(['is', 'in'], l4);
		var l6 = gu(['==', '!=', '=~', '!~', '===', '!=='], l5);
		var l7 = g(['and', 'or'], l6);
		var l8 = g(['as'], l7);
		var l9 = gr(['->'], l8);

		return l9;
	}();
*/
	var bp = {
		'*': 10, '/': 10, '%': 10,
		'+': 20, '-': 20,
		'<<': 25, '>>': 25,
		'<=>': 27,
		'<': 30, '>': 30, '<=': 30, '>=': 30,
		'is': 35, 'in': 35,
		'==': 40, '!=': 40, '=~': 40, '!~': 40, '===':40, '!==':40,
		'and': 50, 'or': 55,
		'as': 60,
		'->': 70
	};
	var combp = function(){
		var L = 0, R = 1, N = 2;
		return {
			'*': L, '/': L, '%': L,
			'+': L, '-': L,
			'<<': L, '>>': R,
			'<=>': N,
			'<': N, '>': N, '<=': N, '>=': N,
			'is': L, 'in': L,
			'==': N, '!=': N, '=~': N, '!~': N, '===':N, '!==':N,
			'and': L, 'or': L,
			'as': L,
			'->': R
		}
	}();


	var operatorPiece = function (start, progress) {
		// operators.
		// the "->" operator gets a "Rule" object
		// the "is","in","as",">>","<<" operators are costumizable.
		var uber = { right: start, bp: 65536 }, t, tv, operand, nbp, combining, n, node, p;
		while (tokenIs(OPERATOR) && ensure(bp[token.value] > 0, "Invalid Operator")) { // if is a valid operator, then...

			t = advance(OPERATOR), tv = t.value, p = t.position;
			operand = progress();
			nbp = bp[tv], combining = combp[tv];
			node = new Node(nt[tv], {
				right: operand,
				bp: nbp
			});
			n = uber;
			if(combining === 0 || combining === 2) {
				// Left combining & uncombining
				/*    H       H
				 *   / X ->  / !
				 *    / \     X R
				 *           / \
				 */
				while (n.right.bp > nbp)
					n = n.right;
				if (combining === 2 && n.right.bp === nbp)
					throw PE("Attempting to combine uncombinable operator", p);
				node.left = n.right;
				n.right = node;
			} else if (combining === 1){
				/* Right combining
				 *     H             H
				 *      L     ->      L
				 *     / L           / L
				 *      / \           / !
				 *         A           A R
				 */
				while (n.right.bp >= nbp)
					n = n.right;
				node.left = n.right;
				n.right = node;
			}
		};
		return uber.right;
	};
	var operating = function(){
		var start = unary();
		return operatorPiece(start, unary);
	}

	var omissionCall = function (node) {
		while (true) {
			if (!token) return node;
			switch (token.type) {
				case END:
				case ELSE:
				case WHEN:
				case OTHERWISE:
				case SEMICOLON:
				case ENDBRACE:
				case THEN:
				case TRY:
				case CATCH:
				case FINALLY:
					return node;
				default:
					var n_ = node;
					node = new Node(nt.CALL, { func: n_ });
					arglist(node);
					if (node.args.length === 1 && node.names[0] == null) {
						return new Node(nt.CALL, {
							func: n_,
							args: [omissionCall(node.args[0])],
							names: [null]
						})
					} else {
						return node;
					}
			}
		}
	};

	var ASSIGNIS = function(){
		var assi = {
			'+=' : 1,
			'-=' : 1,
			'*=' :1,
			'/=':1,
			'%=':1,
			'<<=':1,
			'>>=':1
		};
		return function(){
			return tokenIs(OPERATOR) && assi[token.value]===1
		};

	}();

	var expression = function () {
		// expression.
		// following specifics are supported:
		// - Omissioned calls
		// - "then" syntax for chained calls.
		var right, c = unary();
		if (tokenIs(OPERATOR, '=')){
			advance();
			return new Node(nt['='], { left: c, right: expression(true) });
		} else if (ASSIGNIS()) { //赋值
			var _v = token.value;
			advance();
			return new Node(nt['='], { left: c, right: new Node(nt[_v.slice(0, _v.length - 1)], {left:c, right:expression(true)})});
		}

		c = operatorPiece(c, unary);
	
		var method, isOmission = true;

		out: while (true) {
			if (!token) break out;
			switch (token.type) {
				case END: case SEMICOLON: case ENDBRACE: case ELSE: case WHEN: case OTHERWISE:
					break out;
				case THEN:
					advance();
					if (tokenIs(DOT)) {
						// |.name chaining
						advance(DOT);
						ensure(token && token.isName, 'Missing identifier for Chain invocation');
						method = name();
						c = new Node(nt.CALL, {
							func: new Node(nt.MEMBER, {
								left: c,
								right: method
							}),
							args: [],
							pipelike: true
						});
					} else {
						// pipeline
						method = member();
						c = new Node(nt.CALL, {
							func: method,
							args: [c],
							names: [null],
							pipelike: true,
							pipeline: true
						});
					}
					break;
				default:
					if (c.type === nt.CALL && c.pipelike) {
						arglist(c);
					} else if (isOmission) {
						c = omissionCall(c);
						isOmission = false;
					} else {
						throw PE('Invalid Omission Call');
					}
			}
		};

		return new Node(nt.GROUP, {operand: c});
	};
	var callItem = operating;


	var stover = function () {
		return !token || (token.type === SEMICOLON || token.type === END || token.type === ENDBRACE && token.value === CREND);
	}

	var endS = false;
	var stmtover = function(){endS = true}


	var statement =  function(){
		var r = statement_r.apply(this, arguments);
		stmtover();
		return r;
	};
	var statement_r = function () {
		if (token)
			switch (token.type) {
			case RETURN:
				advance();
				return new Node(nt.RETURN, { expression: expression() });
			case THROW:
				advance();
				return new Node(nt.THROW, { expression: expression() });
			case OPERATOR:
				if (token.value === '=') {
					advance();
					return new Node(nt.RETURN, { expression: expression() });
				}
			case IF:
				return ifstmt();
			case WHILE:
				return whilestmt();
			case REPEAT:
				return repeatstmt();
			case PIECEWISE:
				return piecewise();
			case CASE:
				return piecewise(true);
			case FOR:
				return forstmt();
			case LABEL:
				return labelstmt();
			case CONTINUE:
				advance();
				ensure(stover(), 'CONTINUE statement must be isolated');
				return new Node(nt.CONTINUE);
			case BREAK:
				return brkstmt();
			case END:
			case ELSE:
			case OTHERWISE:
			case WHEN:
				throw PE('Unobtained END,ELSE,WHEN or OTNERWISE');
			case VAR:
				advance();
				return vardecls();
			case TRY:
				return trystmt();
			case ENDBRACE:
				if (token.value === 125)
					return;
			default:
				return expression();
		};
	};
	var vardecls = function () {
		if (nextIs(OPERATOR, '=')) { // assigned variable
			var v = variable();
			workingScope.newVar(v.name);
			advance();
			return new Node(nt['='], {
				left: new Node(nt.VARIABLE, { name: v.name }),
				right: expression()
			});
		} else {
			var a = [vardecl()];
			while (token && token.type === COMMA) {
				advance();
				a.push(vardecl());
			}
		};
		ensure(stover(), "Invalid VAR declaration");
	};
	var vardecl = function () {
		var v = variable();
		workingScope.newVar(v.name);
		return new Node(nt.VARDECL, {
			name: v.name
		});
	};

	var contBlock = function () {
		if(tokenIs(COLON)) {
			var p = advance().position;
			var s = statements();
			ensure(token, 'Unterminated control block', p);
			advance(END);
			return s;
		} else if (tokenIs(COMMA)) {
			if(opt_colononly)
				throw PE('Only COLON bodies can be used due to `!option colononly`');
			advance();
			var s = statement_r();
	//		while (token && token.type === SEMICOLON) advance();
			return s;
		} else throw PE('Flow control body not started with COMMA or COLON');
	};

	var ifstmt = function () {
		advance(IF);
		var n = new Node(nt.IF);
		n.condition = callItem();
		if(tokenIs(COLON)){
			var p = advance().position;
			n.thenPart = statements(ELSE);
			ensure(token, "Unterminated control block", p);
			if(tokenIs(ELSE)){
				advance(ELSE);
				if(tokenIs(IF)){
					n.elsePart = ifstmt();
				} else {
					n.elsePart = contBlock();
				}
			} else if (tokenIs(END)) {
				advance(END);
			} else {
				throw PE("Unterminated control block", p);
			}
		} else if (tokenIs(COMMA)){
			advance(COMMA);
			if(opt_colononly)
				throw PE('Only COLON bodies can be used due to `!option colononly`');
			n.thenPart = statement_r();
			while(tokenIs(SEMICOLON)) advance();
			if(tokenIs(ELSE)){
				advance(ELSE);
				if(tokenIs(IF)){
					n.elsePart = ifstmt();
				} else {
					advance(COMMA);
					n.elsePart = statement_r();
				}
			}
		} else {
			throw PE('Flow control body not started with COMMA or COLON');
		}
		return n;
	};
	var whilestmt = function () {
		advance(WHILE);
		var n = new Node(nt.WHILE, {
			condition: callItem(),
			body: contBlock()
		});
		return n;
	};
	var repeatstmt = function () {
		advance(REPEAT);
		advance(COLON);
		var n = new Node(nt.REPEAT, {
			body: statements(UNTIL)
		});
		advance(UNTIL);
		n.condition = callItem();
		return n;
	};
	var stripSemicolons = function () {
		while (tokenIs(SEMICOLON)) advance();
	};
	var piecewise = function (t) {
		var n = new Node(t ? nt.CASE : nt.PIECEWISE);
		n.conditions = [], n.bodies = [];
		advance();
		if (t && tokenIs(FALLTHROUGH)) { // is it fallthrough?
			n.fallThrough = true;
			advance();
		};
		if (t) {
			n.expression = callItem();
		};
		advance(COLON);
		stripSemicolons();
		ensure(token, 'Unterminated piecewise/case block');
		while (tokenIs(WHEN) || tokenIs(OTHERWISE)) {
			if (tokenIs(WHEN)) {
				advance(WHEN);
				var condition = callItem();
				advance(COLON);
				stripSemicolons();
				if (token.type === WHEN) {
					n.conditions.push(condition);
					n.bodies.push(null);
					continue;
				} else {
					n.conditions.push(condition);
					n.bodies.push(statements(WHEN, OTHERWISE));
				}
			} else {
				advance(OTHERWISE);
				advance(COLON);
				n.otherwise = statements(END);
				break;
			}
		};
		advance(END);

		return n;
	};
	var forstmt = function () {
		var node = new Node(nt.FOR);
		advance(FOR);
		advance(STARTBRACE, RDSTART);
		ensure(token);
		if (token.type !== SEMICOLON) {
			if (token.type === VAR) {
				advance(VAR);
				node.start = vardecls();
			} else {
				node.start = expression();
			}
		};
		advance(SEMICOLON);
		if (token.type !== SEMICOLON) {
			node.condition = expression();
		} else {
			throw PE('The condition of a FOR loop mustn\'t be empty.');
		}
		advance(SEMICOLON);
		if (token.type !== ENDBRACE && token.value !== RDEND) {
			node.step = expression();
		};

		advance(ENDBRACE, RDEND);
		node.body = contBlock();
		return node;
	};
	var labelstmt = function () {
		advance(LABEL);
		ensure(tokenIs(ID));
		var label = lname().name;
		ensure(!workingScope.labels[label] && workingScope.labels[label] !== 0, 'Unable to re-label a statement');
		var node = new Node(nt.LABEL, {
			name: label
		});
		workingScope.labels[label] = node;
		node.body = contBlock();
		workingScope.labels[label] = 0;
		return node;
	};
	var brkstmt = function () {
		advance(BREAK);
		if (tokenIs(ID)) {
			var name = token.value;
			advance();
			if (workingScope.labels[name] && workingScope.labels[name].type === nt.LABEL) {
				ensure(stover(), 'Something more after BREAK statement');
				return new Node(nt.BREAK, { destination: name });
			} else {
				throw PE('BREAK statement used a unfound label');
			}
		} else {
			ensure(stover(), 'Something more after BREAK statement');
			return new Node(nt.BREAK, { destination: null });
		}
	};
	var trystmt = function(){
		var n = new Node(nt.TRY), v;
		advance(TRY);
		advance(COLON);
		n.trystmts = statements(CATCH, END);
		if(tokenIs(END)) {
			advance(END);
			return n;
		} else {
			advance(CATCH);
			n.catchvar = v = variable();
			workingScope.newVar(v.name);
			advance(COLON);
			n.catchstmts = statements();
			advance(END);
			return n;
		}
	}
	var statements = function (fin, fin2) {
		var script = new Node(nt.SCRIPT);
		var _t = endS;
	//	debugger;
		stripSemicolons();
		var a = [statement()];


		while (endS && token) {
			curline = token.line;
			endS = false;
			stripSemicolons();
			if (token && (tokenIs(fin) || tokenIs(END) || tokenIs(ENDBRACE, CREND) || tokenIs(fin2))) break;
			a.push(statement());
		}
		//ensure(!token || token.type === fin, "Unfinished statement block");
		script.content = a;
		endS = _t;
		return script;
	};
	newScope();
	workingScope.code = statements();

	return scopes;
}


}();
