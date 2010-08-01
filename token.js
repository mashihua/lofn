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
	FALLTHROUGH = 33;


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
//	'then': THEN,
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
	'callee':CALLEE
};
var nameType = function (name) {
	if (typeof nameTypes[name] === 'number')
		return nameTypes[name]
	else
		return ID;
};


var CharacterGroup = function (accepts) {
	var ACCEPT = [], YES = {};
	for (var i = 0; i < accepts.length; i++)
		ACCEPT[accepts.charCodeAt(i)] = YES;
	return function (n) {
		return ACCEPT[n] === YES
	}
};

var 
	letter = CharacterGroup('abcdefghijklmnopqrstuvwxyz_$QWERTYUIOPASDFGHJKLZXCVBNM'),
	number = CharacterGroup('1234567890'),
	operatorStart = CharacterGroup('+-*/<>=!:'),
	operatorCont = CharacterGroup('=<>~@'),
	lineBreak = CharacterGroup('\n'),
	singleQuote = CharacterGroup('\''),
	doubleQuote = CharacterGroup('"'),
	backQuote = CharacterGroup('`'),
	doubleQuoteSpecial = CharacterGroup('"\\'),
	backSlash = CharacterGroup('\\'),
	zero = CharacterGroup('0'),
	x = CharacterGroup('x'),
	hex = CharacterGroup('123456789abcdefABCDEF'),
	dot = CharacterGroup('.'),
	e = CharacterGroup('e'),
	posneg = CharacterGroup('+-'),
	braceStart = CharacterGroup('([{'),
	braceEnd = CharacterGroup(')]}'),
	blank = CharacterGroup(' \t'),
	comma = CharacterGroup(','),
	semi = CharacterGroup(';'),
	colon = CharacterGroup(':'),
	sharp = CharacterGroup('#'),
	theng = CharacterGroup('|'),
	slash = CharacterGroup('/');

