# Atualização para Router Novo (Patchado) - Diff Exato

## Objetivo
Garantir que o app **SEMPRE** use o Router patchado (`0x186E441453477D280eeB010f45A7Fad2413156EC`) e **NUNCA** use routers antigos.

---

## Arquivos Alterados

1. `src/config/deployments.arc-testnet.json`
2. `.env`
3. `.env.example`
4. `src/config/arcDex.ts`
5. `src/components/Swap/SwapInterface.tsx`

---

## 1. Diff: `src/config/deployments.arc-testnet.json`

```diff
--- a/src/config/deployments.arc-testnet.json
+++ b/src/config/deployments.arc-testnet.json
@@ -1,7 +1,7 @@
 {
   "chainId": 5042002,
   "factory": "0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F",
-  "router": "0xD9540A723500498df9E682e438571d374e903204",
+  "router": "0x186E441453477D280eeB010f45A7Fad2413156EC",
   "tokens": {
     "USDC": {
       "address": "0x3600000000000000000000000000000000000000",
```

---

## 2. Diff: `.env`

```diff
--- a/.env
+++ b/.env
@@ -12,7 +12,7 @@
 VITE_DEX_FACTORY_ADDRESS=0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F
 
-# Router (deployado no Remix com Factory 0x386c7CEc...)
-VITE_DEX_ROUTER_ADDRESS=0xD9540A723500498df9E682e438571d374e903204
+# Router (patchado, compatível com USDC precompile - Factory 0x386c7CEc...)
+VITE_DEX_ROUTER_ADDRESS=0x186E441453477D280eeB010f45A7Fad2413156EC
```

---

## 3. Diff: `.env.example`

```diff
--- a/.env.example
+++ b/.env.example
@@ -11,7 +11,8 @@
 
 # ArcDEX Router (Swap) — 0x + 40 caracteres hex.
-# Após deploy (Remix ou npm run deploy:router), cole aqui o endereço do Router.
+# Router patchado (compatível com USDC precompile): 0x186E441453477D280eeB010f45A7Fad2413156EC
 # Se vazio, o app usa o "router" de src/config/deployments.arc-testnet.json
-VITE_DEX_ROUTER_ADDRESS=
+VITE_DEX_ROUTER_ADDRESS=0x186E441453477D280eeB010f45A7Fad2413156EC
```

---

## 4. Diff: `src/config/arcDex.ts`

```diff
--- a/src/config/arcDex.ts
+++ b/src/config/arcDex.ts
@@ -11,13 +11,40 @@
   }
 }
 
+// Routers antigos conhecidos (sem TransferHelper, incompatíveis com USDC precompile) - BLOQUEADOS
+const OLD_ROUTERS = [
+  '0xD9540A723500498df9E682e438571d374e903204',
+  '0x2C1aA15ED76AfB280f14d82cDDA62841949f50dd',
+  '0xe2dC34b787d0C6bD1FCB90D472770f8Dd691e25c',
+].map(a => a.toLowerCase())
+
+// Router correto (patchado, compatível com USDC precompile)
+const CORRECT_ROUTER = '0x186E441453477D280eeB010f45A7Fad2413156EC'.toLowerCase()
+
 function parseRouter(r?: string): `0x${string}` | undefined {
   if (!r || typeof r !== 'string') return undefined
   const trimmed = r.trim()
   if (trimmed.length !== 42 || !trimmed.startsWith('0x')) return undefined
+  const addr = trimmed.toLowerCase()
+  // Bloquear routers antigos conhecidos
+  if (OLD_ROUTERS.includes(addr)) {
+    console.error(`[ArcDEX config] Router antigo bloqueado: ${trimmed}. Use o router patchado: 0x186E441453477D280eeB010f45A7Fad2413156EC`)
+    return undefined
+  }
   return trimmed as `0x${string}`
 }
 
 // Router: .env (VITE_DEX_ROUTER_ADDRESS) tem prioridade; senão usa deployments.arc-testnet.json
 const envRouter = typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DEX_ROUTER_ADDRESS
   ? parseRouter(import.meta.env.VITE_DEX_ROUTER_ADDRESS as string)
   : undefined
-const router = envRouter ?? parseRouter(deployments.router)
+const jsonRouter = parseRouter(deployments.router)
+const router = envRouter ?? jsonRouter
 const factory = deployments.factory as `0x${string}`
+
+// Validar que router não é antigo
+if (router && router.toLowerCase() !== CORRECT_ROUTER) {
+  console.warn(`[ArcDEX config] Router configurado (${router}) não é o router patchado esperado (0x186E441453477D280eeB010f45A7Fad2413156EC). Verifique se é compatível com USDC precompile.`)
+}
```

---

## 5. Diff: `src/components/Swap/SwapInterface.tsx`

### 5.1 Mensagem de erro melhorada para factory mismatch

