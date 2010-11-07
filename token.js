// token types
var 
	CONSTANT = 101,
	ME = 102,
	MY = 103,
	CALLEE = 104,
	ID = 0,
	OPERATOR = 1,
	COLON = 2,
	COMMA = 3,
	NUMBER = 4,
	STRING = 5,
	SEMICOLON = 6,
	STARTBRACE = 7,
	ENDBRACE = 8,
	DOT = 9,
// --- STATEMENTS ---
	IF = 10,
	FOR = 11,
	WHILE = 12,
	REPEAT = 13,
	UNTIL = 14,
	ARGUMENTS = 15,
	CASE = 18,
	PIECEWISE = 19,
	WHEN = 20,
	FUNCTION = 21,
	RETURN = 22,
	THROW = 23,
	BREAK = 24,
	CONTINUE = 25,
	LABEL = 26,
	STEP = 27,
	END = 28,
	ELSE = 29,
	OTHERWISE = 30,
	THEN = 31,
	VAR = 32,
	SHARP = 33,
	FALLTHROUGH = 34,
	OBJECT = 35,
	DO = 36,
	TRY = 37,
	CATCH = 38,
	FINALLY = 39,
	TASK = 40,		//reserved for coro
	LAMBDA = 41,
	PASS = 42,
	BACKSLASH = 501;

