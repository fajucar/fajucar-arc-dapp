# Integração TestSprite (quando o MCP estiver conectado)

Quando o **TestSprite MCP** estiver conectado e autenticado no Cursor, você pode pedir à IA para rodar testes usando as ferramentas do TestSprite em vez (ou além) dos testes Playwright locais.

## O que o TestSprite faz

1. **Bootstrap** – Verifica se o app está rodando (ex.: porta 3000) e prepara o contexto.
2. **Code summary** – Gera ou usa `testsprite_tests/tmp/code_summary.json` (tech stack + features).
3. **PRD** – Gera um PRD padronizado para o produto.
4. **Plano de testes** – Gera plano de testes frontend.
5. **Gerar e executar** – Cria testes Playwright e executa contra a aplicação.

## Pré-requisitos

- **API Key do TestSprite** em [Dashboard → Settings → API Keys](https://www.testsprite.com/dashboard/settings/apikey).
- **MCP configurado** em `~/.cursor/mcp.json` (ou equivalente):

```json
{
  "mcpServers": {
    "TestSprite": {
      "command": "npx",
      "args": ["@testsprite/testsprite-mcp@latest"],
      "env": {
        "API_KEY": "sua-chave-testsprite"
      }
    }
  }
}
```

- **App rodando** em `http://localhost:3000` (`npm run dev`).
- **Cursor reiniciado** após alterar o MCP.

## Como acionar no chat

Exemplos de pedidos que fazem a IA usar o TestSprite (quando o MCP estiver disponível):

- *"Roda o teste com TestSprite"*
- *"Execute os testes do TestSprite neste projeto"*
- *"TestSprite: bootstrap e rode os testes"*
- *"Ajude-me a testar este projeto com o TestSprite"*

A IA vai chamar as ferramentas MCP do TestSprite (bootstrap → code summary → PRD → plano → gerar/executar testes) e devolver o resumo e, se houver, relatórios (HTML/PDF).

## Testes E2E locais (Playwright)

O projeto já tem testes E2E com **Playwright** que rodam sem o TestSprite:

```bash
npm run test:e2e
```

Cenários cobertos:

- **Navegação** – home, /swap, /pools, /mint, /my-nfts, /my-pools, links do header.
- **Smoke** – app responde na raiz, título, conteúdo da swap.
- **Carteira** – botão Connect Wallet visível, modal abre/fecha.
- **Formulários** – Swap (campo valor, selects, slippage), Mint (Back to Home, conteúdo), My NFTs.

Relatório HTML: `playwright-report/` após a execução.

## Resumo

| Objetivo              | Usar TestSprite (MCP)     | Usar Playwright local   |
|-----------------------|---------------------------|--------------------------|
| Testes gerados por IA | Sim (quando MCP conectado) | Não                     |
| Testes já no projeto  | Complementar              | Sim (`e2e/*.spec.ts`)   |
| Requer API Key        | Sim                       | Não                      |
| Requer app na 3000    | Sim                       | Sim (ou webServer no config) |

Quando o MCP do TestSprite estiver conectado e a API key válida, basta pedir no chat para rodar os testes com TestSprite; caso contrário, use `npm run test:e2e` para os testes Playwright locais.
