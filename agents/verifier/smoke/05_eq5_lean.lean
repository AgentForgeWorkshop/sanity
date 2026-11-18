-- Lean check for smoke-test equation (5): 3(a+b) - 2a = a + 3b over the integers.
-- Reference file: the Verifier writes its own; selftest and tests use this one.
-- CHECK_ID: 05_eq5_lean
-- CLAIM: 5
-- THEOREM: Sanity.Smoke.eq5
-- EXPECT: proof

namespace Sanity.Smoke

/-- Equation (5), stated exactly as its sympy form: lhs = rhs for all integers a, b. -/
theorem eq5 (a b : Int) : 3 * (a + b) - 2 * a = a + 3 * b := by
  omega

end Sanity.Smoke
