// Positive control for Semgrep.
// Intentionally insecure dynamic code execution pattern.
export function insecureEval(userSuppliedExpression) {
  return eval(userSuppliedExpression);
}