var Token = function (type, value, p, pp) {
	this.type = type;
	this.value = value;
	this.position = p;
	this.piece = pp;
};
Token.prototype.toString = function () {
	return '[' + (this.type + ' ') + this.value
	+ (this.isLambdaArg ? '*' : '')
	+ ']' + (this.position ? '(at ' + this.position + ':' + this.piece + ')' : '');
};
var ensure = function (cond, message) {
	if (!cond)
		throw new Error(message);
	return true;
};

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
}
var LofnUnescape = function (str) {
	return str.replace(/\\(\\|n|"|t|v|u[a-fA-F0-9]{4})/g, condF);
};

var lex = function (source) {
	var len = source.length, i = 0, j, current = 0, conti = true, line = 1;
	var tokens = [];
	var token = function (t, v) {
		var k;
		if (t === THEN) removeImplicitSemicolons();
		k = new Token(t, v, i, source.slice(Math.max(0, i - 10), i + 10))
		k.line = line;
		tokens.push(k);
		conti = (t === OPERATOR || t === COMMA || t === STARTBRACE || t === SEMICOLON || t === COLON);
	};
	var braces = [];
	var startBrace = function () {
		braces.push(tokens.length - 1);
		conti = true;
	};
	var endBrace = function () {
		var p = braces.pop();
		tokens[tokens.length - 1].match = p;
		tokens[p].match = tokens.length - 1;
		tokens[p].depth = tokens[tokens.length - 1].depth = braces.length;
	};

	var next = function (p) {
		return source.charCodeAt((p || i) + 1);
	};
	var move = function () { i++; current = source.charCodeAt(i) };

	var scan = function (how, what) {
		j = i;
		do {
			j += 1, current = source.charCodeAt(j)
		} while (isFinite(current) && how(current, j));
		what(i, j, source.slice(i, j));
		i = j;
	};

	var removeImplicitSemicolons = function () {
		while (tokens.length && tokens[tokens.length - 1].type === SEMICOLON && tokens[tokens.length - 1].value === 0) {
			tokens.pop();
		};
	};

	while (i < len) {
		current = source.charCodeAt(i);
		if (backSlash(current)) {
			conti = true;
		} else if (letter(current)) { // name
			scan(function (c) { return letter(c) || number(c) },
			function (i, j, s) {
				if (s === 'in' && tokens[tokens.length - 1].type === OPERATOR && tokens[tokens.length - 1].value === 'is') { // special processing for "in"
					tokens[tokens.length - 1].value = 'in';
					return;
				}
				token(nameType(s), s)
			});
			continue;
		} else if (slash(current) && slash(next())) { //comment
			move();
			scan(function (c) { return !lineBreak(c) }, function () { });
			continue;
		} else if (dot(current)) {
			removeImplicitSemicolons();
			token(DOT, 0);
		} else if (colon(current) && !operatorCont(next())) {
			removeImplicitSemicolons();
			token(COLON, 0);
		} else if (sharp(current)) {
			token(SHARP, '#');
		} else if (theng(current)) {
			removeImplicitSemicolons();
			token(THEN, 'then');
		} else if (operatorStart(current)) { //operator
			scan(operatorCont, function (i, j, s) {
				token(OPERATOR, s);
				if (s === ':>') {
					if (tokens[tokens.length - 2].type === ID)
						tokens[tokens.length - 2].isLambdaArg = true;
					else if (tokens[tokens.length - 2].type === ENDBRACE && tokens[tokens.length - 2].value === 41)
						tokens[tokens[tokens.length - 2].match].isLambdaArg = true;

				}
			});
			continue;
		} else if (singleQuote(current)) { //single quote
			j = i;
			do {
				j += 1, current = source.charCodeAt(j)
			} while (ensure(j < len, 'Unfinished string') &&
			(!singleQuote(current) || (singleQuote(current) && singleQuote(next(j)) && j++)));
			token(STRING, source.slice(i + 1, j).replace(/''/g, '\''));
			i = j + 1;
			continue;
		} else if (doubleQuote(current)) { //double quote
			j = i;
			do {
				j += 1, current = source.charCodeAt(j)
			} while (ensure(j < len, 'Unfinished string') &&
			(!doubleQuoteSpecial(current) || (backSlash(current) && ensure(j++ < len))));
			token(STRING, LofnUnescape(source.slice(i + 1, j)));
			i = j + 1;
			continue;
		} else if (backQuote(current)) {
			move();
			scan(function (c) { return letter(c) || number(c) },
			function (i, j, s) {
				token(STRING, s)
			});
			continue;
		} else if (number(current)) { //number
			if (zero(current) && x(next())) { //hexical?
				i += 2;
				scan(hex, function (i, j, s) { token(NUMBER, parseInt(s, 16)) });
			} else {
				var digits;
				scan(number, function (i, j, s) { digits = s });
				if (dot(current) && number(next())) {
					i++;
					scan(number, function (i, j, s) { digits += '.' + s });
					if (e(current) && number(next())) {
						move();
						digits += 'e'
						if (posneg(current)) {
							digits += String.fromCharCode(current);
						};
						move();
						scan(number, function (i, j, s) { digits += s });
						token(NUMBER, parseFloat(digits));
					} else {
						token(NUMBER, parseFloat(digits));
					}
				} else {
					token(NUMBER, parseInt(digits, 10));
				}
			};
			continue;
		} else if (comma(current)) {
			removeImplicitSemicolons();
			token(COMMA, 0);
		} else if (semi(current)) {
			removeImplicitSemicolons();
			token(SEMICOLON, 1);
		} else if (braceStart(current)) {
			token(STARTBRACE, current);
			startBrace();
		} else if (braceEnd(current)) {
			removeImplicitSemicolons();
			token(ENDBRACE, current);
			endBrace();
		} else if (lineBreak(current)) {
			line++;
			if (conti) {
				tokens[tokens.length - 1].sbreak = true;
			} else
				token(SEMICOLON, 0);
		};
		i++;
	}
	return tokens
}