var _script_line = 0;
var __temp;

var vmSchemata = [];
var nt = NodeType;
var schemata = function (tf, trans) {
	vmSchemata[tf] = trans;
};
// marco
var GET = function (n) {
	return '((__temp=env[' + n + '])?__temp[' + n + ']:noth)'
}
var SET = function (n, val) {
	return '((__temp=env[' + n + '])?__temp[' + n + ']=' + val + ':(env[' + n + ']=lvs,lvs[' + n + ']=' + val + '))'
}

var GETV = function(node){
	return '_$'+node.depth+'$'+node.name;
}
schemata(nt.SCRIPT, function (n) {
	var a = [];
	for (var i = 0; i < n.content.length; i++)
		if (n.content[i]) {
			a[2 * i + 1] = transform(n.content[i]);
			a[2 * i] = '_script_line = ' + n.content[i].line;
		}
	return a.join(';\n');
});
schemata(nt['='], function (n, l) {
	switch (this.left.type) {
		case nt.ITEM:
			return 'MINVOKE(' + transform(this.left.left) + ',"itemset",false,null,' + transform(this.left.item) + ',' + transform(this.right) + ')';
		case nt.MEMBER:
			return '((' + transform(this.left.left) + ')[' + strize(this.left.right.name) + ']=(' + transform(this.right) + '))';
		case nt.MEMBERREFLECT:
			return '((' + transform(this.left.left) + ')[' + transform(this.right) + ']=(' + transform(this.right) + '))';
		case nt.VARIABLE:
			if (l[this.left.name] === YES)
				return 'lvs[' + strize(this.left.name) + ']=(' + transform(this.right) + ')'
			else
				return SET(strize(this.left.name), '(' + transform(this.right) + ')');
		default:
			throw new Error('Invalid assignment left value: only VARIABLE, MEMBER, MEMBERREFLECT or ITEM avaliable');
	}
});
var SPECIALNAMES = {
	'class': 1,
	'new': 1,
	'try': 1,
	'catch': 1,
	'finally': 1,
	'typeof': 1,
	'instanceof': 1,
	'class': 1,
	'do': 1
};
schemata(nt.MEMBER, function () {
	var memberName = this.right.name;
	if (SPECIALNAMES[memberName] === 1)
		return '(MBRCHK(' + transform(this.left) + '))["' + memberName + '"]';
	return '(MBRCHK(' + transform(this.left) + ')).' + memberName;
});
schemata(nt.MEMBERREFLECT, function () {
	var memberName = this.right.name;
	return '(MBRCHK(' + transform(this.left) + '))[' + transform(this.right) + ']';
});
schemata(nt.ITEM, function () {
	return 'MINVOKE(' + transform(this.left) + ',"item",false,null,' + transform(this.item) + ')';
});
schemata(nt.VARIABLE, function (n, l) {
	return GETV(n);
});
schemata(nt.THIS, function () {
	return 'thisptr';
});
schemata(nt.ARGUMENTS, function () {
	return 'args';
});
schemata(nt.CALLEE, function () {
	return '__callee';
});
schemata(nt.PARAMETERS, function () {
	throw new Error('Unexpected parameter group');
});
var CTRLCHR = function (c) {
	var n = c.charCodeAt(0);
	return '\\x' + (n > 15 ? n.toString(16) : '0' + n.toString(16));
}
var strize = function (s) {
	return '"' + (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\x00-\x1f\x7f]/g, CTRLCHR) + '"';
};
schemata(nt.CALL, function () {
	var comp;
	switch (this.func.type) {
		case nt.MEMBER:
			comp = 'MINVOKE(' + transform(this.func.left) + ',' + strize(this.func.right.name);
			break;
		case nt.MEMBERREFLECT:
			comp = 'MINVOKE(' + transform(this.func.left) + ',' + transform(this.func.right);
			break;
		case nt.ITEM:
			comp = 'IINVOKE(' + transform(this.func.left) + ',' + transform(this.func.item);
			break;
		default:
			comp = 'DINVOKE(' + transform(this.func) + ',null';
	};
	var args = [], names = [];
	for (var i = 0; i < this.args.length; i++) {
		args[i] = ',' + transform(this.args[i]);
		if (this.names[i])
			names[i] = strize(this.names[i]);
		else
			names[i] = 'null';
	}
	if (this.nameused) {
		comp += ',true,' + '[' + names.join(',') + ']';
	} else {
		comp += ',false,null'
	}
	comp += args.join('') + ')';
	return comp;
});
schemata(nt.ARRAY, function () {
	var comp = '(';
	var args = [], names = [];
	for (var i = 0; i < this.args.length; i++) {
		args[i] = transform(this.args[i]);
	};
	comp += '[' + args.join(',') + '])';
	return comp;
});
schemata(nt.LITERAL, function () {
	if (typeof this.value === 'string') {
		return strize(this.value);
	} else
		return '' + this.value;
});

