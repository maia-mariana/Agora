# Roadmap — do MVP de hackathon a produto de produção

Este documento existe para que qualquer avaliador técnico ou de negócio entenda exatamente **o que já está implementado**, o que é **demonstração funcional** (funciona de verdade, mas com simplificações conscientes) e o que **ainda não existe**. Transparência aqui é deliberada: um roadmap honesto é mais convincente do que um MVP que finge ser produto acabado.

## Legenda

- ✅ Implementado e funcional no MVP atual
- ⚠️ Implementado com simplificação consciente (funciona, mas precisa de evolução antes de produção)
- ⬜ Não implementado — próximo passo

---

## Núcleo do produto

| Item | Status | Notas |
|---|---|---|
| Cálculo do índice ARGOS (média ponderada) | ✅ | Ver [ARGOS-METHODOLOGY.md](ARGOS-METHODOLOGY.md) |
| Regra de bloqueio por variável crítica | ✅ | Testado nos 5 cenários de demonstração |
| Gate GO/CONDICIONAL/HOLD/NO-GO | ✅ | Limiares fixos (75/60/45, com margem de 5 pontos para "quase-falha" crítica) — ver calibração abaixo |
| Matriz de variáveis editável (CRUD completo) | ✅ | Adicionar/remover/reagrupar variáveis livremente |
| Mapa de calor de incerteza por fundamento | ✅ | |
| Assistente de mitigação (sugestão de ação + custo estimado) | ⚠️ | Biblioteca de ações é uma lista estática de regras (`ACTION_LIBRARY`), casada por regex no nome da variável — funciona bem para o vocabulário atual, mas não generaliza para nomes de variáveis totalmente novos sem adicionar uma regra correspondente |
| Simulação de Monte Carlo (1.000 iterações) | ✅ | Distribuição de preço/OPEX, sem correlação entre variáveis (ver abaixo) |
| Cálculo de NPV | ✅ | Fluxo de caixa descontado, 10 anos, taxa de desconto 10% fixa |
| Cálculo de IRR | ⚠️ | **Aproximação linear**, não solução iterativa exata — ver [SPECIFICATION.md §3.3](SPECIFICATION.md#33-simulação-financeira-stress-test) |
| Comparador de cenários As-Is vs. To-Be | ✅ | Aplica a mitigação das 2 variáveis mais fracas e recalcula |
| Exportação CSV/JSON | ✅ | |
| Importação CSV/JSON + Google Sheets | ✅ | Sheets requer link publicado como CSV; sem OAuth |
| Exportação PDF (resumo executivo) | ✅ | Via `window.print()` — depende do navegador/driver de impressão do usuário |

### Calibração dos limiares

Os limiares 75/60/45 (gate) e os limites mínimos por variável crítica (ex: Offtake ≥ 80) são **hipóteses de design**, não resultado de calibração estatística contra uma base histórica de projetos reais aprovados/reprovados. Antes de uso em decisão de capital real:

- ⬜ Levantar base histórica de projetos de minerais críticos com desfecho conhecido (aprovado/reprovado/atrasado) para calibrar os limiares por regressão ou benchmarking com especialistas.
- ⬜ Tornar os limiares configuráveis por política de risco do investidor/fundo, não apenas por projeto individual.

---

## Dados e persistência

| Item | Status | Notas |
|---|---|---|
| Modelo de dados em memória | ✅ | Funciona perfeitamente para demonstração |
| Persistência entre sessões | ⬜ | **Prioridade #1 para pós-hackathon.** Hoje, recarregar a página apaga tudo. Opções avaliadas: `localStorage` para protótipo rápido (não serve para múltiplos usuários); backend real com banco de dados relacional (Postgres) para produção |
| Multiusuário / multiorganização | ⬜ | Requer autenticação, autorização por papel (analista/comitê/admin) e isolamento de dados por cliente |
| Histórico de versões de um projeto | ⬜ | Hoje só existe "Restaurar exemplo" (volta ao seed original); não há trilha de auditoria de quem mudou o quê e quando — importante para um produto que se posiciona como "auditável" |
| Banco de conhecimento ÁGORA (NRMs, benchmarks, critérios ESG) | ⬜ | Mencionado na visão de produto (ver README/pitch), ainda não modelado como dado — hoje as regras de mitigação são estáticas no código |

---

## Assistente ARGOS Copilot

| Item | Status | Notas |
|---|---|---|
| System prompt de diagnóstico técnico | ✅ | Ver [SPECIFICATION.md §5.1](SPECIFICATION.md#51-persona-e-restrições-system-prompt) |
| Extração de contexto da tela (RAG leve) | ✅ | |
| Chamada de API funcional | ⚠️ | **Depende de uma camada de proxy/autenticação que não está incluída neste repositório.** No ambiente onde o MVP foi originalmente construído, essa chamada era resolvida automaticamente; para rodar o repositório de forma independente, é necessário: (a) implementar um pequeno backend/edge function que injete a chave de API da Anthropic sem expô-la no client, ou (b) trocar por outra estratégia de integração |
| Encaminhamento H2H (Athena) | ✅ | Hoje é apenas uma mensagem de texto — não há integração real com fila/CRM da Athena |
| Rate limiting / controle de custo de API | ⬜ | Sem esse controle, uso real exporia a aplicação a custo de API não controlado |

---

## Visualização 3D

| Item | Status | Notas |
|---|---|---|
| Busto procedural em Three.js | ✅ | Sem asset externo — geometrias primitivas |
| Interação de arraste | ✅ | |
| Modelo 3D "real" de Sócrates (asset modelado) | ⬜ | O pedido original de produto era um modelo 3D fiel; o que existe é uma composição estilizada com primitivas, suficiente para a demonstração mas não um asset artístico dedicado |

---

## Segurança e conformidade

| Item | Status | Notas |
|---|---|---|
| Autenticação de usuários | ⬜ | Inexistente — qualquer pessoa com a URL acessa e edita tudo |
| Controle de acesso por dado sensível | ⬜ | Mencionado na visão de produto (anonimização, segregação por cliente, criptografia) — nenhum desses controles existe no código atual |
| LGPD / dados sensíveis | ⬜ | O pitch do produto assume esses controles como parte da proposta de valor ("Banco de Dados e Governança") — precisam ser implementados antes de qualquer dado real de cliente transitar pela plataforma |
| Testes automatizados | ⬜ | Validação até aqui foi manual/exploratória durante o desenvolvimento; não há suíte de testes (unitário, integração, e2e) versionada no repositório |

---

## Priorização sugerida para os próximos 90 dias

1. **Persistência real** (backend + banco de dados) — sem isso, nada mais é utilizável fora de demonstração.
2. **Autenticação básica + isolamento por organização** — pré-requisito para qualquer piloto com cliente real.
3. **Proxy seguro para a API de IA** — destravar o assistente conversacional fora do ambiente original.
4. **IRR exato** (Newton-Raphson ou biblioteca financeira) — correção pontual de baixo esforço, alto valor de credibilidade.
5. **Calibração dos limiares do gate com dados reais ou painel de especialistas.**
6. **Suíte de testes automatizados** para o motor de cálculo (`composite`, `gateFor`, `runStress`, `runMonteCarlo`) — é a lógica mais crítica do produto e a mais barata de cobrir com testes unitários.
