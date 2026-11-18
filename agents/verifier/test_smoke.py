"""The smoke-test file is valid, and its expected outcomes are mathematically right."""

from pathlib import Path

import sympy as sp

from claims import load_claims

SMOKE = Path(__file__).resolve().parent / "smoke" / "equations.json"


def test_smoke_file_loads_and_expected_outcomes_hold():
    claims = {c.number: c for c in load_claims(SMOKE)}
    assert set(claims) == {"1", "2", "3", "4"}

    one, two, three, four = (claims[n] for n in "1234")
    assert sp.simplify(one.lhs - one.rhs) == 0  # (1) HOLDS
    assert sp.simplify(two.lhs - two.rhs) != 0  # (2) FAILS ...
    assert sp.simplify(two.lhs - 1) == 0  # ... and "= 1" is the correction

    eps = three.regime.symbol
    assert three.is_approximate and three.regime.is_stated
    assert sp.limit(three.lhs / three.rhs, eps, three.regime.point, three.regime.direction) == 1
    ratio = sp.limit((three.lhs - three.rhs) / three.regime.order, eps, 0, "+")
    assert ratio.is_finite  # error is O(eps**2): (3) HOLDS

    assert four.relation == "sim" and not four.regime.is_stated  # (4) needs a question
