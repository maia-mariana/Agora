# IA.md — relatório da IA sobre o próprio desenvolvimento

Este documento existe pelo mesmo motivo do `IA.md` de qualquer outro projeto construído com apoio de IA: quem herda este código merece saber não só o que foi decidido, mas **como** foi decidido — inclusive os erros no meio do caminho. Escrito em primeira pessoa, pela IA (Claude) que desenvolveu a aplicação ao longo da conversa com o Time Rosa.

## Como o projeto realmente aconteceu

O ÁGORA não nasceu do escopo atual. Começou como um protótipo de dashboard de risco para minerais críticos, cresceu por dezenas de rodadas de iteração dentro da mesma conversa — cada rodada adicionando ou corrigindo uma parte, quase sempre a partir de print de tela ou de um "não ficou do jeito que eu queria". Isso tem uma consequência direta na leitura do código: nem toda decisão de arquitetura foi tomada de uma vez, no início, com visão de conjunto. Várias foram respostas pontuais a um problema que apareceu na hora — o que é normal em desenvolvimento real orientado a produto, mas significa que quem for estender este código deve ler as seções abaixo antes de assumir que uma escolha tem uma razão mais profunda do que "resolveu o problema daquele momento".

## O que deu errado, e o que ficou aprendido com isso

### A saga dos gráficos que não apareciam

Esta foi a dor mais recorrente do desenvolvimento, e vale contar por completo porque o resultado final (por que alguns gráficos usam Chart.js e outros SVG puro) só faz sentido com o histórico:

1. **Primeira tentativa**: Chart.js carregado via CDN (`cdnjs.cloudflare.com`). Funcionou nos primeiros testes, mas o usuário reportou repetidamente que os gráficos apareciam em branco em determinados momentos de visualização.
2. **Diagnóstico errado, corrigido depois**: a primeira hipótese foi que o CDN específico (`4.4.4`) não existia ou estava indisponível. Busquei e confirmei que a versão existia — hipótese descartada.
3. **Segunda hipótese, também descartada por evidência**: um ambiente de preview sandboxed poderia estar bloqueando requisições de rede externas ao renderizar o HTML. Para eliminar essa classe de problema de vez, o Chart.js e depois o Three.js foram **embutidos inteiros no arquivo** (via `<script>` inline com o conteúdo do bundle minificado), removendo qualquer dependência de rede em tempo de execução.
4. **O bug real**, encontrado só depois de embutir a biblioteca: uma regra CSS que eu mesmo havia adicionado, `canvas{width:100% !important; height:100% !important;}`, estava brigando com o próprio Chart.js — a biblioteca define o tamanho do canvas via JavaScript a cada render, e o `!important` no CSS vencia essa definição, produzindo uma área de desenho inconsistente. A correção foi remover o `!important` e seguir o padrão oficial da biblioteca (container com altura fixa via CSS, canvas sem override de tamanho).
5. **Decisão final, depois de tudo isso**: mesmo com a causa raiz corrigida, os três gráficos mais centrais para a demonstração (gauge do ARGOS, nuvem de risco×retorno, distribuição de Monte Carlo) foram **reescritos do zero em SVG puro**, abandonando Chart.js só para esses três. A razão foi de risco, não de elegância: depois de já ter caçado dois bugs de renderização nessa mesma pilha, um SVG gerado por string e injetado por `innerHTML` é sincrono e não depende de nenhum ciclo de vida de biblioteca — elimina a categoria inteira de bug, não só o exemplar que apareceu. Onde esse histórico de problema não existia (radar, comparador em barras, dispersão do portfólio), Chart.js foi mantido, porque reescrever o que já funciona não reduz risco, só gasta tempo.

**O que eu faria diferente**: eu deveria ter suspeitado do CSS antes de reescrever bibliotecas inteiras — o padrão "biblioteca de gráfico não renderiza, mas não lança erro" quase sempre aponta para CSS brigando com JS de dimensionamento, e eu cheguei nessa hipótese só depois de já ter descartado duas outras mais trabalhosas de testar.

### O incidente de perda de arquivo entre turnos

Numa das rodadas, o widget do assistente 3D (Three.js embutido, HTML do botão flutuante, todo o JavaScript da cena 3D) simplesmente não estava mais presente no arquivo no início da conversa seguinte — substituído por uma linha órfã (`<script src="script.js">`) que eu nunca havia escrito. Não tenho visibilidade total do mecanismo exato por trás disso (possivelmente uma falha de persistência entre as duas respostas), mas o processo de recuperação foi:

1. Diagnóstico antes de qualquer correção às cegas — medir o tamanho real do arquivo (havia caído de ~1,3MB para ~360KB), listar a estrutura de `<script>`/`</script>` para ver exatamente o que sobrava.
2. Reconstrução do trecho perdido a partir do que eu já tinha escrito (o Three.js precisou ser regerado via `npm install three`, porque o arquivo temporário original também não existia mais no ambiente de trabalho).
3. Validação de sintaxe de cada bloco `<script>` isoladamente (`node --check`) antes de considerar o arquivo utilizável de novo.

