# Auditoria de Segurança - FajuARC dApp

Processo estruturado para testar a segurança do dApp FajuARC. Use em conjunto com as skills **find-bugs** e **cc-skill-security-review**.

## Skills recomendadas

| Skill | Quando usar | Foco |
|-------|-------------|------|
| **find-bugs** | Revisão de PRs, mudanças em branch | Checklist OWASP, mapeamento de superfície de ataque |
| **cc-skill-security-review** | Auth, inputs, pagamentos, secrets | Checklist completo (secrets, validação, XSS, CSRF) |
| **solidity-security** | Contratos próprios (Hardhat) | Reentrancy, overflow, access control |
| **frontend-security-coder** | XSS, CSP, client-side | Sanitização, Content Security Policy |

---

## Checklist de segurança para dApps

### 1. Wallet e conexão
- [ ] **Provider detection**: Não confiar em `window.ethereum` sem verificar origem
- [ ] **Assinatura de mensagens**: Verificar que signMessage não expõe dados sensíveis
- [ ] **Transações**: Validar `to`, `value`, `data` antes de enviar
- [ ] **Approval/Allowance**: Evitar approve infinito (max uint256); usar approve exato quando possível
- [ ] **Multi-wallet**: Tratamento correto quando vários providers (MetaMask, Rabby) coexistem

### 2. Swap e liquidez
- [ ] **Slippage**: Verificar se swap usa limite de slippage para proteger contra sandwich
- [ ] **Amounts**: Validar que amounts não são negativos ou excessivos antes de chamar contrato
- [ ] **Token addresses**: Confirmar que endereços vêm de fonte confiável (config, não input)
- [ ] **Pair address**: Verificar que getPair/createPair usa tokens na ordem correta

### 3. Bridge (Circle BridgeKit)
- [ ] **Amounts**: Validar input numérico antes de bridge
- [ ] **Rede**: Confirmar que destino é Arc Testnet esperado
- [ ] **Provider**: Garantir que adapter usa provider do usuário conectado

### 4. Frontend
- [ ] **XSS**: Nenhum `dangerouslySetInnerHTML` com conteúdo não sanitizado
- [ ] **URLs**: Validar links externos (explorer, faucet, bridge)
- [ ] **localStorage**: Não armazenar chaves privadas ou seeds
- [ ] **CSP**: Headers Content-Security-Policy em produção

### 5. Secrets e env
- [ ] **Variáveis de ambiente**: Nenhum secret em código (VITE_* só para público)
- [ ] **API keys**: WalletConnect projectId em .env
- [ ] **.env**: Arquivo em .gitignore, nunca commitado

### 6. Dependências
- [ ] `npm audit` consultado periodicamente (não bloqueia CI)
- [ ] Dependências atualizadas (viem, wagmi, ethers, etc.)
- [ ] Lock file commitado

**Política de audit:** O `security:check` roda audit + lint. O audit é informativo e **não bloqueia** o build/CI. A maioria das vulnerabilidades está em deps de dev/build (Hardhat, ESLint, Vite) que não vão para o bundle de produção. O risco real do dApp está em XSS, phishing, fluxo de assinatura e validação de transações.

**bigint-buffer (via @circle-fin/bridge-kit):** Única vuln alta que pode ir ao bundle. Se o Bridge for essencial, acompanhar atualizações do Circle. Se não for usado, considerar remoção.

---

## Comandos para executar

```bash
# 1. Checks de segurança (audit informativo + lint obrigatório)
#    O audit não bloqueia; o lint sim.
npm run security:check

# 2. Apenas auditoria de dependências (para inspeção)
npm run security:audit

# 3. Lint (regras de qualidade)
npm run lint

# 4. Build (tipagem e compilação)
npm run build

# 5. Testes de contrato (se existir)
npm run test:dex

# 6. Testes E2E (Playwright)
npm run test:e2e
```

---

## Processo de revisão (find-bugs)

1. Obter diff completo:
   ```bash
   git diff $(git rev-parse --abbrev-ref HEAD@{upstream} 2>/dev/null || echo "main")...HEAD
   ```

2. Para cada arquivo alterado, mapear:
   - Inputs do usuário
   - Chamadas a contratos
   - Operações de auth/approval
   - Acesso a localStorage/sessionStorage

3. Verificar cada item do checklist acima conforme o escopo das mudanças.

4. Reportar achados com severidade (Critical/High/Medium/Low).

---

## Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Consensys Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Ethereum Smart Contract Security](https://ethereum.org/en/developers/docs/smart-contracts/security/)
