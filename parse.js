lofn.parse = function(){
var ensure = function (c, m) {
	if (!c)
		throw new Error(m);
	return c;
}

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
		'UNKNOWN', 'VARIABLE', 'THIS', 'LITERAL', 'ARRAY', 'OBJECT', 'ARGUMENTS', 'CALLEE',

		'MEMBER', 'ITEM', 'MEMBERREFLECT',

		'CALL', 'NEW',

		'NEGATIVE', 'NOT',

		'*', '/','%',

		'+', '-',
		'<<', '>>',

		'<', '>', '<=', '>=', '<=>', 'is', 'in',

		'==', '!=', '=~', '!~',
		'and', 'or',

		'as',

		'->',
		'/@',
		':>',

		'=',

		'IF', 'FOR', 'WHILE', 'REPEAT', 'CASE', 'PIECEWISE', 'VAR', 'BREAK', 'CONTINUE', 'LABEL', 'THROW', 'RETURN',

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



return function (tokens) {

	var Node = function (type, props) {
		var p = props || {};
		p.type = type;
		p.bp = p.bp || 0;
		p.line = curline;
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
	ScopedScript.prototype.useVar = function (name) {
		this.usedVariables[name] = true;
	}
	ScopedScript.prototype.listVar = function () {
		for (var each in this.usedVariables) {
			if (this.usedVariables[each] === true && !(this.variables[each] > 0))
				this.newVar(each);
		};
		for (var i = 0; i < this.nest.length; i++)
			this.nest[i].listVar();
	};
	ScopedScript.prototype.ready = function () {
		if (this.parameters) {
			for (var i = 0; i < this.parameters.names.length; i++) {
				this.newVar(this.parameters.names[i], true)
			}
		}
	};



	var scopes = [], token = tokens[0], next, i = 0, len = tokens.length, workingScopes = [], workingScope, nt = NodeType, curline;
	if (token) curline = token.line;
	function acquire() { };
	var moveNext = function () {
		var t = token;
		acquire();
		i += 1;
		token = tokens[i];
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
			throw new Error('Unexpected token: got' + token);
		if (test !== undefined && token.value !== test)
			throw new Error('Unexpected token: got' + token);
		return moveNext();
	};
	var SQSTART = 91, SQEND = 93, RDSTART = 40, RDEND = 41, CRSTART = 123, CREND = 125;

	var tokenIs = function (t, v) {
		return token && token.type === t && (v ? token.value === v : true);
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
		workingScope.useVar(t.value);
		return new Node(NodeType.VARIABLE,
		{ name: t.value });
	};
	var name = function () {
		var t = advance(ID);
		return new Node(NodeType.VARIABLE,
		{ name: t.value });
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
		advance(OBJECT);
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
		var n = newScope(), s = workingScope;
		workingScope.parameters = p || new Node(nt.PARAMETERS, { names: [], anames: [] });
		workingScope.ready();
		workingScope.code = statements();
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

	// Function literal
	// "function" [Parameters] FunctionBody
	var functionLiteral = function () {
		advance(FUNCTION);
		if (tokenIs(STARTBRACE, RDSTART)) {
			var p = parameters();
		};
		var f;
		if (tokenIs(COLON))
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
		advance(OPERATOR, ':>');
		if (tokenIs(STARTBRACE, CRSTART)) { // statement lambda
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
		if (nextIs(ID) && (shiftIs(2, ENDBRACE, RDEND) && shiftIs(3, OPERATOR, ':>') || shiftIs(2, COMMA))) {
			return true;
		}
		return false;
	}
	var primary = function () {
		ensure(token, 'Unable to get operand: missing token');
		switch (token.type) {
			case ID:
				// x :> BODY
				// lambda
				if (nextIs(OPERATOR, ':>')) {
					var v = name();
					return lambdaCont(new Node(nt.PARAMETERS, {
						names: [v.name],
						anames: []
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
					n.bp = 0;
					n.grouped = true;
					advance(ENDBRACE, 41);
					return n;
				} else if (token.value === CRSTART) {
					// Raw function body
					// with no arguments
					return functionBody(undefined, true);
				}
			case FUNCTION:
				// function literal started with "function"
				return functionLiteral();
			default:
				throw new Error('Unexpected token' + token);
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
		while (tokenIs(DOT) || tokenIs(STARTBRACE, SQSTART)) {
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
		var m = member();
		out: while (
					 tokenIs(STARTBRACE, RDSTART)
					 || tokenIs(STARTBRACE, SQSTART)
					 || tokenIs(DOT)
					 ) {
			switch (token.type) {
				case STARTBRACE:
					if (token.value === RDSTART && token.isLambdaArg) { // lambda looks like an invocation
						break out;
					} else if (token.value === RDSTART && !token.isLambdaArg) { // invocation f(a,b,c...)
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
					}
					continue;
				case DOT:
					advance();
					m = memberitem(m);
					continue;
				default:
			}
		};
		return m;
	};
	var arglist = function (nc) {
		var args = [], names = [], pivot, name, sname, nameused;
		do {
			if ((tokenIs(ID) || tokenIs(STRING)) && nextIs(COLON)) {
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
		} else if (tokenIs(SHARP)) {
			// slot operator
			advance();
			return new Node(nt.MEMBERREFLECT, { left: new Node(nt.ARGUMENTS), right: callExpression() });
		} else {
			return callExpression();
		}
	};

	var bp = {
		'*': 10, '/': 10, '%': 10,
		'+': 20, '-': 20,
		'<<': 25, '>>': 25,
		'<': 30, '>': 30, '<=': 30, '>=': 30, '<=>': 30, 'is': 30, 'in': 30,

		'==': 40, '!=': 40, '=~': 40, '!~': 40,
		'and': 50, 'or': 50,
		'as': 60,
		'/@': 70,
		'->': 80
	};

	var operatorPiece = function (start, progress) {
		// operators.
		// the "->" operator gets a "Rule" object
		// the "is","is in","as",">>","<<" operators are costumizable.
		// Should I remove "/@"?
		var uber = { right: start, bp: 65536 };
		while (tokenIs(OPERATOR) && ensure(bp[token.value] > -65536, "Invalid Operator: " + token)) { // if is a valid operator, then...

			var t = advance(OPERATOR);
			var right = progress();
			var nbp = Math.abs(bp[t.value]), combRight = bp[t.value] < 0;
			var node = new Node(nt[t.value], {
				right: right,
				bp: nbp
			});
			var n = uber;
			while (n.right.bp > nbp)
				n = n.right;
			node.left = n.right;
			n.right = node;
		};
		return uber.right;
	};

	var omissionCall = function (node) {
		while (true) {
			if (!token) return node;
			switch (token.type) {
				case END:
				case SEMICOLON:
				case ENDBRACE:
				case THEN:
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
	}

	var expression = function () {
		// expression.
		// following specifics are supported:
		// - Omissioned calls
		// - "then" syntax for chained calls.
		var pivot = unary(), right, c;
		if (tokenIs(OPERATOR, '=')) { //赋值
			advance();
			return new Node(nt['='], { left: pivot, right: expression(true) });
		}

		if (tokenIs(OPERATOR) && bp[token.value]) {
			c = operatorPiece(pivot, unary);
		} else {
			// processing omissioned calls
			c = pivot
		}
		var method, isOmission = true;

		while (true) {
			if (!token) return c;
			switch (token.type) {
				case END:
				case SEMICOLON:
				case ENDBRACE:
					return c;
				case THEN:
					advance();
					if (tokenIs(DOT)) {
						// |.name chaining
						advance(DOT);
						ensure(token && token.type === ID, 'Missing identifier for Chain invocation');
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
						throw new Error('Invalid Omission Call');
					}
			}
		}
	};
	var callItem = function () {
		var pivot = unary();
		if (tokenIs(OPERATOR))
			pivot = operatorPiece(pivot, unary);
		return pivot;
	};


	var stover = function () {
		return !token || (token.type === SEMICOLON || token.type === END || token.type === ENDBRACE && token.value === CREND);
	}

	var statement = function () {
		// Statements
		/*
		if condition:
		statements
		statements
		else if cond2:
		statement
		else, ontstatement
		end
		*/
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
				throw new Error('Unobtained END,ELSE,WHEN or OTNERWISE');
			case VAR:
				advance();
				return vardecls();
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
			//return new Node(nt.VAR, {
			//	variables: a
			//});
		}
	};
	var vardecl = function () {
		var v = variable();
		workingScope.newVar(v.name);
		return new Node(nt.VARDECL, {
			name: v.name
		});
	};

	var contBlock = function (fin) {
		switch (token.type) {
			case COLON:
				advance();
				var s = statements(fin);
				ensure(tokenIs(fin) || tokenIs(END), 'Unterminated statement block');
				if (tokenIs(END)) advance();
				return s;
			case COMMA:
				advance();
				var s = statement();
				//while (token && token.type === SEMICOLON) advance();
				return s;
			default:
				throw new Error('Flow control body not started with COMMA or COLON');
		}
	};

	var ifstmt = function () {
		advance(IF);
		var n = new Node(nt.IF);
		n.condition = callItem();
		n.thenPart = contBlock(ELSE);
		if (tokenIs(ELSE)) {
			advance(ELSE);
			if (token.type === IF) n.elsePart = ifstmt();
			else n.elsePart = contBlock(END);
		};

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
		if (!t && tokenIs(FALLTHROUGH)) { // is it fallthrough?
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
			throw new Error('The condition of a FOR loop mustn\'t be empty. at:' + token);
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
		var label = name().name;
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
				throw new Error('BREAK statement used a unfound label');
			}
		} else {
			ensure(stover(), 'Something more after BREAK statement');
			return new Node(nt.BREAK, { destination: null });
		}
	};
	var statements = function (fin, fin2) {
		var script = new Node(nt.SCRIPT);
		stripSemicolons();
		var a = [statement()];
		while (tokenIs(SEMICOLON)) {
			curline = token.line;
			stripSemicolons();
			if (token && (token.type === fin || token.type === END || token.type === fin2)) break;
			a.push(statement());
		}
		//ensure(!token || token.type === fin, "Unfinished statement block");
		script.content = a;
		return script;
	};
	newScope();
	workingScope.code = statements();

	return scopes;
};
}();
