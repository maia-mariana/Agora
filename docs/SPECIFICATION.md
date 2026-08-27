# ÁGORA — Especificação Técnica

> Documento de referência para avaliação técnica, due diligence de engenharia e planejamento de evolução para produção.

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Modelo de dados](#2-modelo-de-dados)
3. [Motor de cálculo (ARGOS + Gate)](#3-motor-de-cálculo-argos--gate)
4. [Módulos funcionais](#4-módulos-funcionais)
5. [Assistente ARGOS Copilot](#5-assistente-argos-copilot)
6. [Visualização 3D (widget flutuante)](#6-visualização-3d-widget-flutuante)
7. [Sistema de temas](#7-sistema-de-temas)
8. [Persistência e estado](#8-persistência-e-estado)
9. [Integrações externas](#9-integrações-externas)
10. [Limitações conhecidas do MVP](#10-limitações-conhecidas-do-mvp)

---

## 1. Visão geral da arquitetura

ÁGORA é hoje um **single-page application client-side**, sem backend próprio. Toda a lógica — modelo de dados, cálculo do índice, simulações, renderização de gráficos — roda no navegador, em JavaScript vanilla (sem framework, sem bundler).

```
┌─────────────────────────────────────────────┐
│  index.html                                  │
│  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Landing     │  │  App (SPA)           │   │
│  │  page        │→ │  Projetos/Dashboard/ │   │
│  │  (hero, CTA) │  │  Detalhe do Projeto  │   │
│  └─────────────┘  └─────────────────────┘   │
│           css/styles.css (tema claro/escuro) │
│           js/app.js (todo o estado + lógica) │
│           js/vendor/{chart,three}.min.js     │
└─────────────────────────────────────────────┘
              │                    │
              ▼                    ▼
   api.anthropic.com/v1/messages   Google Fonts (CDN)
   (assistente conversacional,
    chamado a partir do navegador)
```

**Decisão de arquitetura**: manter o MVP 100% estático foi deliberado — elimina a necessidade de infraestrutura de servidor para a demonstração, permite hospedagem gratuita (GitHub Pages/Netlify) e reduz a superfície de falha durante a apresentação. A seção [Limitações conhecidas](#10-limitações-conhecidas-do-mvp) detalha o que isso implica para produção.

---

## 2. Modelo de dados

### 2.1 Projeto

```ts
interface Project {
  id: string;
  name: string;
  mineral: string;          // ex: "Lítio", "Terras Raras", "Cobalto"
  country: string;          // ex: "Brasil (Jequitinhonha, MG)"
  phase: string;            // "Exploração" | "Prefeasibility" | "Feasibility" | "Construção" | "Operação"
  capex: number;            // USD
  opex: number;             // USD/ano
  price: number;            // USD por tonelada (preço de referência do mineral)
  production: number;       // toneladas/ano
  variables: Variable[];    // as 10 variáveis dos 5 fundamentos (ver 2.2)
  seedVariables: Variable[];  // snapshot original, para "Restaurar exemplo"
  seedFinancial: { capex, opex, price, production };
}
```

### 2.2 Variável (unidade atômica do índice)

```ts
interface Variable {
  id: string;
  name: string;              // ex: "Recuperação Metalúrgica"
  group: 'GEO'|'PROC'|'ENG'|'MKT'|'ESG';
  score: number;             // 0–100, nota atual
  weight: number;            // peso relativo dentro do índice (soma ideal = 100 entre as 10 variáveis)
  critical: boolean;         // se true, participa da regra de bloqueio do gate
  minThreshold: number;      // limite mínimo — só relevante se critical=true
}
```

### 2.3 Os 5 fundamentos (grupos)

| Código | Nome completo | Cor de referência |
|---|---|---|
| `GEO` | Geologia & Lavra | `#8B5E34` |
| `PROC` | Processamento & Tratamento Mineral | `#6E5AA0` |
| `ENG` | Engenharia & Infra & Supply Chain | `#3B6EA5` |
| `MKT` | Mercado & Financeiro | `#B8863B` |
| `ESG` | ESG & Licenciamento & Regulatório | `#2E7D46` |

Cada fundamento contém, por padrão, **2 variáveis** (10 no total). O usuário pode adicionar, remover ou reagrupar variáveis livremente pela interface — o modelo não é fixo em código, é dirigido pelos dados carregados em `projects[]`.

**Variáveis padrão (seed) e seus limiares críticos:**

| Variável | Grupo | Peso | Crítica | Limite mínimo |
|---|---|---|---|---|
| Confiança dos Recursos Minerais | GEO | 10 | ✓ | 70 |
| Densidade de Sondagem | GEO | 10 | — | 55 |
| Recuperação Metalúrgica | PROC | 10 | ✓ | 70 |
| Maturidade da Rota de Processo | PROC | 10 | — | 55 |
| Maturidade da Engenharia (FEL) | ENG | 10 | — | 55 |
| Infraestrutura Disponível | ENG | 10 | ✓ | 55 |
| Resiliência de Preço | MKT | 10 | — | 50 |
| Offtake e Compradores | MKT | 10 | ✓ | 80 |
| Licenciamento Ambiental | ESG | 10 | ✓ | 65 |
| Relacionamento Comunitário | ESG | 10 | — | 60 |

---

## 3. Motor de cálculo (ARGOS + Gate)

Toda a lógica descrita aqui vive em `js/app.js`, seção `COMPUTE HELPERS`. A metodologia completa, com exemplos numéricos passo a passo, está em **[ARGOS-METHODOLOGY.md](ARGOS-METHODOLOGY.md)** — esta seção documenta apenas a implementação.

### 3.1 Índice composto

```js
function composite(vars) {
  const t = totalWeight(vars);
  return vars.reduce((s, v) => s + (v.score * v.weight) / t, 0);
}
```
Média ponderada simples, normalizada pelo peso total (tolera o total de pesos não fechar exatamente em 100 — a UI avisa, mas não trava o cálculo).

### 3.2 Regra de gate (decisão)

```js
function criticalNearMisses(vars){
  return vars.filter(v => v.critical && v.score < v.minThreshold && v.score >= v.minThreshold - 5);
}
function criticalHardFails(vars){
  return vars.filter(v => v.critical && v.score < v.minThreshold - 5);
}
function gateFor(vars) {
  const c = composite(vars);
  const hardFails = criticalHardFails(vars);
  const nearMisses = criticalNearMisses(vars);

  if (hardFails.length)  return { decision: 'NO-GO', ... };   // > 5 pontos abaixo do limite: bloqueio duro
  if (nearMisses.length) return { decision: 'HOLD', ... };    // até 5 pontos abaixo: aguardar mais dado
  if (c >= 75) return { decision: 'GO', ... };
  if (c >= 60) return { decision: 'CONDICIONAL', ... };
  if (c >= 45) return { decision: 'HOLD', ... };
  return { decision: 'NO-GO', ... };
}
```

**Este é o mecanismo de governança central do produto**, com duas camadas: (1) uma variável crítica reprovada bloqueia o gate independentemente da nota composta, e (2) o tamanho da reprovação importa — uma quase-falha (até 5 pontos abaixo do limite) resulta em `HOLD` ("aguardar mais dado"), enquanto uma falha dura (mais de 5 pontos abaixo) resulta em `NO-GO` direto. O cenário de demonstração "Projeto Cobalto Lafaiete" existe justamente para evidenciar esse comportamento (composto de 77.5, mas `NO-GO` por offtake 20 pontos abaixo do limite — uma falha dura clara).

### 3.3 Simulação financeira (stress test)

```js
function runStress(capex, opex, price, recovery, production, pshock, oshock) {
  const adjPrice = price * (1 + pshock/100);
  const adjOpex  = opex  * (1 + oshock/100);
  const revenue  = adjPrice * (recovery/100) * production;
  const cashflow = revenue - adjOpex;
  let npv = -capex;
  for (let y = 1; y <= 10; y++) npv += cashflow / Math.pow(1.10, y);  // 10 anos, 10% de desconto
  const irr = ((cashflow / capex) - 0.10) * 100;                      // aproximação, não IRR exato via Newton-Raphson
  return { npv, irr, cashflow };
}
```

> **Nota de precisão**: o IRR calculado é uma **aproximação linear**, não uma solução iterativa exata (Newton-Raphson) da equação de fluxo de caixa. Adequado para visualização comparativa de cenários no MVP; para uso em decisão de investimento real, substituir por uma implementação de IRR correta (ver [ROADMAP.md](ROADMAP.md)).

### 3.4 Simulação de Monte Carlo

1.000 iterações de `runStress()` com `pshock` uniformemente distribuído em `[-30%, +30%]` e `oshock` em `[-15%, +25%]`. A saída é a **probabilidade de NPV positivo** e o histograma da distribuição (renderizado como curva suave em SVG, não Chart.js — ver §4.4).

---

## 4. Módulos funcionais

### 4.1 Dashboard (portfólio)

Agrega todos os projetos: ARGOS médio, contagem por gate, exposição total de CAPEX, e um scatter de risco×retorno do portfólio inteiro (Chart.js).

### 4.2 Projetos (lista + CRUD)

Listagem com busca por nome/mineral e **filtro por status de gate** (pills clicáveis, sincronizadas com os KPIs do Dashboard — clicar em "Gates GO" no Dashboard leva à lista já filtrada). Criação de projeto novo nasce com todas as variáveis em 50/100 (neutro), o que resulta em `NO-GO` até o usuário inserir dados reais — comportamento intencional, não um bug.

### 4.3 Detalhe do projeto — fluxo de leitura

A ordem da interface segue deliberadamente a ordem de leitura de um comitê de investimento:

1. **Banner de decisão** — gate + score, acima da dobra.
2. **Testemunho de risco (ARGOS)** — gauge SVG + cilindro estratigráfico + legenda dos 5 fundamentos + inputs diretos de "5 parâmetros" (edita as 2 variáveis de um fundamento de uma vez).
3. **Diagnóstico & parecer** — mapa de calor de incerteza por fundamento + radar Chart.js + texto gerado automaticamente apontando os pontos fortes/fracos.
4. **5 Etapas da cadeia** — cards detalhados por fundamento, com sliders por variável.
5. **Matriz de calor** — tabela completa e editável de todas as variáveis (nome, grupo, peso, impacto, crítica, limite, nota, status).
6. **Análise preditiva** — grid 2×2: Assistente de Mitigação, Monte Carlo, Risco×Retorno (nuvem de simulações + cenários extremos), Comparador A/B.
7. **SWOT automático** (`renderSWOT()`) — 4 quadrantes gerados inteiramente a partir dos dados do projeto, sem entrada manual: Forças e Fraquezas vêm das 3 variáveis com nota mais alta/mais baixa (`Array.sort` sobre `p.variables`) e do fundamento mais forte/mais fraco (`groupScore` por grupo); Oportunidades vêm da maior alavanca de melhoria (a variável de menor nota) e do NPV de referência sem choque; Ameaças vêm do resultado do simulador de estresse combinado (preço -25%, OPEX +20%) e de uma nota fixa sobre o risco regulatório/cronograma típico da fase atual do projeto.
8. **Simulador de estresse** — CAPEX/OPEX/preço/produção editáveis + choques de mercado + NPV/IRR + "Relógio de Custo do Atraso".

### 4.4 Gráficos: por que Chart.js *e* SVG nativo coexistem

| Gráfico | Tecnologia | Motivo |
|---|---|---|
| Radar (5 fundamentos) | Chart.js | Tipo de gráfico não trivial de reimplementar à mão; baixo risco de problema de layout |
| Scatter de portfólio (Dashboard) | Chart.js | Idem |
| Comparador A/B (barras) | Chart.js | Idem |
| **Gauge ARGOS** | SVG nativo | Controle total do desenho (agulha, arco colorido) sem overhead de biblioteca |
| **Risco × Retorno (nuvem Monte Carlo)** | SVG nativo | Ver nota abaixo |
| **Distribuição de Monte Carlo** | SVG nativo | Ver nota abaixo |

> **Nota de decisão de engenharia**: os três gráficos mais críticos para a demonstração (gauge, nuvem de risco×retorno, distribuição de Monte Carlo) foram **deliberadamente reescritos em SVG puro**, abandonando Chart.js para esses casos específicos, após problemas recorrentes de timing de renderização do Chart.js em contextos de preview/sandbox durante o desenvolvimento. SVG gerado via string de template e injetado por `innerHTML` garante renderização síncrona e determinística, sem depender do ciclo de animação interno de uma biblioteca de terceiros. Essa decisão prioriza **confiabilidade de demonstração** sobre reuso de código.

### 4.5 Exportação

- **CSV** da matriz de variáveis (nome, grupo, nota, peso, crítica, limite, impacto calculado).
- **JSON** de configuração completa (permite versionar/comparar configurações de avaliação entre projetos).
- **Importação** simétrica de ambos os formatos, incluindo colagem direta de CSV vindo de uma planilha Google Sheets publicada.
- **PDF** via `window.print()` com uma folha de resumo executivo dedicada (`.print-only`), que esconde toda a UI interativa e mostra apenas os dados essenciais para impressão.

---

## 5. Assistente ARGOS Copilot

### 5.1 Persona e restrições (system prompt)

O assistente roda com um *system prompt* fixo que define seu papel como **diagnostizador técnico**, não como tomador de decisão — ele nunca declara um projeto "bom" ou "ruim" em termos absolutos, apenas lê e explica os dados. Toda resposta segue uma estrutura de 2 etapas obrigatória (mapeamento de dados → encaminhamento H2H para validação humana). O texto completo do prompt está em `js/app.js`, constante `ARGOS_COPILOT_SYSTEM_PROMPT` — deve ser tratado como **conteúdo de produto**, não como detalhe de implementação: qualquer alteração de tom, política de resposta ou fronteiras de atuação do assistente deve ser feita ali, não espalhada pelo código.

### 5.2 Fonte de contexto (RAG leve, sem backend)

Duas fontes de contexto são combinadas antes de cada pergunta ser enviada ao modelo:

1. **`extractPageKnowledge()`** — captura o texto visível da view ativa (`.view.active`) via `innerText`, removendo elementos de script/estilo/inputs, truncado a 6.000 caracteres. Funciona em qualquer tela da aplicação, não apenas na de detalhe de projeto.
2. **`buildCopilotContext(project)`** — quando a tela ativa é o detalhe de um projeto, monta um resumo estruturado (índice ARGOS, gate, motivo, cada variável com nota/peso/status) e concatena ao texto extraído, dando ao modelo dados exatos além do que está literalmente na tela.

### 5.3 Chamada de API

```js
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: ARGOS_COPILOT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: contextoMontado + perguntaDoUsuario }],
  }),
})
```

> **Requisito de ambiente**: esta chamada depende de um proxy/credencial que injete a autenticação da API da Anthropic no momento da requisição — **ela não funciona se o `index.html` for aberto isoladamente em qualquer servidor sem essa camada configurada**. Ver [ROADMAP.md](ROADMAP.md#assistente-conversacional) para as opções de como prover isso em produção (proxy backend próprio, Cloudflare Worker, etc.) antes de expor a funcionalidade a usuários reais.

### 5.4 Renderização das respostas

Um conversor de markdown minimalista (`mdToHtml()`) suporta apenas `**negrito**`, listas com `-` e cabeçalhos `###` — o suficiente para o estilo de resposta definido no system prompt, sem trazer uma biblioteca de markdown completa.

---

## 6. Visualização 3D (widget flutuante)

- Botão circular fixo (`position: fixed; bottom: 20px; right: 20px; z-index: 9999`), presente em **todas as telas** exceto a landing page (escondido via `body.landing-active .socrates-fab{display:none}`).
- Ao clicar, abre um modal com uma cena Three.js: um busto estilizado construído **inteiramente com geometrias primitivas** (esferas, cone, cilindro, toros) — não há arquivo `.glb`/`.gltf` externo. Isso elimina uma dependência de asset e mantém o peso do repositório previsível.
- Interação: arraste horizontal (`pointerdown`/`pointermove`) rotaciona o busto manualmente; sem interação, uma rotação automática lenta é aplicada.
- O chat dentro do modal reutiliza a mesma infraestrutura do ARGOS Copilot (§5), apenas com uma introdução de tom mais "socrático".

---

## 7. Sistema de temas

Duas paletas completas (claro/escuro) definidas via CSS custom properties no `:root` e sobrescritas em `html[data-theme="dark"]`. A troca é feita por `setTheme('light'|'dark')`, que também força o re-render dos gráficos Chart.js (que não reagem a mudança de CSS variables sozinhos — precisam ser recriados com as novas cores lidas via `getComputedStyle`).

---

## 8. Persistência e estado

**O MVP não persiste dados.** Todo o estado (`projects[]`, variáveis, configurações) vive em memória JavaScript e é perdido ao recarregar a página. Os 5 projetos de demonstração são recriados do zero a cada carregamento (`seed data` hardcoded em `js/app.js`).

Isso é adequado para uma demonstração controlada, mas é a limitação mais importante a resolver antes de qualquer uso real — ver [ROADMAP.md](ROADMAP.md#persistência).

---

## 9. Integrações externas

| Serviço | Uso | Obrigatório para o app funcionar? |
|---|---|---|
| Google Fonts | Tipografia (Playfair Display, Inter, JetBrains Mono) | Não — navegador usa fonte de sistema como fallback |
| API de mensagens da Anthropic | Assistente ARGOS Copilot | Não — o resto da aplicação funciona normalmente sem ela; só o chat fica inoperante |
| Google Sheets (via CSV publicado) | Importação alternativa de dados de variáveis | Não — recurso opcional, com fallback de colar CSV manualmente |

Nenhuma integração externa é estritamente necessária para demonstrar o cálculo do índice ARGOS, o gate, os gráficos ou os simuladores.

---

## 10. Limitações conhecidas do MVP

Documentadas aqui deliberadamente, para que qualquer avaliador técnico veja que são conscientes, não pontos cegos:

1. **Sem persistência** (§8) — dados voláteis, perdidos ao recarregar.
2. **Sem backend/autenticação** — qualquer pessoa com o link vê e edita todos os dados; não há separação por usuário/organização.
3. **IRR aproximado**, não exato (§3.3).
4. **Assistente conversacional depende de configuração de proxy externa** ao ambiente de desenvolvimento original (§5.3).
5. **Sem testes automatizados no repositório** — a lógica foi validada manualmente durante o desenvolvimento (ver histórico de commits/PRs quando disponível), mas não há suíte de testes unitários versionada ainda.
6. **Peso das variáveis não é validado contra 100%** de forma bloqueante — a UI avisa quando o total diverge, mas permite salvar mesmo assim.

O plano de evolução para endereçar cada item está em **[ROADMAP.md](ROADMAP.md)**.
