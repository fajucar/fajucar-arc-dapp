# Testes com TestSprite

O [TestSprite](https://www.testsprite.com/) é uma plataforma de testes com IA que se integra ao Cursor via **MCP (Model Context Protocol)**. Ela pode gerar requisitos, planos de teste e testes baseados em Playwright, executá-los contra sua aplicação e gerar relatórios — tudo orquestrado pela IDE.

## Quick start (resumo)

1. **API Key** — [Dashboard](https://www.testsprite.com/dashboard) → Settings → API Keys → criar e colar no Cursor (MCP do TestSprite).
2. **MCP conectado** — Cursor → Settings → MCP → TestSprite com indicador verde.
3. **App rodando** — No projeto: `npm run dev` (app em **http://localhost:3000**).
4. **Pedir no chat** — Ex.: *"Test this project with TestSprite"* ou *"Ajude-me a testar este projeto com o TestSprite."*

## Checklist: o que falta depois de "Add to Cursor"

Clicar em **"Add to Cursor"** só instala o servidor MCP. Para o teste rodar de verdade, faça **tudo** abaixo:

| # | O que fazer | Onde |
|---|-------------|------|
| 1 | **Criar e configurar a chave de API** | Dashboard TestSprite → Settings → API Keys → "Create a Key". Depois, no Cursor: Settings → MCP → TestSprite → colar a chave em `API_KEY` (ou quando o Cursor pedir). |
| 2 | **Confirmar que o MCP está conectado** | Cursor → Settings → MCP. O TestSprite deve aparecer com indicador verde. Se não, reinicie o Cursor. |
| 3 | **Subir a aplicação** | No terminal do projeto: `npm run dev`. Deixe rodando em http://localhost:3000. |
| 4 | **Pedir o teste no chat** | No **chat do Cursor** (não no modal), digite por exemplo: **"Hey, help me to test this project with TestSprite."** ou **"Ajude-me a testar este projeto com o TestSprite."** |

Sem a **chave de API** (1) o MCP não autentica. Sem a **app rodando** (3) não há o que testar. Sem **pedir no chat** (4) a IA não aciona as ferramentas do TestSprite.

## Pré-requisitos

- **Node.js ≥ 22** (necessário para o servidor MCP do TestSprite). Verifique com `node --version`.
- **Conta no TestSprite** — [Cadastre-se grátis](https://www.testsprite.com/auth/cognito/sign-up).
- **Chave de API do TestSprite** — No [Dashboard](https://www.testsprite.com/dashboard) → **Settings** → **API Keys** → **New API Key**.

## 1. Instalar o servidor MCP do TestSprite no Cursor

### Opção A: Instalação em um clique (recomendado)

1. Obtenha sua [chave de API](https://www.testsprite.com/dashboard) (Settings → API Keys).
2. Use o [link de instalação em um clique](https://docs.testsprite.com/mcp/getting-started/installation) para Cursor (na documentação deles).
3. Digite sua chave de API quando solicitado.
4. Confirme que o servidor MCP do TestSprite mostra o indicador verde e que as ferramentas foram carregadas.

### Opção B: Manual

1. Abra **Cursor Settings** (por exemplo `Ctrl+Shift+J` / `Cmd+Shift+J`).
2. Vá em **Tools & Integration** → **Add custom MCP**.
3. Adicione:

```json
{
  "mcpServers": {
    "TestSprite": {
      "command": "npx",
      "args": ["@testsprite/testsprite-mcp@latest"],
      "env": {
        "API_KEY": "sua-chave-de-api"
      }
    }
  }
}
```

4. Substitua `sua-chave-de-api` pela sua chave real.
5. Reinicie o Cursor se precisar; confira se o TestSprite aparece como conectado.

## 2. Configuração de sandbox do Cursor (importante)

Por padrão, o Cursor pode executar o MCP em modo sandbox, o que pode bloquear o TestSprite. Para funcionamento completo:

1. **Cursor** → **Settings** → **Cursor Settings**.
2. **Chat** → **Auto-Run** → **Auto-Run Mode**.
3. Defina como **"Ask Every time"** ou **"Run Everything"** (não apenas sandbox).

## 3. Executar sua aplicação

O TestSprite executa os testes contra uma instância em execução da sua aplicação. Inicie o servidor de desenvolvimento neste projeto:

```bash
npm install
npm run dev
```

A aplicação ficará em **http://localhost:3000** (veja `vite.config.ts`). Mantenha-a rodando durante os testes.

## 4. Acionar o TestSprite pelo Cursor

No chat do Cursor, peça à IA para usar o TestSprite, por exemplo:

- **"Ajude-me a testar este projeto com o TestSprite."**
- **"Pode testar este projeto com o TestSprite?"**

O assistente usará as ferramentas MCP do TestSprite para:

1. Analisar o projeto (React + TypeScript + Vite).
2. Gerar ou usar um PRD e plano de testes normalizados.
3. Criar/executar testes Playwright contra sua aplicação em execução.
4. Gerar relatórios (aprovado/reprovado, bugs, sugestões).

## 5. O que esperar

- **Primeira execução:** O TestSprite pode gerar um PRD, plano de testes e casos de teste (por exemplo em uma pasta no estilo `testsprite_tests/`) e depois executá-los.
- **Resultados:** Você receberá um resumo e, em geral, relatórios em HTML/PDF; falhas incluem detalhes do erro e sugestões.
- **Este projeto:** Inclui Swap, Pools, My Pools, Mint NFTs, My NFTs e Web3 (wagmi/viem). Os testes podem cobrir navegação, formulários e fluxos que dependem de carteira (alguns fluxos podem exigir carteira conectada ou testnet).

## 6. Integração e testes locais

- **Integração TestSprite:** Veja [TESTSPRITE_INTEGRATION.md](./TESTSPRITE_INTEGRATION.md) para como usar o TestSprite quando o MCP estiver conectado e como combinar com os testes Playwright locais.
- **Testes E2E locais:** O projeto tem testes Playwright em `e2e/`. Rode com `npm run test:e2e`. Inclui navegação, smoke, carteira (Connect Wallet, modal) e formulários (Swap, Mint, My NFTs).

## Solução de problemas

- **"Command not found" / MCP não inicia:** Verifique se o Node.js ≥ 22 e se o `npx` funciona; tente rodar `npx @testsprite/testsprite-mcp@latest` no terminal.
- **Testes falham ou estouram o tempo:** Confira se o servidor de desenvolvimento está rodando na porta que o TestSprite usa (ex.: 3000) e se a URL nos testes gerados corresponde à sua aplicação (localhost e porta).
- **Erros de sandbox / permissão:** Use a configuração de Auto-Run do Cursor acima para que o TestSprite possa executar testes e acessar a aplicação.
- **Mais ajuda:** [Documentação TestSprite](https://docs.testsprite.com/), [Instalação](https://docs.testsprite.com/mcp/getting-started/installation), [Solução de problemas](https://docs.testsprite.com/mcp/troubleshooting/installation-issues).
