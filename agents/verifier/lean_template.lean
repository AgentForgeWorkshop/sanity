-- Lean check <NN>: equation (<label>). One theorem per file.
-- State the claim exactly as its sympy form says (same quantifiers and assumptions).
-- verify_run runs this file through lean_check.py; only such a file can give
-- evidence proof (EXPECT: proof, THEOREM states the claim) or refutation
-- (EXPECT: refutation, THEOREM states the claim's negation).
-- Core library only (Nat, Int, Bool, lists): no Mathlib, so no reals yet.
-- Never use sorry, admit, axiom or native_decide: the check is rejected.
-- CHECK_ID: NN_eqX_lean
-- CLAIM: X
-- THEOREM: Sanity.Check.eqX
-- EXPECT: proof

namespace Sanity.Check

theorem eqX (a b : Int) : a + b = b + a := by
  omega

end Sanity.Check