var binoper = function (operator, tfoper) {
	schemata(nt[operator], function () {
		return '(' + transform(this.left) + ')' + tfoper + '(' + transform(this.right) + ')';
	});
};
var methodoper = function (operator, method) {
	schemata(nt[operator], function () {
		return 'MINVOKE(' + transform(this.right) + ',' + strize(method) + ',false,null,' + transform(this.left) + ')';
	});
};

binoper('+', '+');
binoper('-', '-');
binoper('*', '*');
binoper('/', '/');
binoper('<', '<');
binoper('>', '>');
binoper('<=', '<=');
binoper('>=', '>=');
binoper('==', '===');
binoper('=~', '==');
binoper('!=', '!==');
binoper('!~', '!=');
methodoper('in', 'contains');
methodoper('is', 'be');
methodoper('as', 'convertFrom');
methodoper('>>', 'acceptShiftIn');
schemata(nt['<=>'], function () {
	return 'MINVOKE(' + transform(this.left) + ',"compareTo",false,null,' + transform(this.right) + ')';
});
schemata(nt['<<'], function () {
	return 'MINVOKE(' + transform(this.left) + ',"shiftIn",false,null,' + transform(this.right) + ')';
});
schemata(nt['/@'], function () {
	return 'MINVOKE(' + transform(this.left) + ',"map",false,null,' + transform(this.right) + ')';
});

var __gTEMP;
schemata(nt['and'], function () {
	return '(__gTEMP = (' + transform(this.left) + '), !__gTEMP ? __gTEMP : ' + transform(this.right) + ')';
});
schemata(nt['or'], function () {
	return '(__gTEMP = (' + transform(this.left) + '), __gTEMP ? __gTEMP : ' + transform(this.right) + ')';
});

schemata(nt['->'], function () {
	return 'CREATERULE(' + transform(this.left) + ',' + transform(this.right) + ')';
});
schemata(nt.NEGATIVE, function () {
	return '-(' + transform(this.operand) + ')';
});
schemata(nt.NOT, function () {
	return '!(' + transform(this.operand) + ')';
});

schemata(nt.FUNCTION, function () {
	return 'CREATEFUNCTION(env,cache,' + this.rc + ')';
});