**Lição prática, registrada para quem mantiver este projeto**: depois desse incidente, toda entrega passou a incluir uma bateria de verificação de sintaxe por bloco de script e, quando possível, um teste funcional real (DOM headless ou navegador via Playwright) antes de apresentar o arquivo como pronto — não só "parece certo visualmente".

### A confusão de nomenclatura ÁGORA vs. ARGOS

Em uma fase do desenvolvimento, o nome do índice (ARGOS) e o nome da plataforma (ÁGORA) ficaram misturados na interface — a tela inicial e o botão de entrada diziam "ARGOS" como se fosse a marca do produto. O usuário precisou apontar isso explicitamente antes de ser corrigido. A causa foi simples: eu estava tratando os dois nomes como intercambiáveis internamente sem uma regra explícita de "onde cada um aparece". A correção final foi mecânica (busca e substituição cuidadosa, preservando os usos corretos de "ARGOS" como nome do índice dentro de textos como "Score Composto (ARGOS)"), mas o processo expôs que eu deveria ter fixado essa distinção de vocabulário no começo, não corrigido reativamente depois de já espalhada pela interface.

### O modelo de gate evoluiu sem que a documentação acompanhasse

O motor de decisão (`gateFor()`) passou de 3 estados (GO/CONDICIONAL/NO-GO com um único limiar de criticidade) para 4 estados (incluindo `HOLD`, com a distinção entre falha dura e quase-falha de variável crítica) numa iteração posterior do código — mas a documentação técnica escrita anteriormente continuou descrevendo a versão de 3 estados por várias rodadas, até uma revisão específica pedida pelo usuário expor a divergência entre o que o código fazia e o que os documentos diziam. Foi corrigido por completo (ver `docs/ARGOS-METHODOLOGY.md` e `docs/SPECIFICATION.md`), mas é um lembrete de que **documentação escrita a partir de uma versão do código pode ficar desatualizada silenciosamente** se o código continuar mudando depois — não há verificação automática que acuse essa divergência, só revisão manual.

## Como a validação foi feita, e onde ela para

Não existe suíte de testes automatizados versionada neste repositório (ver `docs/ROADMAP.md`). O que existiu, ao longo de todo o desenvolvimento, foi validação manual repetida a cada mudança relevante, com três camadas de ferramenta:

1. **`node --check`** sobre cada bloco de script extraído do HTML, para garantir que nenhuma edição quebrou a sintaxe antes mesmo de tentar rodar qualquer coisa.
2. **DOM headless via `jsdom`**, rodando a lógica de negócio de verdade (`gateFor`, `composite`, `runMonteCarlo` etc.) e conferindo os 5 cenários de demonstração contra os valores esperados a cada mudança — este foi o teste mais repetido de toda a conversa, provavelmente rodado mais de 30 vezes ao longo do desenvolvimento.
3. **Navegador real via Playwright**, usado nas fases finais para validar coisas que `jsdom` não consegue — principalmente se Chart.js e Three.js carregam de verdade via `<script src>` num navegador de verdade, servido por HTTP, e se a cena 3D renderiza sem lançar erro de console.

**A lacuna reconhecida**: essa validação sempre foi *exploratória e manual* — eu decidindo o que testar a cada rodada, sem uma suíte que rode sozinha e acuse regressão automaticamente. Isso significa que qualquer característica que eu não pensei em testar explicitamente pode ter regressões não detectadas. É o item de maior prioridade na lista de melhoria do projeto, tanto no `docs/ROADMAP.md` quanto aqui.

## O que eu faria com mais tempo (do ponto de vista de quem construiu)

- **Uma suíte de testes real**, não só validação manual repetida — principalmente sobre `gateFor()`, que é a lógica mais crítica de negócio e a que mais mudou de forma sem que eu tivesse uma rede de segurança automática.
- **Fixar cedo, por escrito, a distinção de nomenclatura** (produto vs. índice, e qualquer outra dupla de nomes do domínio) antes de escrever a primeira tela, não depois de já ter espalhado o erro pela interface.
- **Verificar a cada entrega se a documentação técnica ainda bate com o código**, não só se o código funciona — a divergência do modelo de gate (3 vs. 4 estados) ficou sem ser notada por mais tempo do que deveria.
- **Preferir a explicação mais simples primeiro** na hora de depurar um problema de renderização — a saga do Chart.js poderia ter sido mais curta se a hipótese de conflito de CSS tivesse sido testada antes das hipóteses de rede/CDN, que eram mais trabalhosas de descartar e acabaram não sendo a causa.
- **Persistir o estado de arquivos grandes de forma mais defensiva** entre respostas — o incidente de perda do widget 3D não teria acontecido, ou teria sido detectado mais cedo, com uma checagem de integridade (tamanho de arquivo, contagem de blocos-chave) no início de cada nova rodada de edição, antes de assumir que o arquivo da resposta anterior chegou intacto.
