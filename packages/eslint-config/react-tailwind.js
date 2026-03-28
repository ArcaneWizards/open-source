const REACT_TAILWIND_CALLEES = ['cn', 'cnd'];

const CLASS_NAME_ROOT_EXPRESSION_SELECTOR =
  'JSXAttribute[name.name="className"] > JSXExpressionContainer > :not(Literal[raw=/^["\']/]):not(TemplateLiteral[expressions.length=0]):not(Identifier[name="className"]):not(CallExpression[callee.type="Identifier"][callee.name="cn"]):not(CallExpression[callee.type="Identifier"][callee.name="calculateClass"]):not(CallExpression[callee.type="Identifier"][callee.name=/^cls[A-Z]/])';

const CN_CLASS_NAME_ARGUMENT_SELECTOR =
  'JSXAttribute[name.name="className"] CallExpression[callee.type="Identifier"][callee.name="cn"] > *.arguments:not(Literal[raw=/^["\']/]):not(TemplateLiteral[expressions.length=0]):not(Identifier[name="className"]):not(CallExpression[callee.type="Identifier"][callee.name="cnd"]):not(CallExpression[callee.type="Identifier"][callee.name="calculateClass"]):not(CallExpression[callee.type="Identifier"][callee.name=/^cls[A-Z]/])';

const CN_CND_INVALID_CLASS_SELECTOR =
  'JSXAttribute[name.name="className"] CallExpression[callee.type="Identifier"][callee.name="cn"] > CallExpression.arguments[callee.type="Identifier"][callee.name="cnd"] > *.arguments:nth-child(2):not(Literal[raw=/^["\']/]):not(TemplateLiteral[expressions.length=0])';

const CN_CND_INVALID_FALLBACK_CLASS_SELECTOR =
  'JSXAttribute[name.name="className"] CallExpression[callee.type="Identifier"][callee.name="cn"] > CallExpression.arguments[callee.type="Identifier"][callee.name="cnd"] > *.arguments:nth-child(3):not(Literal[raw=/^["\']/]):not(TemplateLiteral[expressions.length=0])';

const REACT_CLASS_NAME_RESTRICTED_SYNTAX = [
  {
    selector: CLASS_NAME_ROOT_EXPRESSION_SELECTOR,
    message:
      'className must be a string literal, an expression-free template literal, `className`, `cn(...)`, `calculateClass(...)`, or a `cls*` call.',
  },
  {
    selector: CN_CLASS_NAME_ARGUMENT_SELECTOR,
    message:
      'When used for className, `cn(...)` may only contain string literals, expression-free template literals, `className`, `cnd(condition, "truthy"[, "falsey"])`, `calculateClass(...)`, or `cls*` calls.',
  },
  {
    selector: CN_CND_INVALID_CLASS_SELECTOR,
    message:
      'When used for className, the second `cnd(...)` argument must be a string literal or an expression-free template literal.',
  },
  {
    selector: CN_CND_INVALID_FALLBACK_CLASS_SELECTOR,
    message:
      'When used for className, the optional third `cnd(...)` argument must be a string literal or an expression-free template literal.',
  },
];

module.exports = {
  REACT_CLASS_NAME_RESTRICTED_SYNTAX,
  REACT_TAILWIND_CALLEES,
};
