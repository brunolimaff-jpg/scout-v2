import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content);
  console.log(`[runtime-patches] updated ${rel}`);
}

function patch(rel, transform) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) {
    console.warn(`[runtime-patches] skipped missing ${rel}`);
    return;
  }
  const before = read(rel);
  const after = transform(before);
  if (after !== before) write(rel, after);
  else console.log(`[runtime-patches] no changes ${rel}`);
}

function ensureImport(content, importLine) {
  if (content.includes(importLine)) return content;
  const lines = content.split('\n');
  let insertAt = 0;
  while (insertAt < lines.length && lines[insertAt].startsWith('import ')) insertAt += 1;
  lines.splice(insertAt, 0, importLine);
  return lines.join('\n');
}

function ensureRouteMaxDuration(content, seconds) {
  if (/export\s+const\s+maxDuration\s*=/.test(content)) {
    return content.replace(/export\s+const\s+maxDuration\s*=\s*\d+\s*;?/g, `export const maxDuration = ${seconds};`);
  }
  const lines = content.split('\n');
  let insertAt = 0;
  while (insertAt < lines.length && lines[insertAt].startsWith('import ')) insertAt += 1;
  lines.splice(insertAt, 0, '', `export const maxDuration = ${seconds};`);
  return lines.join('\n');
}

function patchLLMRoute(content) {
  let next = ensureImport(content, "import { chatCompletion } from '@/lib/llm';");
  next = next.replace(/await\s+zai\.chat\.completions\.create\s*\(/g, 'await chatCompletion(');
  next = next.replace(/await\s+this\.client\.chat\.completions\.create\s*\(/g, 'await chatCompletion(');
  return next;
}

patch('src/app/api/scout/investigate/route.ts', (content) => {
  let next = patchLLMRoute(content);
  next = ensureRouteMaxDuration(next, 600);

  // Server heartbeat should keep the connection alive without creating anxious warning copy.
  next = next.replace(/\/\/ Heartbeat: send warning if >10s between events[\s\S]*?\}, 10000\);/m, `// Heartbeat: keep the SSE connection alive. This is NOT a warning and not progress.
        heartbeatInterval = setInterval(() => {
          if (closed) {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            return;
          }
          try {
            controller.enqueue(encoder.encode(sseEvent('heartbeat', {
              timestamp: new Date().toISOString(),
            }, runId)));
          } catch {
            closed = true;
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        }, 60_000);`);

  // Make any remaining anxious fallback copy neutral.
  next = next
    .replace(/Pipeline em andamento — aguardando resposta do provedor\.{3}/g, 'Investigação ativa — validando fontes e evidências.')
    .replace(/continuando com outras fontes\.\.\./g, 'tentando outras fontes reais...')
    .replace(/Busca competitiva falhou, continuando sem dados de concorrência\./g, 'Busca competitiva falhou; nenhum sinal competitivo será exibido sem fonte.');

  return next;
});

patch('src/app/api/warroom/chat/route.ts', (content) => {
  let next = patchLLMRoute(content);
  next = ensureRouteMaxDuration(next, 300);
  next = next.replace(/const pageData = await withTimeout\(zai\.functions\.invoke\('page_reader', \{ url \}\), 15000\);/g,
    "const pageData = await withTimeout(zai.functions.invoke('page_reader', { url }), 60_000);");
  next = next.replace('Não foi possível gerar uma resposta no momento. Por favor, tente novamente.',
    'Não consegui gerar uma resposta com base documental suficiente neste momento. Tente informar o produto, módulo, rotina ou erro com mais contexto.');
  return next;
});

