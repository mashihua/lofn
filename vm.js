var VM = function(){

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

var TO_ENCCD = function(name){
	return name.replace(/[^a-zA-Z0-9_]/g,function(m){
		return '$'+m.charCodeAt(0).toString(36)
	});
};
var C_NAME = function(id, name){
	return '_$$_'+TO_ENCCD(name);
}
var GETV = function(node, env){
	var depth = env.useVar(node.name)
	return C_NAME(depth, node.name);
}
var SETV = function(node, val, env){
	var depth = env.useVar(node.name)
	return '('+C_NAME(depth, node.name)+'='+val+')';
}
var T_NAMES = function(){
	var o = new Nai,argn = arguments.length;
	for(var i=0;i<argn;i+=2)
		o[arguments[i]]=arguments[i+1];
	return o;
}
schemata(nt.SCRIPT, function (n) {
	var a = [];
	for (var i = 0; i < n.content.length; i++)
		if (n.content[i]) {
			a[i] = transform(n.content[i]);
		}
	return a.join(';\n');
});
schemata(nt['='], function (n, env) {
	switch (this.left.type) {
		case nt.ITEM:
			return 'MINVOKE(' + transform(this.left.left) + ',"itemset",' + transform(this.left.item) + ',' + transform(this.right) + ')';
		case nt.MEMBER:
			return '((' + transform(this.left.left) + ')[' + strize(this.left.right.name) + ']=(' + transform(this.right) + '))';
		case nt.MEMBERREFLECT:
			return '((' + transform(this.left.left) + ')[' + transform(this.right) + ']=(' + transform(this.right) + '))';
		case nt.VARIABLE:
			return SETV(this.left, '(' + transform(this.right) + ')', env);
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
		return '(' + transform(this.left) + ')["' + memberName + '"]';
	return '(' + transform(this.left) + ').' + memberName;
});
schemata(nt.MEMBERREFLECT, function () {
	var memberName = this.right.name;
	return '(' + transform(this.left) + ')[' + transform(this.right) + ']';
});
schemata(nt.ITEM, function () {
	return 'MINVOKE(' + transform(this.left) + ',"item",' + transform(this.item) + ')';
});
schemata(nt.VARIABLE, function (n, env) {
	return GETV(n, env);
});
schemata(nt.THIS, function () {
	return 'this';
});
schemata(nt.ARGUMENTS, function () {
	return 'arguments';
});
schemata(nt.CALLEE, function () {
	return '(arguments.callee)';
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
			comp = 'MINVOKE(' + transform(this.func.left) + ',' + strize(this.func.right.name)+',';
			break;
		case nt.MEMBERREFLECT:
			comp = 'MINVOKE(' + transform(this.func.left) + ',' + transform(this.func.right)+',';
			break;
		case nt.ITEM:
			comp = 'IINVOKE(' + transform(this.func.left) + ',' + transform(this.func.item)+',';
			break;
		default:
			comp = '(' + transform(this.func) + ')(';
	};
	var args = [], names = [];
	for (var i = 0; i < this.args.length; i++) {
		if (this.names[i]){
			names.push(strize(this.names[i]), transform(this.args[i]));
		}else
			args.push(transform(this.args[i]));
	}
	comp += args.join(',');
	if (this.nameused)
		comp += (args.length ? ',' : '') + 'T_NAMES(' + names.join(',') + ')';
	comp += ')'
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
		return 'MINVOKE(' + transform(this.right) + ',' + strize(method) + ',' + transform(this.left) + ')';
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
	return 'MINVOKE(' + transform(this.left) + ',"compareTo",' + transform(this.right) + ')';
});
schemata(nt['<<'], function () {
	return 'MINVOKE(' + transform(this.left) + ',"shiftIn",' + transform(this.right) + ')';
});
schemata(nt['/@'], function () {
	return 'MINVOKE(' + transform(this.left) + ',"map",' + transform(this.right) + ')';
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
	var _e = env,f = this.tree;
	var s = createFromTree(f);
	var pars = f.parameters.names.slice(0);
	for(var i=0;i<pars.length;i++)
		pars[i]=C_NAME(f.id, pars[i])
	s = 'function('+pars.join(',')+'){'+s+'}';
	
	env = _e;
	return '('+s+')';
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

var env;
var transform = function (node) {
	if (vmSchemata[node.type]) {
		return vmSchemata[node.type].call(node, node, env);
	} else {
		return '{!UNKNOWN}';
	}
}
var createFromTree = function (tree, genv) {
	if(tree.transformed)
		return;
	env = tree;
	var s = transform(tree.code);
	var locals = tree.locals, vars=[];
	for(var i=0;i<locals.length;i++)
		if(!(tree.varIsArg[locals[i]]))
			vars.push(C_NAME(tree.id, locals[i]));
	s = 'var ___$TMP;\n//----\n'+(vars.length ? 'var '+vars.join(', ')+';\n':'')+s;	

	tree.transformed = s;
	return s;
};


// Language level "stl"




var CREATERULE = function (l, r) {
	return new Rule(l, r);
}

//============

return function(tree, initals){
	var _args = [],_vals=[];
	for(var each in initals) {
		if(OWNS(initals, each)){
			_args.push(C_NAME(0, each));
			tree[0].newVar(each, true);
			_vals.push(initals[each]);
		}
	}
	tree[0].listVar();
	createFromTree(tree[0]);
	var body = tree[0].transformed;
	var f = function(){
		return Function.apply(null,_args.concat(body)).apply(null,_vals)
	};
	f.__bodyCode = body;
	return f;
}

}();
