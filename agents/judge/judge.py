"""Judge agent.

The Judge does not re-derive. It confirms or rejects a Checker flag and
quotes the equation and the source line.

Evidence, strongest first:

1. Lean proved or refuted the formal statement. The ruling is Lean-verified.
2. A SymPy disagreement (algebra, dimensions, a limit, a special case).
3. No disagreement. The flag is rejected and the equation stands.
"""

from dataclasses import dataclass
from enum import Enum


class Evidence(Enum):
    NONE = 0
    SYMPY = 1
    LEAN = 2


@dataclass(frozen=True)
class Flag:
    equation: str
    line: int
    disagrees: bool
    evidence: Evidence


@dataclass(frozen=True)
class Ruling:
    equation: str
    line: int
    confirmed: bool
    lean_verified: bool
    quote: str


def rule(flag: Flag) -> Ruling:
    """Confirm a real disagreement. Lean outranks SymPy."""
    confirmed = flag.disagrees and flag.evidence is not Evidence.NONE
    lean_verified = confirmed and flag.evidence is Evidence.LEAN
    return Ruling(
        equation=flag.equation,
        line=flag.line,
        confirmed=confirmed,
        lean_verified=lean_verified,
        quote=f"Line {flag.line}: {flag.equation}",
    )
