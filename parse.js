﻿var formNode = function (n, s) {
	s = s || '';
	if (n == null || !n.type && !(n instanceof Array)) { tracel(n); return }
	if (n instanceof Array)
		tracel('[ARRAY]');
	else if (n.type === NodeType.VARIABLE) {
		tracel('#' + n.name);
		return n;
	}
	else
		tracel('[' + typename[n.type] + ']');
	for (var each in n) if (each !== 'type' && each !== 'bp') {
		trace(s + '+-', each, ': ');
		if (each === 'upper') { tracel('[SCOPE]') }
		else if (each === 'destination' && n[each]) {
			tracel('[[LABEL]]')
		} else {
			formNode(n[each], s + ':  ');
		}
	};

	return n
};

var HAS_DUPL = function (arr) {
	var b = arr.slice(0).sort();
	for (var i = 0; i < b.length - 1; i++)
		if (b[i] && b[i] == b[i + 1])
			return true;
}

var itself = function () { return this };
var typename;
var NodeType = function () {

	var types = typename = [
		'UNKNOWN', 'VARIABLE', 'THIS', 'LITERAL', 'ARRAY', 'ARGUMENTS', 'CALLEE',

		'MEMBER', 'ITEM', 'MEMBERREFLECT',

		'CALL', 'NEW',

		'NEGATIVE', 'NOT',

		'*', '/',

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



var parse = function (tokens) {

	var Node = function (type, props) {
		var p = props || {};
		p.type = type;
		p.bp = p.bp || 0;
		p.line = curline;
		return p
	};
	var ScopedScript = function () {
		this.code = new Node(NodeType.SCRIPT);
		this.variables = [];
		this.labels = {};
		this.upper = null;
		this.type = NodeType.SCOPE;
		this.nest = [];
	};
	ScopedScript.prototype.wash = function (e, g) {
		var r = g || new Nai;
		e[''] = r;
		for (var i = 0; i < this.variables.length; i++) {
			e[this.variables[i]] = r;
		}
		if (this.parameters) for (var i = 0; i < this.parameters.names.length; i++) {
			e[this.parameters.names[i]] = r
		};
	};
	ScopedScript.prototype.locals = function (y, orig) {
		var r = orig || {}
		for (var i = 0; i < this.variables.length; i++) {
			r[this.variables[i]] = y;
		}
		if (this.parameters) for (var i = 0; i < this.parameters.names.length; i++) {
			r[this.parameters.names[i]] = y
		};
		return r;
	};
	ScopedScript.prototype.ready = function () {
		if (!this.parameters) return;
		this.NAMEHAS = [];
		this.NAMEPOS = [];
		for (var i = 0; i < this.parameters.names.length; i++) if (this.parameters.anames[i]) {
			this.NAMEHAS[this.parameters.anames[i]] = 1
			this.NAMEPOS[this.parameters.anames[i]] = i;
		};
		if (this.parameters.names.length === 0) {
			this.place = function (e, a, u, n) { a.names = n };
		}
		if (!this.hasNested) {
			this.wash = function (e, g) {
				var r = g || new Nai;
				e[''] = r;
			}
		}
	}
	ScopedScript.prototype.place = function (e, a, u, n) {
		a = a || [];
		var r = e[''];
		var NAMEHAS = this.NAMEHAS, NAMEPOS = this.NAMEPOS, i;
		if (!u) { // no named parameters used?
			for (i = 0; i < Math.min(a.length, this.parameters.names.length); i++) {
				r[this.parameters.names[i]] = a[i];
			}
			// a.names = [];
		} else {
			var filled = [], resolved = [];
			for (i = 0; i < n.length; i++) if (n[i] != null && NAMEHAS[n[i]] === 1) {
				filled[NAMEPOS[n[i]]] = true; //obtained
				resolved[NAMEPOS[n[i]]] = r[this.parameters.names[NAMEPOS[n[i]]]] = a[i]; //bind name
			}
			// Then, unnamed arguments:
			var p = 0;
			for (i = 0; i < n.length; i++) if (n[i] == null || NAMEHAS[n[i]] !== 1) {
				while (filled[p] === true) p++;
				r[this.parameters.names[p]] = resolved[p] = a[i];
				p++;
			};
			a.names = n;
		}
	}

	var scopes = [], token = tokens[0], next, i = 0, len = tokens.length, workingScopes = [], workingScope, nt = NodeType, curline;
	if (token) curline = token.line;
	var moveNext = function () {
		var t = token;
		i += 1;
		token = tokens[i];
		next = tokens[i + 1];
		if (token) curline = token.line;
		return t;
	};
	var newScope = function () {
		var n = scopes.length;
		var s = new ScopedScript();
		if (workingScope) {
			workingScope.hasNested = true;
			workingScope.nest.push(s);
		}
		s.upper = workingScopes[workingScopes.length - 1];
		s.id = n;
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
			throw new Error('Unexpected token: got' + token + ' but expected ' + new Token(type, test));
		if (test !== undefined && token.value !== test)
			throw new Error('Unexpected token: got' + token + ' but expected ' + new Token(type, test));
		return moveNext();
	};
	var SQSTART = 91, SQEND = 93, RDSTART = 40, RDEND = 41, CRSTART = 123, CREND = 125;

	var variable = function () {
		var t = advance(ID);
		return new Node(NodeType.VARIABLE,
		{ name: t.value });
	};
	var literal = function () {
		var t = advance();
		return new Node(NodeType.LITERAL,
		{ value: t.value });
	};
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
	var thisp = function () {
		var t = advance(ME);
		return new Node(nt.THIS);
	};
	var calleep = function () {
		var t = advance(CALLEE);
		return new Node(nt.CALLEE);
	};
	var thisprp = function () {
		var t = advance(MY);
		var n = variable();
		return new Node(nt.MEMBER, { left: new Node(nt.THIS), right: n });
	};
	var argsp = function () {
		var t = advance(ARGUMENTS);
		return new Node(nt.ARGUMENTS);
	};
	var functionBody = function (p) {
		advance(STARTBRACE, 123);
		var n = newScope();
		workingScope.code = statements();
		workingScope.parameters = p || new Node(nt.PARAMETERS, { names: [], anames: [] });
		endScope();
		advance(ENDBRACE, 125);
		return new Node(nt.FUNCTION, { rc: n });
	};
	var colonBody = function (p) {
		advance(COLON);
		var n = newScope();
		workingScope.code = statements(END);
		workingScope.parameters = p || new Node(nt.PARAMETERS, { names: [], anames: [] });
		endScope();
		advance(END);
		return new Node(nt.FUNCTION, { rc: n });
	};
	var functionLiteral = function () {
		advance(FUNCTION);
		if (token.type === STARTBRACE && token.value === 40) {
			var p = parameters();
		};
		var f;
		if (token.type === COLON)
			f = colonBody(p)
		else
			f = functionBody(p);
		return f;
	};
	var parameters = function () {
		var arr = [], ams = [];
		advance(STARTBRACE, 40);
		if (!(token.type === ENDBRACE && token.value === 41)) {
			if (token.type === STRING) {
				ams[0] = token.value;
				advance();
				arr[0] = variable().name;
			} else {
				ams[0] = null;
				arr[0] = variable().name;
			}
			while (token.type === COMMA) {
				advance(COMMA);
				if (token.type === STRING) {
					ams.push(token.value);
					advance();
					arr[arr.length] = variable().name;
				} else {
					ams[ams.length] = null;
					arr[arr.length] = variable().name;
				}
			};
		};
		advance(ENDBRACE, RDEND);
		ensure(!HAS_DUPL(ams), 'Named parameter list contains duplicate');
		return new Node(nt.PARAMETERS, { names: arr, anames: ams });
	};
	var arrayLiteral = function () {
		advance(STARTBRACE, SQSTART);
		var n = new Node(nt.ARRAY);
		itemlist(n);
		advance(ENDBRACE, SQEND);
		return n;
	};
	var lambdaCont = function (p) {
		var right;
		advance(OPERATOR, ':>');
		if (token.type === STARTBRACE && token.value === 123) { // statement lambda
			right = functionBody();
			scopes[right.rc].parameters = p;
			return right;
		} else {
			var r = newScope();
			right = expression();
			workingScope.code = new Node(nt.RETURN, { expression: right });
			workingScope.parameters = p;
			endScope();
			return new Node(nt.FUNCTION, {
				rc: r
			});
		}
	}
	var primary = function () {
		ensure(token, 'Unable to get operand: missing token');
		switch (token.type) {
			case ID:
				if (token.isLambdaArg) {
					var v = variable();
					return lambdaCont(new Node(nt.PARAMETERS, {
						names: [v.name],
						anames: []
					}));
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
			case STARTBRACE:
				if (token.value === SQSTART) {
					return arrayLiteral();
				} else if (token.value === 40 && token.isLambdaArg) {
					return lambdaCont(parameters());
				} else if (token.value === 40) {
					advance();
					var n = expression(true);
					n.bp = 0;
					n.grouped = true;
					advance(ENDBRACE, 41);
					return n;
				} else {
					return functionBody(undefined, true);
				}
			case FUNCTION:
				return functionLiteral();
			default:
				throw new Error('Unexpected token' + token);
		};
	};
	var memberitem = function (left) {
		var right;
		if (token.type === STARTBRACE && token.value === SQSTART) {  // .[ format
			advance();
			right = expression();
			advance(ENDBRACE, SQEND);
			return new Node(nt.MEMBERREFLECT, { left: left, right: right });
		} else {
			right = variable();
			return new Node(nt.MEMBER, { left: left, right: right });
		}
	}
	var member = function () {
		var node = primary();
		while (token && (token.type === DOT || token.type === STARTBRACE && token.value === SQSTART)) {
			var t = advance();
			if (t.type === DOT) {
				node = memberitem(node);
			} else {
				node = new Node(nt.ITEM, { left: node, item: expression() });
				advance(ENDBRACE, SQEND);
			}
		};
		return node;
	};
	var callExpression = function () {
		var m = member();
		out: while (token && (
			token.type === STARTBRACE && (token.value === 40 || token.value === SQSTART)
			|| token.type === DOT
			|| token.type === FUNCTION)) {
			switch (token.type) {
				case STARTBRACE:
					if (token.value === RDSTART && token.isLambdaArg) { // lambda looks like an invocation
						break out;
					} else if (token.value === RDSTART && !token.isLambdaArg) { // invocation
						advance();
						m = new Node(nt.CALL, {
							func: m
						});
						if (token.type === ENDBRACE && token.value === RDEND) { m.args = []; advance(); continue; };
						arglist(m);
						advance(ENDBRACE, RDEND);
					} else if (token.value === SQSTART) {
						advance();
						m = new Node(nt.ITEM, {
							left: m,
							item: expression()
						});
						advance(ENDBRACE, SQEND);
					} else if (token.value === CRSTART) {
						m = new Node(nt.CALL, {
							func: m,
							args: [functionBody()],
							names: [],
							nameused: false
						});
						break out;
					}
					continue;
				case FUNCTION:
					m = new Node(nt.CALL, {
						func: m,
						args: [functionLiteral()],
						names: [],
						nameused: false
					});
					break out;
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
			if (token && token.type === ID) { // meet an identifier
				if (next && next.type === COLON) {
					name = token.value, sname = true, nameused = true;
					advance();
					advance();
				} else if (next && (next.type === ID || next.type === NUMBER || next.type === STRING || next.type === FUNCTION ||
					next.type === STARTBRACE && next.value === CRSTART || next.type === STARTBRACE && next.value === RDSTART && next.isLambdaArg)) {
					name = token.value, sname = true, nameused = true;
					advance();
				}
			} else if (token && token.type === STRING) {
				if (next && next.type === COLON) {
					name = token.value, sname = true, nameused = true;
					advance();
					advance();
				};
			};


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
		nc.args = args, nc.names = names, nc.nameused = nameused;
	};

	var itemlist = function (nc) {
		var args = [], names = [], pivot, name, sname, nameused;
		if (token.type !== ENDBRACE || token.value !== SQEND)
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
		if (token.type == OPERATOR && (token.value === '-' || token.value === 'not')) {
			var t = advance(OPERATOR);
			var n = callExpression();
			return new Node(t.value === '-' ? nt.NEGATIVE : nt.NOT, { operand: n });
		} else if (token && token.type === SHARP) {
			// slot operator
			advance();
			return new Node(nt.MEMBERREFLECT, { left: new Node(nt.ARGUMENTS), right: callExpression() });
		} else {
			return callExpression();
		}
	};

	var bp = {
		'*': 10, '/': 10,
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
		var uber = { right: start, bp: 65536 };
		while (token && token.type === OPERATOR && ensure(bp[token.value] > -65536, "Invalid Operator: " + token)) { // if is a valid operator, then...

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

	var outmostexp = function () {
		var pivot = unary(), right, c;
		if (token && token.type === OPERATOR && token.value === '=') { //赋值
			advance();
			return new Node(nt['='], { left: pivot, right: expression(true) });
		}

		if (token && token.type === OPERATOR && bp[token.value]) {
			c = operatorPiece(pivot, unary);
		} else {
			// processing omissioned calls
			if (pivot.type === nt.CALL)
				c = pivot
			else
				c = new Node(nt.CALL, {
					func: pivot,
					args: [],
					omission: true
				});
		}

		while (true) {
			if (!token) return c;
			switch (token.type) {
				case END:
				case SEMICOLON:
				case ENDBRACE:
					return c;
				case THEN:
					advance();
					if (token && token.type === DOT) advance(DOT);
					ensure(token && token.type === ID, 'Missing identifier for Chain invocation');
					var method = variable();
					c = new Node(nt.CALL, {
						func: new Node(nt.MEMBER, {
							left: c,
							right: method,
							omission: true
						}),
						args: []
					});
					break;
				default:
					if (c.type !== nt.CALL || !c.omission)
						c = new Node(nt.CALL, { func: c, args: [] })
					arglist(c);
			}
		}
	};
	var expression = function (inside) {
		var pivot = unary(), right, c;
		if (token && token.type === OPERATOR && token.value === '=') { //赋值
			advance();
			return new Node(nt['='], { left: pivot, right: expression(true) });
		}

		if (token && token.type === OPERATOR && bp[token.value]) {
			return operatorPiece(pivot, unary);
		} else if (!token || token && (token.type === SEMICOLON || token.type === END || token.type === ENDBRACE)) {
			return pivot;
		} else {
			//c = new Node(nt.CALL, { func: pivot, args: [], omission: true });
			c = pivot
			while (true) {
				if (!token) return c;
				switch (token.type) {
					case END:
					case SEMICOLON:
					case ENDBRACE:
						return c;
					case THEN:
						advance();
						if (token && token.type === DOT) advance(DOT);
						ensure(token && token.type === ID, 'Missing identifier for Chain invocation');
						var method = variable();
						c = new Node(nt.CALL, {
							func: new Node(nt.MEMBER, {
								left: c,
								right: method
							}),
							args: [],
							omission: true
						});
						break;
					default:
						if (c.type !== nt.CALL || !c.omission)
							c = new Node(nt.CALL, { func: c, args: [], omission: true })
						arglist(c);
				};
			};
		};
	};

	var callItem = function () {
		var pivot = unary();

		if (token && token.type === OPERATOR && token.value === ':>' && pivot.type === nt.PARAMETERS) { //lambda表达式
			advance(OPERATOR, ':>');
			if (token.type === STARTBRACE && token.value === 123) { // statement lambda
				right = functionBody();
				scopes[right.rc].parameters = pivot;
				pivot = right;
			} else {
				var r = newScope();
				right = callItem();
				workingScope.code = new Node(nt.RETURN, { expression: right });
				workingScope.parameters = pivot;
				endScope();
				return new Node(nt.FUNCTION, {
					rc: r
				});
			}
		};
		if (token && token.type === OPERATOR)
			pivot = operatorPiece(pivot, unary);
		return pivot;
	};


	var stover = function () {
		return !token || (token.type === SEMICOLON || token.type === END || token.type === ENDBRACE && token.value === CREND);
	}

	var statement = function () {
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
				return outmostexp();
		};
	};
	var vardecls = function () {
		if (next.type === OPERATOR && next.value === "=") { // assigned variable
			var v = variable();
			workingScope.variables.push(v.name);
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
		workingScope.variables.push(v.name);
		return new Node(nt.VARDECL, {
			name: v.name
		});
	};

	var contBlock = function (fin) {
		switch (token.type) {
			case COLON:
				if ((next && next.type === SEMICOLON) || token.sbreak) {
					advance();
					var s = statements(fin);
					ensure(token && (token.type === fin || token.type === END), 'Unterminated statement block');
					if (token.type === END) advance();
					return s;
				} else {
					throw new Error('A multi-line control body must follow a semicolon or line break after the colon.' + 'around ' + token);
				}
			case COMMA:
				if (token.sbreak)
					throw new Error('A single-line control body must follow DO tightly.' + 'around ' + token);
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
		expectSemicolons(ELSE);
		if (token && token.type === ELSE) {
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
		while (token && token.type === SEMICOLON) advance();
	};
	var expectSemicolons = function (T) {
		var k = i, t = tokens[i];
		while (true) {
			if (t && t.type === SEMICOLON) {
				k = k + 1;
				t = tokens[k];
			} else if (t && t.type === T) {
				i = k;
				token = tokens[i];
				next = tokens[i + 1];
				return;
			} else {
				return;
			}
		}
	};
	var piecewise = function (t) {
		var n = new Node(t ? nt.CASE : nt.PIECEWISE);
		n.conditions = [], n.bodies = [];
		advance();
		if (!t && token.type === FALLTHROUGH) { // is it fallthrough?
			n.fallThrough = true;
			advance();
		};
		if (t) {
			n.expression = callItem();
		};
		advance(COLON);
		stripSemicolons();
		ensure(token, 'Unterminated piecewise/case block');
		while (token.type === WHEN || token.type === OTHERWISE) {
			if (token.type === WHEN) {
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
		ensure(token && token.type === ID);
		var name = variable().name;
		ensure(!workingScope.labels[name] && workingScope.labels[name] !== 0, 'Unable to re-label a statement');
		var node = new Node(nt.LABEL, {
			name: name
		});
		workingScope.labels[name] = node;
		node.body = contBlock();
		workingScope.labels[name] = 0;
		return node;
	};
	var brkstmt = function () {
		advance(BREAK);
		if (token.type === ID) {
			var name = token.value;
			advance();
			if (workingScope.labels[name] && workingScope.labels[name].type === nt.LABEL) {
				ensure(stover(), 'Something more after BREAK statement');
				return new Node(nt.BREAK, { destination: workingScope.labels[name] });
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
		while (token && token.type === SEMICOLON) {
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