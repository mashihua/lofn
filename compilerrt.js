//:module: compiler runtime -- compilerrt
//	:author:		infinte (aka. be5invis)
//	:info:			The essential environment for Eisa Compiler

(function(eisa){

	eisa.languages = {};
	eisa.ast = {};
	var warn = function(s){eisa.log(s)};
	
	var NodeType = eisa.ast.NodeType = function () {
		var types = [
			// Unknown type
			'UNKNOWN',
			// Primary
			'VARIABLE', 'THIS', 'LITERAL', 'ARRAY', 'OBJECT',
			'ARGUMENTS', 'CALLEE', 'ARGN', 'GROUP', 'SHARP', 'AWAIT',
			// Membering
			'MEMBER', 'ITEM', 'MEMBERREFLECT', 
			// Invocation
			'DO', 'CALL', 'NEW',
			// Operators
			'NEGATIVE', 'NOT',

			'of',
			'*', '/','%',
			'+', '-',
			'<<', '>>',
			'<', '>', '<=', '>=', '<=>', 'is', 'in',
			'==', '!=', '=~', '!~', '===', '!==',
			'and', 'or',

			'as', '~~',
			'->',
			// Lambda
			':>',
			// Assignment
			'=',
			// Conditional
			'CONDITIONAL',
			// Statements
			'EXPRSTMT', 
			'IF', 'FOR', 'FORIN', 'WHILE', 'REPEAT', 'CASE', 'PIECEWISE', 'VAR',
			'BREAK', 'LABEL', 'THROW', 'RETURN', 'TRY', 
			// modular
			'USING', 'IMPORT',
			// Variable
			'VARDECL',
			// Large-scale
			'BLOCK', 'FUNCTION', 'PARAMETERS', 'BODY', 'SCRIPT', 'SCOPE'

		];
		var T = {};
		for (var i = 0; i < types.length; i++) T[types[i]] = i;
		return T;
	} ();

	var CompileErrorMeta = eisa.CompileErrorMeta = function(prefix){
		return function(message, pos, source){
			var lineno = ('\n' + source.slice(0, pos)).match(/\n/g).length;
			var lineno_l = lineno.toString().length;
			message = '[' + prefix + '] ' + message + '\nat line: ' + lineno;
			message += '\n ' + lineno + ' : ' + (source.split('\n')[lineno - 1]);
			message += '\n-' + (lineno + '').replace(/./g, '-') + '---' + (source.slice(0, pos).split('\n')[lineno - 1].replace(/./g, '-').replace(/$/, '^'));
	
			var e = new Error(message);
			return e;
		};
	};

	var CompileError = eisa.CompileError = CompileErrorMeta("EISA");

	eisa.compileEnv = {}

	var ScopedScript = eisa.ast.ScopedScript = function (id, env) {
			this.code = {type: NodeType.SCRIPT};
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
			this.finNo = 0;
			this.coroid = false;
			this.initHooks = {};
		};
		ScopedScript.prototype.newVar = function (name, isarg) {
			return ScopedScript.registerVariable(this, name, isarg);
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
		ScopedScript.listTemp = function(scope){
			var l = []
			for(var each in scope.usedTemps)
				if(scope.usedTemps[each] === 1)
					l.push(each);
			return l;
		}
		ScopedScript.listParTemp = function(scope){
			var l = []
			for(var each in scope.usedTemps)
				if(scope.usedTemps[each] === 2)
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
		ScopedScript.prototype.cleanup = function(){
			delete this.sharpNo;
			delete this.labels;
		}
	
	ScopedScript.generateQueue = function(scope, trees, arr){
		if(!arr) arr = [];
		for(var i = 0; i < scope.nest.length; i++)
			ScopedScript.generateQueue(trees[scope.nest[i]], trees, (arr));
		arr.push(scope);
		return arr;
	}
	ScopedScript.useTemp = function(scope, type, id, aspar){
		scope.usedTemps[type + (id == null ? '' : id)] = (aspar || 0) + 1;
	}
	
	ScopedScript.registerVariable = function(scope, name, argQ, useQ) {
		if (scope.variables[name] === scope.id) return;
		// scope.locals.push(name);
		scope.varIsArg[name] = argQ === true;
		if(useQ){
			scope.usedVariables[name] = true;
		}
		return scope.variables[name] = scope.id;
	}
	ScopedScript.generateVariableResolver = function(scope, trees, explicitQ, aux) {
		for (var each in scope.usedVariables) {
			if (scope.usedVariables[each] === true) {
				if(!(scope.variables[each] > 0)){
					if(!explicitQ) {
						warn('Undeclared variable "' + each + '" when using `!option explicit`. At: ' +
							(scope.usedVariablesOcc && scope.usedVariablesOcc[each]) || 0);
						ScopedScript.registerVariable(scope, each);
						trees[scope.variables[each] - 1].locals.push(each);
					} else {
						throw new CompileError(
							'Undeclared variable "' + each + '" when using `!option explicit`.',
							(scope.usedVariablesOcc && scope.usedVariablesOcc[each]) || 0,
							aux.source || ''
						)
					}
				} else {
					trees[scope.variables[each] - 1].locals.push(each);
				}
			}
		};
		for (var i = 0; i < scope.nest.length; i++)
			ScopedScript.generateVariableResolver(trees[scope.nest[i]], trees, explicitQ, aux);
	}
})(EISA_eisa)
