# Metodologia do Índice ARGOS

> Este documento explica **o que o número significa e por que a regra é essa** — para uso comercial, apresentação a investidores e validação de negócio. Para a implementação em código, ver [SPECIFICATION.md](SPECIFICATION.md#3-motor-de-cálculo-argos--gate).

## Por que "ARGOS"

Argos Panoptes, na mitologia grega, é o gigante de cem olhos que nunca dorme por completo — sempre há olhos abertos vigiando. O nome foi escolhido porque o índice não é uma fotografia estática de um relatório de risco: ele é recalculado a cada dado novo inserido, funcionando como uma vigilância contínua sobre a saúde do projeto, não uma avaliação pontual que expira.

ÁGORA é o nome da plataforma (a praça pública grega — o espaço onde a decisão de investimento é discutida e defendida); ARGOS é o índice que a plataforma calcula.

## Os 5 fundamentos

Um projeto de mineral crítico só é tão forte quanto seu elo mais fraco. O ARGOS divide a avaliação em 5 dimensões independentes, cada uma correspondendo a uma especialidade que hoje, no mercado, produz seu próprio relatório isolado:

| Fundamento | Pergunta que responde |
|---|---|
| **Geologia & Lavra** | O recurso mineral existe e está caracterizado com confiança suficiente? |
| **Processamento & Tratamento Mineral** | A rota metalúrgica recupera o mineral com pureza e escala comercialmente viáveis? |
| **Engenharia & Infra & Supply Chain** | O projeto tem maturidade de engenharia e infraestrutura (energia, água, logística) para ser construído? |
| **Mercado & Financeiro** | Existe comprador, e o preço resiste a choques de mercado? |
| **ESG & Licenciamento & Regulatório** | O projeto tem licença social e regulatória para operar sem travar no meio do caminho? |

Cada fundamento é decomposto em variáveis mensuráveis (por padrão, 2 por fundamento — 10 no total), cada uma com uma **nota de 0 a 100**, um **peso** dentro do índice, e um sinalizador de **criticidade**.

## A fórmula

$$
\text{ARGOS} = \frac{\sum_{i=1}^{n} \text{nota}_i \times \text{peso}_i}{\sum_{i=1}^{n} \text{peso}_i}
$$

Uma média ponderada simples — deliberadamente simples. A sofisticação do ARGOS não está na complexidade matemática da agregação, e sim em duas outras camadas:

### 1. A regra de variável crítica: falha dura vs. quase-falha

Cada variável pode ser marcada como **crítica**, com um **limite mínimo** aceitável. A plataforma distingue dois graus de reprovação, não apenas um:

- **Falha dura**: a nota está mais de 5 pontos abaixo do limite → bloqueio automático, `NO-GO`, não importa quão alto seja o ARGOS agregado.
- **Quase-falha**: a nota está abaixo do limite, mas dentro de uma margem de 5 pontos → `HOLD` — o projeto não é descartado, mas também não é aprovado; a leitura é "dado insuficiente para decidir com segurança, colete mais evidência".

Essa distinção existe porque uma média ponderada sozinha pode esconder um problema fatal atrás de notas boas em outras áreas — mas tratar toda reprovação de crítica da mesma forma também perde informação: "faltam 2 pontos" e "faltam 30 pontos" pedem ações muito diferentes. `HOLD` é o gate que separa esses dois mundos.

**Exemplo real (dados de demonstração da plataforma) — Projeto Cobalto Lafaiete:**

| Variável | Nota | Peso | Crítica | Limite | Situação |
|---|---|---|---|---|---|
| Confiança dos Recursos Minerais | 90 | 10 | ✓ | 70 | OK |
| Densidade de Sondagem | 75 | 10 | — | 55 | OK |
| Recuperação Metalúrgica | 85 | 10 | ✓ | 70 | OK |
| Maturidade da Rota de Processo | 72 | 10 | — | 55 | OK |
| Maturidade da Engenharia (FEL) | 85 | 10 | — | 55 | OK |
| Infraestrutura Disponível | 88 | 10 | ✓ | 55 | OK |
| Resiliência de Preço | 65 | 10 | — | 50 | OK |
| **Offtake e Compradores** | **60** | 10 | **✓** | **80** | **⚠ ABAIXO DO LIMITE** |
| Licenciamento Ambiental | 75 | 10 | ✓ | 65 | OK |
| Relacionamento Comunitário | 80 | 10 | — | 60 | OK |

ARGOS = (90+75+85+72+85+88+65+60+75+80) / 10 = **77,5**

Isoladamente, 77,5 estaria na faixa de aprovação (`GO`, ≥ 75). Mas *Offtake e Compradores* é crítica com limite 80, e está em 60 — **20 pontos abaixo do necessário, portanto falha dura** (mais de 5 pontos de distância). O gate resultante é `NO-GO`, com a justificativa exata: "o projeto tem excelente geologia e engenharia, mas ninguém assinou para comprar o produto ainda". Essa é precisamente a informação que uma média simples esconderia. Se a nota estivesse, por exemplo, em 77 (3 pontos abaixo do limite 80), o resultado seria `HOLD`, não `NO-GO` — a distância importa.

### 2. As faixas de decisão (gate)

| Faixa (sem variável crítica reprovada) | Decisão | Significado |
|---|---|---|
| ARGOS ≥ 75 | `GO` | Aprovado — segue para a próxima fase de investimento |
| 60 ≤ ARGOS < 75 | `CONDICIONAL` | Aprovável com plano de mitigação — não é "não", é "ainda não" |
| 45 ≤ ARGOS < 60 | `HOLD` | Dado insuficiente para aprovar ou reprovar com segurança — aguardar mais informação |
| ARGOS < 45 | `NO-GO` | Bloqueado — precisa de intervenção antes de prosseguir |

Qualquer variável crítica em **falha dura** força `NO-GO` mesmo que o composto sozinho apontasse `GO`. Qualquer variável crítica em **quase-falha** força pelo menos `HOLD`, mesmo que o composto apontasse `GO` ou `CONDICIONAL`. A trava de criticidade sempre tem prioridade sobre a média — essa hierarquia é o núcleo de governança do produto.

Os limiares 75/60/45 não são arbitrários no sentido de "escolhidos ao acaso" — eles refletem a prática comum de gates de estágio (*stage-gate*) em avaliação de projetos de capital intensivo, com uma faixa adicional de espera (`HOLD`) para não forçar um binário GO/NO-GO em situações que merecem mais coleta de dados antes de qualquer veredito. **Estes limiares são configuráveis** e devem ser calibrados com dados históricos reais antes de uso em produção — ver [ROADMAP.md](ROADMAP.md#calibração-dos-limiares).

## Os 5 cenários de demonstração

A plataforma vem pré-carregada com 5 projetos que ilustram os comportamentos centrais da metodologia:

| Projeto | ARGOS | Gate | O que demonstra |
|---|---|---|---|
| Operação Vale do Lítio | 85,3 | `GO` | Caso limpo — todos os fundamentos fortes, nenhuma crítica reprovada |
| Terras Raras Araxá | 36,0 | `NO-GO` | Caso claramente fraco em múltiplas dimensões simultaneamente |
| **Projeto Cobalto Lafaiete** | **77,5** | **`NO-GO`** | **O caso mais importante**: nota agregada alta, mas bloqueado por 1 variável crítica — prova que o sistema não pode ser "enganado" por médias boas escondendo um problema fatal |
| Manganês Carajás | 87,8 | `GO` | Projeto maduro, fase Feasibility, todos os indicadores fortes |
| Grafite Mina Verde | 66,1 | `CONDICIONAL` | Caso de "quase lá" — mitigável, não descartável |

## O que o ARGOS não é

Para uso responsável da metodologia, é importante ser explícito sobre os limites:

- **Não é uma certificação regulatória.** ARGOS não substitui laudos técnicos, EIA/RIMA, auditorias de recursos (JORC/NI 43-101) ou qualquer processo de certificação formal. Ele é uma camada de triagem e priorização.
- **Não elimina a necessidade de julgamento humano.** O gate é uma recomendação baseada em dados inseridos por pessoas — a qualidade do índice depende inteiramente da qualidade e honestidade dos dados de entrada. Por isso a plataforma sempre encaminha para validação humana especializada (a camada "H2H" via Athena) antes de decisões de capital reais.
- **As notas de 0–100 por variável ainda dependem de metodologia de avaliação própria.** O ARGOS agrega notas; ele não define, sozinho, *como* avaliar "maturidade de engenharia" e transformar isso em um número de 0 a 100 — essa camada de metodologia de scoring por variável é o próximo nível de detalhamento a formalizar (ver Roadmap).
