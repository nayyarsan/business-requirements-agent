# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Features

### VS Code Extension

- **Input Validation**: All user inputs are validated for length and content
- **Injection Prevention**: Sanitizes inputs to prevent script injection
- **File Size Limits**: Agent configs limited to 1MB to prevent DoS
- **Error Sanitization**: Error messages don't expose internal details
- **Timeout Controls**: Configurable timeouts prevent hanging sessions
- **Local Execution**: All processing happens locally with user's own Copilot auth

### Web App

- **CORS Protection**: Configurable origin allowlist
- **Input Length Limits**: Project descriptions capped at 5000 chars
- **Timeout Management**: 5-minute default timeout (configurable)
- **No Credential Storage**: Uses authenticated Copilot CLI, no API keys stored

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **Do not** open a public issue
2. Email: security@your-domain.com (replace with your contact)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours and provide a fix within 7 days for critical issues.

## Best Practices for Users

### VS Code Extension
- Keep VS Code updated to the latest version
- Only load agent configs from trusted sources
- Review `.github/agents/` and `.github/skills/` files before using
- Don't share your Copilot authentication with others

### Web App (Internal Use)
- Run behind a firewall or VPN for internal access only
- Set `CORS_ORIGIN` to your specific domain (not `*`)
- Don't expose to the public internet
- Each deployment should use one person's Copilot auth (not shared)

## Dependencies

We monitor dependencies for vulnerabilities:
- Run `npm audit` regularly
- Update deprecated packages promptly
- Use `npm audit fix` for automated patches

Current status: ✅ 0 vulnerabilities (as of last check)
