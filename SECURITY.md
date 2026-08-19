# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in SpendRail, report it privately.

Use [GitHub Security Advisories](https://github.com/mAsyamJ/spendrail/security/advisories).

**Do not open a public issue for security vulnerabilities.**

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment:** Within 48 hours of your report.
- **Initial assessment:** Within 5 business days.
- **Resolution:** We aim to release a fix within 14 days for critical issues.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest | Yes |

## Design constraint

LLM reasoning must not control financial authorization. Policy evaluation is
deterministic and fail-closed. See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md).