var lex = lofn.lex = function () {
	var Token = function (t, v, p, l, s, i) {
		this.type = t;
		this.value = v;
		this.position = p;
		this.line = l;
		this.spaced = s;
		this.isName = i;
	}
	Token.prototype.toString = function () {
		return '~' + this.type + '[' + this.value + ']'
	}
	var condF = function (match, $1) {
		if ($1.length > 1) {
			return String.fromCharCode(parseInt($1.slice(1), 16));
		} else {
			return {
				'r': '\r',
				'n': '\n',
				'\\': '\\',
				'"': '"',
				't': '\t',
				'v': '\v'
			}[$1];
		}
	};
	var lfUnescape = function (str) {
		return str.replace(/\\(\\|n|"|t|v|u[a-fA-F0-9]{4})/g, condF);
	};
	var REPSTR = function(){
		var cache = [];
		return function(n){
			if(cache[n]) return cache[n];
			if(n <= 0) return '';
			if(n <= 1) return 'T';
			var q = REPSTR(n >>> 1);
			q += q;
			if (n & 1) q += 'T';
			return cache[n] = q;
		};
	}();
	var nameTypes = {
		'is': OPERATOR, 'and': OPERATOR, 'not': OPERATOR, 'or': OPERATOR, 'in': OPERATOR, 'of': OPERATOR,
		'as': OPERATOR,
		'if': IF,
		'for': FOR,
		'while': WHILE,
		'repeat': REPEAT,
		'until': UNTIL,
		'case': CASE,
		'piecewise': PIECEWISE,
		'when': WHEN,
		'function': FUNCTION,
		'return': RETURN,
		'throw': THROW,
		'break': BREAK,
		'continue': CONTINUE,
		'label': LABEL,
		'end': END,
		'else': ELSE,
		'otherwise': OTHERWISE,
		'then': THEN,
		'var': VAR,
		'me': ME,
		'this': ME,
		'my': MY,
		'true': CONSTANT,
		'false': CONSTANT,
		'null': CONSTANT,
		'undefined': CONSTANT,
		'fallthrough': FALLTHROUGH,
		'arguments': ARGUMENTS,
		'callee': CALLEE,
		'object': OBJECT,
		'do': DO,
		'try': TRY,
		'catch': CATCH,
		'finally': FINALLY,
		'Task': TASK,
		'pass': PASS
	};
	var nameType = function (m) {
		if (nameTypes[m] > -65536)
			return nameTypes[m]
		else
			return ID
	};
	var symbolTypes = {
		'+': OPERATOR,
		'-': OPERATOR,
		'*': OPERATOR,
		'/': OPERATOR,
		'%': OPERATOR,
		'<': OPERATOR,
		'>': OPERATOR,
		'=': OPERATOR,
		'+=': OPERATOR,
		'-=': OPERATOR,
		'*=': OPERATOR,
		'/=': OPERATOR,
		'<<=': OPERATOR,
		'>>=': OPERATOR,
		'%=': OPERATOR,
		'<=': OPERATOR,
		'>=': OPERATOR,
		'<<': OPERATOR,
		'>>': OPERATOR,
		'<=>': OPERATOR,
		'==': OPERATOR,
		'!=': OPERATOR,
		'===': OPERATOR,
		'!==': OPERATOR,
		'=~': OPERATOR,
		'!~': OPERATOR,
		'->': OPERATOR,
		':>': LAMBDA,
		'#': SHARP,
		'(': STARTBRACE,
		'[': STARTBRACE,
		'{': STARTBRACE,
		'}': ENDBRACE,
		']': ENDBRACE,
		')': ENDBRACE,
		',': COMMA,
		':': COLON,
		'|': THEN,
		'.': DOT,
		';': SEMICOLON,
		'@': MY,
		'\\': BACKSLASH
	};
	var symbolType = function (m) {
		if (symbolTypes[m] > -65536)
			return symbolTypes[m]
		else
			throw new Error('Unspecified symbol '+m)
	};

	var token_err = function(message, pos, source){
		var lineno = ('\n' + source.slice(0, pos)).match(/\n/g).length;
		var lineno_l = lineno.toString().length;
		message = '[LFC] ' + message + '\nat line: ' + lineno;
		message += '\n ' + lineno + ' : ' + (source.split('\n')[lineno - 1]);
		message += '\n-' + (lineno + '').replace(/./g, '-') + '---' + (source.slice(0, pos).split('\n')[lineno - 1].replace(/./g, '-').replace(/$/, '^'));

		var e = new Error(message);
		return e;
	};

	return function (input) {
		var tokens = [], tokl = 0, line = 0, options = {};
		var make = function (t, v, p, as, isn) {
			contt = false;
			tokens[tokl++] = new Token(t, v, p, line, as, isn);
		};
		var option = function(name){
			options[name] = true
		};
		var contt = false;
		var noImplicits = function () {
			while (tokens[tokl - 1] && tokens[tokl - 1].type === SEMICOLON && tokens[tokl - 1].value === 0) tokl--;
		}
		var noSemicolons = function(){
			while (tokens[tokl - 1] && tokens[tokl - 1].type === SEMICOLON) tokl--;
		}
		var p_symbol = function (s, n) {
			var t = symbolType(s);
			switch (t) {
				case OPERATOR:
				case LAMBDA:
				case COMMA:
				case THEN:
				case DOT:
					noImplicits();
				case COLON:
					make(t, s, n);
					contt = true;
					break;

				case SHARP:
				case MY:
					make(t, s, n);
					break;

				case STARTBRACE:
					make(t, s.charCodeAt(0), n, input.charAt(n-1) === ' ' || input.charAt(n-1) === '\t');
					contt = true;
					break;

				case ENDBRACE:
					noImplicits();
					make(t, s.charCodeAt(0), n);
					break;

				case SEMICOLON:
					noImplicits();
					make(t, 1, n);
					contt = true;
					break;

				case BACKSLASH:
					contt = true;
					break;
			}
		}
		var ou = input.replace(
			(/(\/\/.*)|(?:^![ \t]*option[ \t]+(\w+)[ \t]*$)|([a-zA-Z_$][\w$]*)|(`[a-zA-Z_$][\w$]*)|('[^']*(?:''[^']*)*')|("[^\\"]*(?:\\.[^\\"]*)*")|((?:0[xX][a-fA-F0-9]+)|(?:\d+(?:\.\d+(?:[eE]-?\d+)?)?))|([+\-*\/<>=!:%][<>=~]*|[()\[\]\{\}|@\\;,\.#])|(\n\s*)/mg),
			function (match, comment, optionname, nme, reflects, singles, doubles, number, symbol, newline, n, full) {
				after_space = false;
				if(optionname) {
					option(optionname);
				} if (nme) {
					make(nameType(match), match, n, false, true)
				} else if (reflects) {
					make(STRING, match.slice(1), n);
				} else if (singles) {
					make(STRING, match.slice(1, -1).replace(/''/g, "'"), n);
				} else if (doubles) {
					make(STRING, lfUnescape(match.slice(1, -1)), n);
				} else if (number) {
					make(NUMBER, (match.replace(/^0+([1-9])/, '$1') - 0), n);
				} else if (symbol) {
					p_symbol(match, n);
				} else if (newline) {
					if (!contt) make(SEMICOLON, 0, n);
					contt = false;
				}
				return REPSTR(match.length);
			});
		var ep;
		if((ep = ou.indexOf('\'')) >= 0) {
			throw token_err('Unmatched quotations encountered' , ep, input)
		} else if ((ep = ou.indexOf('"')) >= 0) {
			throw token_err('Unmatched quotations encountered', ep, input)
		}

		return {
			tokens : tokens,
			options: options
		}
	}
} ();