schemata(nt.RETURN, function () {
	return 'return ' + transform(this.expression);
});
schemata(nt.THROW, function () {
	return 'throw ' + transform(this.expression);
});
schemata(nt.IF, function () {
	var s = 'if (' + transform(this.condition) + ')';
	s += '{\n' + transform(this.thenPart) + '\n}';
	if (this.elsePart) {
		s += 'else {\n' + transform(this.elsePart) + '\n}';
	}
	return s;
});
schemata(nt.PIECEWISE, function () {
	var a = []; cond = '';
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
			if (!this.fallThrough) s += ';\nbreak; \n}'
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

var loc;
var transform = function (node) {
	if (vmSchemata[node.type]) {
		return vmSchemata[node.type].call(node, node, loc);
	} else {
		return '{!UNKNOWN}';
	}
}
var createFromTree = function (tree, genv) {
	loc = tree.locals;
	var s = "var lvs = env[''], __temp;\n" + transform(tree.code);
	var f = new Function('env,cache,thisptr,args,__callee', s);
	tree.func = f;
	tree.transformed = s;
};


var DIRECTINVOKE = {}, MEMBERINVOKE = {}, ITEMINVOKE = {};
// lofn primitives
var INVOKE = function (pivot, im, shift, args, nameused, names) {
	var f, tp;
	switch (im) {
		// get the invocation metadata             
		case DIRECTINVOKE:
			f = pivot, tp = shift;
			break;
		case MEMBERINVOKE:
			f = MBRCHK(pivot)[shift], tp = pivot;
			break;
		case ITEMINVOKE:
			f = INVOKE(pivot, MEMBERINVOKE, 'item', [shift], false), tp = pivot;
			break;
	};

	if (!f) {
		throw new Error('Unable to invoke null or undefined');
	}

	if (f.external) {
		// an external function, invoke directly
		return f.apply(tp, args);
	} else {
		return f(tp, args, nameused, names);
	}
};

var INVOKEP = function (f, tp, args, nu, names) {
	if (f.external)
		return f.apply(tp, args)
	else
		return f(NUSED, tp, args, nu, names)
}
var DINVOKE = function (pivot, shift, nameused, names) {
	return INVOKEP(pivot, shift, SLICE(arguments, 4), nameused, names);
}
var MINVOKE = function (p, s, u, n) {
	return INVOKEP(p[s], p, SLICE(arguments, 4), u, n)
}
var IINVOKE = function (p, s, u, n) {
	return INVOKEP(INVOKEP(p.item, p, [s], false), p, SLICE(arguments, 4), u, n);
}

var LofnFunctionCSTR = function () {
	return '[Lofn function]';
}
var CREATEFUNCTION = function (env, cache, RCid) {
	var RC = ScriptScopes[RCid], cc = RC.hasNested ? function () { return [] } : function () { return null };
	if (cache[RCid])
		return cache[RCid]
	else {
		var f = function (ck, t, a, u, n) {
			var e = derive(env);
			RC.wash(e);
			if (ck !== NUSED) {
				RC.place(e, arguments);
				return RC.func(e, cc(), this, arguments, f);
			} else {
				RC.place(e, a, u, n);
				return RC.func(e, cc(), t, a, f);
			}
		};
		f.external = false;
		f.toString = LofnFunctionCSTR;
		// Hack!
		// it may be dangerous.
		f.apply = function (thisp, args, nms) {
			if (arguments.length > 2)
				return this(thisp, args.slice(0), true, nms)
			else
				return this(thisp, args.slice(0), false);
		}
		f.call = function (thisp, args) {
			return this(thisp, Array.prototype.slice.call(arguments, 1));
		}
		cache[RCid] = f;
	}
	return f;
};

var lofnize = function (M, p) {
	p = p || [];
	var NAMEHAS = {}, NAMEPOS = {}, YES = {};
	for (var i = 0; i < p.length; i++) {
		NAMEHAS[p[i]] = YES
		NAMEPOS[p[i]] = i;
	};
	// f accepts thisptr (t) and arguments (a). No environments (e) needed;
	var f = function (ck, t, a, u, n) {
		var i;
		if (u) {
			var filled = [], resolved = [];
			for (i = 0; i < n.length; i++) if (n[i] != null && NAMEHAS[n[i]] == YES) {
				filled[NAMEPOS[n[i]]] = true; //obtained
				resolved[NAMEPOS[n[i]]] = a[i]; //bind name
			}
			// Then, unnamed arguments:
			var p = 0;
			for (i = 0; i < n.length; i++) if (n[i] == null || NAMEHAS[n[i]] !== YES) {
				while (filled[p] === true) p++;
				resolved[p] = a[i];
				p++;
			};
			a.names = n
		} else {
			a.names = [];
		};
		a.callee = f;
		return M(t, a);

	};
	f.external = false;
	f.toString = LofnFunctionCSTR;
	return f;
};

var MBRCHK = function (x) {
	if (x == null)
		throw new Error('Unable to fetch a member of null or undefined');
	return x;
}

var ScriptScopes;

// Language level "stl"

Function.prototype.external = true;

Object.prototype.item = function (i) {
	return this[i];
};
Object.prototype.itemset = function (i, v) {
	return this[i] = v;
};
Object.prototype.compareTo = function (b) {
	return a == b ? 0 : a > b ? 1 : -1;
};
Object.prototype.be = function (b) {
	return this === b
};
Object.prototype.contains = function (b) {
	return b in this;
};
Function.prototype.be = function (b) {
	return b instanceof this;
};

Function.prototype['new'] = function () {
	var obj = derive(this.prototype);
	INVOKE(this, DIRECTINVOKE, obj, arguments);
	return obj;
};
Function.prototype.acceptShiftIn = function (x) {
	return INVOKE(this, DIRECTINVOKE, null, [x], false)
}

var Rule = function (l, r) {
	this.left = l,
	this.right = r;
}
Rule.prototype.reverse = function () {
	return new Rule(this.right, this.left);
}
Rule.prototype.toString = function () {
	return this.left + ' -> ' + this.right;
}
Rule.prototype.each = function (f) {
	if (typeof this.left === 'number' && typeof this.right === 'number') {
		if (this.left <= this.right) {
			for (var i = this.left; i <= this.right; i++) {
				DINVOKE(f, this, false, null, i);
			}
		} else {
			for (var i = this.left; i >= this.right; i--) {
				DINVOKE(f, this, false, null, i);
			}
		}
	}
}

var CREATERULE = function (l, r) {
	return new Rule(l, r);
}
