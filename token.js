// token types
var 
	CONSTANT = -1,
	ME = -2,
	MY = -3,
	CALLEE = -4,
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
	SHARP = 35,
	FALLTHROUGH = 33,
	OBJECT = 34


var nameTypes = {
	'is': OPERATOR, 'and': OPERATOR, 'not': OPERATOR, 'or': OPERATOR,
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
	'object': OBJECT
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
	':>': OPERATOR,
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
	';': SEMICOLON
};
var symbolType = function (m) {
	if (symbolTypes[m] > -65536)
		return symbolTypes[m]
	else
		throw new Error('Unspecified symbol '+m)
}

var lex = lofn.lex = function () {
	var Token = function (t, v) {
		this.type = t;
		this.value = v
	}
	Token.prototype.toString = function () {
		return '[' + this.value + ']'
	}
	var condF = function (match, $1) {
		if ($1.length > 1) {
			return String.fromCharCode(parseInt($1.slice(1), 16));
		} else {
			return {
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
	return function (input) {
		var tokens = [], tokl = 0;
		var make = function (t, v) {
			contt = false;
			tokens[tokl++] = new Token(t, v);
		};
		var contt = false;
		var noImplicits = function () {
			while (tokens[tokl - 1].type === SEMICOLON && tokens[tokl - 1].value === 0) tokl--;
		}
		var p_symbol = function (s) {
			var t = symbolType(s);
			switch (t) {
				case OPERATOR:
				case COMMA:
				case THEN:
				case DOT:
					noImplicits();
				case COLON:
					make(t, s);
					contt = true;
					break;

				case STARTBRACE:
					make(t, s.charCodeAt(0));
					contt = true;
					break;
				case ENDBRACE:
					noImplicits();
					make(t, s.charCodeAt(0));
					break;

				case SEMICOLON:
					make(t, 1);
					contt = true;
					break;
			}
		}
		0, input.replace(
			(/(\/\/[^\n]*)|([a-zA-Z_$][\w$]*)|(`[a-zA-Z_$][\w$])|('[^']*(?:''[^']*)*')|("[^\\"]*(?:\\.[^\\"]*)*")|((?:0x[a-fA-F0-9]+)|(?:\d+(?:\.\d+(?:[eE]-?\d+)?)?))|([+\-*\/<>=!:%~,.;#]+|[()\[\]\{\}|])|(\n\s*)/g),
			function (match, comment, nme, reflects, singles, doubles, number, symbol, newline) {
				if (nme) {
					make(nameType(match), match)
				} else if (reflects) {
					make(STRING, match.slice(1));
				} else if (singles) {
					make(STRING, match.slice(1, -1).replace(/''/g, "'"));
				} else if (doubles) {
					make(STRING, lfUnescape(match.slice(1, -1)));
				} else if (number) {
					make(NUMBER, (match - 0));
				} else if (symbol) {
					p_symbol(match);
				} else if (newline) {
					if (!contt) make(SEMICOLON, 0);
					contt = false;
				}
				return ''
			});
		return tokens;
	}
} ();