```diff
--- a/src/components/Swap/SwapInterface.tsx
+++ b/src/components/Swap/SwapInterface.tsx
@@ -1628,7 +1628,7 @@
         )}
-        {routerFactoryOk === false && DEX_ROUTER_ADDRESS && (
-          <div className="text-xs text-amber-400/90 mt-2 flex flex-col gap-1">
+        {routerFactoryOk === false && DEX_ROUTER_ADDRESS && (
+          <div className="text-xs text-red-400/95 mt-2 flex flex-col gap-1 p-2 rounded bg-red-950/30 border border-red-600/40">
             <div className="flex items-center gap-1">
-              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
-              <span>Router ({DEX_ROUTER_ADDRESS.slice(0, 10)}...) não foi deployado com a Factory da config.</span>
+              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
+              <span className="font-medium text-red-300">Router deployado com outra Factory (mismatch)</span>
             </div>
+            <div className="text-red-200/90 font-mono text-xs">
+              <div>Router config: {DEX_ROUTER_ADDRESS}</div>
+              <div>Factory config: {CONFIG_FACTORY}</div>
               {debugData?.routerFactoryOnChain && (
-                <span className="text-amber-200/90 font-mono">router.factory() on-chain: {debugData.routerFactoryOnChain} → esperado: 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F</span>
+                <div>router.factory() on-chain: {debugData.routerFactoryOnChain}</div>
               )}
+            </div>
-            <span className="text-amber-300/80">Redeploy no Remix: constructor _factory = 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F. Depois atualize &quot;router&quot; em deployments.arc-testnet.json. docs/DEPLOY_ROUTER_REMIX.md</span>
+            <span className="text-red-300/80 mt-1">O swap vai reverter. Use o Router correto: <code className="bg-slate-800/80 px-1 rounded">0x186E441453477D280eeB010f45A7Fad2413156EC</code> (deployado com Factory {CONFIG_FACTORY.slice(0, 10)}...). Atualize <code className="bg-slate-800/80 px-1 rounded">VITE_DEX_ROUTER_ADDRESS</code> no .env ou <code className="bg-slate-800/80 px-1 rounded">router</code> em deployments.arc-testnet.json.</span>
           </div>
         )}
```

### 5.2 Validação visual no Debug Panel

```diff
--- a/src/components/Swap/SwapInterface.tsx
+++ b/src/components/Swap/SwapInterface.tsx
@@ -1756,6 +1756,13 @@
                 <div><span className="text-slate-500">routerAddress (config):</span> <span className="text-cyan-400 break-all">{debugData.routerAddress}</span></div>
                 <div><span className="text-slate-500">factoryAddress (config):</span> <span className="text-cyan-400 break-all">{debugData.factoryAddress}</span></div>
                 <div><span className="text-slate-500">router.factory() on-chain:</span> <span className="text-cyan-400 break-all">{debugData.routerFactoryOnChain ?? '—'}</span></div>
+                {debugData.routerFactoryOnChain && debugData.factoryAddress && (
+                  <div>
+                    <span className="text-slate-500">Factory match:</span>{' '}
+                    {debugData.routerFactoryOnChain.toLowerCase() === debugData.factoryAddress.toLowerCase() ? (
+                      <span className="text-emerald-400">✓ OK (router.factory() == factory config)</span>
+                    ) : (
+                      <span className="text-red-400">✗ MISMATCH (router deployado com outra Factory)</span>
+                    )}
+                  </div>
+                )}
                 <div><span className="text-slate-500">pair = factory.getPair(tokenFrom, tokenTo):</span> <span className="text-cyan-400 break-all">{debugData.pairAddress ?? 'address(0)'}</span></div>
```

---

## Resumo das Alterações

### A) Configuração atualizada
- ✅ `deployments.arc-testnet.json`: router atualizado para `0x186E441453477D280eeB010f45A7Fad2413156EC`
- ✅ `.env`: `VITE_DEX_ROUTER_ADDRESS` atualizado para router novo
- ✅ `.env.example`: router novo como padrão

### B) Validação e bloqueio
- ✅ `arcDex.ts`: Lista de routers antigos bloqueados (`OLD_ROUTERS`)
- ✅ `arcDex.ts`: `parseRouter()` retorna `undefined` se router estiver na lista de bloqueio
- ✅ `arcDex.ts`: Warning no console se router configurado não for o esperado

### C) Debug melhorado
- ✅ `SwapInterface.tsx`: Mensagem de erro melhorada para factory mismatch (vermelho, mais clara)
- ✅ `SwapInterface.tsx`: Debug Panel mostra validação visual "Factory match: ✓ OK" ou "✗ MISMATCH"

### D) Prioridade de config
- ✅ Mantida: `.env` (`VITE_DEX_ROUTER_ADDRESS`) tem prioridade sobre `deployments.arc-testnet.json`
- ✅ Ambos agora apontam para o router novo
- ✅ Se `.env` tiver router antigo, ele será bloqueado e o app usará `undefined` (ou o do JSON se válido)

---

## Como Validar

1. **Reinicie o app** (`npm run dev`)
2. **Abra a tela de Swap**
3. **Verifique no console** (F12):
   - `[ArcDEX config] routerAddress: 0x186E441453477D280eeB010f45A7Fad2413156EC`
   - `[ArcDEX config] router source: .env (VITE_DEX_ROUTER_ADDRESS)` ou `deployments.arc-testnet.json`
4. **Abra o Debug Panel (Swap)** e verifique:
   - `routerAddress (config): 0x186E441453477D280eeB010f45A7Fad2413156EC`
   - `factoryAddress (config): 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`
   - `router.factory() on-chain: 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`
   - `Factory match: ✓ OK (router.factory() == factory config)`
5. **Se aparecer aviso vermelho** de factory mismatch, o Router on-chain não foi deployado com a Factory correta.

---

## Teste de Bloqueio

Para testar se o bloqueio funciona, tente colocar um router antigo no `.env`:

```env
VITE_DEX_ROUTER_ADDRESS=0xD9540A723500498df9E682e438571d374e903204
```

O console deve mostrar:
```
[ArcDEX config] Router antigo bloqueado: 0xD9540A723500498df9E682e438571d374e903204. Use o router patchado: 0x186E441453477D280eeB010f45A7Fad2413156EC
```

E o app deve usar `undefined` (ou o router do JSON se válido), e a tela de Swap deve mostrar "Router não configurado".