patch('src/lib/research-engine.ts', (content) => {
  let next = ensureImport(content, "import { chatCompletion } from '@/lib/llm';");
  next = next.replace(/timeoutMs:\s*30000/g, 'timeoutMs: 90_000');
  next = next.replace(/timeoutMs:\s*60000/g, 'timeoutMs: 180_000');
  next = next.replace(/AbortSignal\.timeout\(10000\)/g, 'AbortSignal.timeout(60_000)');
  next = next.replace(/\{ maxRetries:\s*1, timeoutMs:\s*15000 \}/g, '{ maxRetries: 2, timeoutMs: 90_000 }');
  next = next.replace(/async chat\(messages: Array<\{ role: 'user' \| 'system' \| 'assistant'; content: string \}>\): Promise<string> \{[\s\S]*?return result\.choices\?\.\[0\]\?\.message\?\.content\?\.trim\(\) \|\| '';/m,
`async chat(messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>): Promise<string> {
    const result = await withRetry(
      async () => chatCompletion({ messages, thinking: { type: 'disabled' } }),
      { maxRetries: 1, timeoutMs: 180_000 },
    );
    return result.choices?.[0]?.message?.content?.trim() || '';`);
  return next;
});

patch('src/components/scout-view.tsx', (content) => {
  let next = content;
  next = next.replace(/const SSE_STREAM_TIMEOUT_MS = 30_000[^\n]*/,
    'const SSE_STREAM_TIMEOUT_MS = 180_000 // 3 minutes idle timeout; deep investigations may run for several minutes');
  next = next.replace(/\/\/ No data received for 30 seconds — abort/g,
    '// No useful server data received for 3 minutes — fail honestly, not cancel');
  next = next.replace(/console\.warn\('\[SSE\] Stream timeout — no data received for 30s'\)/g,
    "console.warn('[SSE] Stream idle timeout — no data received for 3 minutes')");
  next = next.replace('A investigação demorou demais para responder. Tente novamente.',
    'A investigação ficou sem resposta do servidor por alguns minutos. Vou marcar como falha para evitar falso sucesso.');
  next = next.replace('A investigação foi interrompida antes de concluir. Tente novamente.',
    'A conexão foi encerrada antes da resposta final. A investigação foi marcada como falha, sem gerar score ou CRM.');
  next = next.replace("case 'warning':\n        // Heartbeat warning from server — just add to ticker", "case 'heartbeat':\n        // Keep-alive only. Do not show as warning/progress.\n        break\n      case 'warning':\n        // Real warning from server — add to ticker");
  next = next.replace(/if \(err instanceof Error && err\.name === 'AbortError'\) \{\n        setError\(\{ type: 'cancelled', message: 'Investigação cancelada\.' \}\)\n      \}/,
    "if (err instanceof Error && err.name === 'AbortError') {\n        setError({ type: isCancelling ? 'cancelled' : 'timeout', message: isCancelling ? 'Investigação cancelada.' : 'A conexão foi interrompida sem ação manual. Marquei como falha para evitar falso sucesso.' })\n      }");
  return next;
});

patch('src/components/investigation-loader.tsx', (content) => {
  let next = content.replace(/const PROGRESSIVE_MESSAGES = \[[\s\S]*?\]\n\nexport function getProgressiveMessage/m,
`const PROGRESSIVE_MESSAGES = [
  { threshold: 120, message: 'Pesquisa aprofundada em andamento. Validando fontes antes de responder.' },
  { threshold: 300, message: 'A investigação ainda está ativa. Fontes externas e validações podem levar alguns minutos.' },
  { threshold: 480, message: 'Estamos próximos do limite operacional desta investigação. Se não houver evidência suficiente, a busca falhará de forma segura.' },
]

export function getProgressiveMessage`);

  next = next
    .replace(/Tentando fonte alternativa\.\.\./g, 'Consultando fontes públicas e oficiais...')
    .replace(/Reconsultando com outro provedor\.\.\./g, 'Buscando sinais competitivos com fontes reais...')
    .replace(/A investigação está levando mais tempo que o esperado\. Verificando consistência das fontes\.\.\./g, 'Pesquisa aprofundada em andamento.');
  return next;
});

console.log('[runtime-patches] done');
