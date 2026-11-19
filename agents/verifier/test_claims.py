"""equations.json is validated, and SymPy strings are parsed without eval."""

import json
from pathlib import Path

import pytest
import sympy as sp

from claims import ClaimError, build_expression, load_claims, main, parse_claim

REPO = Path(__file__).resolve().parents[2]
SPECIMEN = REPO / "runs" / "example-oscillator" / "equations.json"


def entry(lhs, rhs, symbols, **extra):
    return {
        "number": "1",
        "line": 1,
        "latex": "x",
        "sympy": {"lhs": lhs, "rhs": rhs, "symbols": symbols, **extra},
    }


def test_specimen_loads_with_assumptions():
    claims = {claim.number: claim for claim in load_claims(SPECIMEN)}
    assert set(claims) == {"1", "2", "3", "4", "5"}
    energy = claims["3"]
    assert energy.has_sympy
    m, k, v, x = (energy.symbols[name] for name in "mkvx")
    assert m.is_positive and k.is_positive
    assert sp.simplify(energy.rhs - (m * v**2 / 2 + k * x**2)) == 0
    assert isinstance(claims["1"].as_relation(), sp.Eq)


def test_claim_without_sympy_field_is_allowed():
    claim = parse_claim({"number": "2", "line": 4, "latex": "a=b"})
    assert not claim.has_sympy
    with pytest.raises(ClaimError):
        claim.as_relation()


def test_relation_and_functions():
    claim = parse_claim(
        entry("Derivative(f(t), t)", "0", {"t": ["real"]}, functions=["f"], relation=">=")
    )
    assert isinstance(claim.as_relation(), sp.Ge)


@pytest.mark.parametrize(
    "text",
    [
        "__import__('os').system('true')",
        "x.__class__",
        "[x for x in (1,)]",
        "lambda: 1",
        "x[0]",
        "'string'",
        "open(x)",
        "x^2",
        "sqrt(x, evaluate=False)",
    ],
)
def test_unsafe_or_unsupported_syntax_is_rejected(text):
    with pytest.raises(ClaimError):
        build_expression(text, {"symbols": {"x": []}})


def test_special_functions_common_in_physics_are_allowed():
    expr = build_expression("zeta(3)*gamma(3) + polylog(2, z) + Sum(1/n**2, (n, 1, oo))",
                            {"symbols": {"z": [], "n": ["integer", "positive"]}})
    assert expr.has(sp.zeta) and expr.has(sp.polylog) and expr.has(sp.Sum)
    claim = parse_claim(entry("N_ex", "zeta(3)*(kT/hw)**3", {"N_ex": ["positive"], "kT": ["positive"], "hw": ["positive"]}))
    assert claim.rhs.has(sp.zeta)


def test_undeclared_symbol_is_rejected():
    with pytest.raises(ClaimError, match="undeclared name 'y'"):
        build_expression("x + y", {"symbols": {"x": []}})


def test_symbol_and_function_with_the_same_name_is_rejected():
    with pytest.raises(ClaimError, match="both symbol and function"):
        build_expression("x", {"symbols": {"x": []}, "functions": ["x"]})


def test_schema_rejects_unknown_assumption(tmp_path):
    bad = {
        "slug": "toy",
        "source": "toy.tex",
        "equations": [entry("x", "1", {"x": ["happy"]})],
    }
    path = tmp_path / "equations.json"
    path.write_text(json.dumps(bad), encoding="utf-8")
    with pytest.raises(ClaimError, match="equations.json invalid"):
        load_claims(path)


def test_approximate_claim_with_regime():
    claim = parse_claim(
        entry(
            "omega", "sqrt(g*k)", {"omega": ["positive"], "g": ["positive"], "k": ["positive"], "H": ["positive"]},
            relation="approx",
            regime={"limit": {"symbol": "H", "to": "oo"}, "order": "exp(-2*k*H)", "note": "deep water, k H >> 1"},
        )
    )
    assert claim.is_approximate
    assert claim.regime.is_stated
    assert claim.regime.point == sp.oo
    assert claim.regime.order.has(claim.symbols["H"])
    with pytest.raises(ClaimError, match="approximate"):
        claim.as_relation()


def test_regime_with_only_a_note_is_not_stated():
    claim = parse_claim(entry("a", "b", {"a": [], "b": []}, relation="sim", regime={"note": "paper gives no regime"}))
    assert not claim.regime.is_stated


def test_regime_needs_a_declared_symbol_and_an_approximate_relation():
    with pytest.raises(ClaimError, match="not declared"):
        parse_claim(entry("a", "b", {"a": [], "b": []}, relation="approx", regime={"limit": {"symbol": "eps", "to": "0"}}))
    with pytest.raises(ClaimError, match="only applies"):
        parse_claim(entry("a", "b", {"a": [], "b": []}, regime={"note": "x"}))


def test_schema_requires_a_regime_for_approximate_relations(tmp_path):
    bad = {"slug": "toy", "source": "toy.tex", "equations": [entry("a", "b", {"a": [], "b": []}, relation="sim")]}
    path = tmp_path / "equations.json"
    path.write_text(json.dumps(bad), encoding="utf-8")
    with pytest.raises(ClaimError, match="regime"):
        load_claims(path)


def test_cli_lists_claims(capsys):
    assert main([str(SPECIMEN)]) == 0
    out = capsys.readouterr().out
    assert "Eq(E, " in out and "line 17" in out


@pytest.mark.parametrize("name, builtin", [("E", sp.E), ("gamma", sp.gamma), ("I", sp.I), ("pi", sp.pi), ("O", sp.O)])
def test_declared_symbols_win_over_sympy_names(name, builtin):
    expr = build_expression(f"2*{name}", {"symbols": {name: ["positive"]}})
    assert expr.free_symbols == {sp.Symbol(name, positive=True)}
    assert not expr.has(builtin) or name == "O"


def test_undeclared_sympy_names_keep_their_meaning():
    assert build_expression("E", {"symbols": {}}) == sp.E
    assert build_expression("gamma(3)", {"symbols": {}}) == sp.gamma(3)


def test_limit_and_order_terms():
    limit = build_expression("Limit(sin(x)/x, x, 0, '+')", {"symbols": {"x": ["real"]}})
    assert isinstance(limit, sp.Limit) and limit.doit() == 1
    series = build_expression("1 + x/2 + O(x**2)", {"symbols": {"x": ["positive"]}})
    assert series.has(sp.Order)
    claim = parse_claim(entry("L", "Limit(n*sin(1/n), n, oo)", {"L": ["real"], "n": ["positive"]}))
    assert sp.simplify(claim.rhs.doit() - 1) == 0


@pytest.mark.parametrize("text", ["Limit(x, x, 0, 'evil')", "sin('+')", "x + '+'"])
def test_strings_only_as_limit_direction(text):
    with pytest.raises(ClaimError, match="only numeric literals"):
        build_expression(text, {"symbols": {"x": []}})


def test_sympy_errors_become_claim_errors():
    with pytest.raises(ClaimError, match="cannot build"):
        build_expression("gamma(3)", {"symbols": {"gamma": []}})  # a declared symbol cannot be called
