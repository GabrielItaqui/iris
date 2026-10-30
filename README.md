# Iris

Assistente pessoal com um menu de módulos e um chat que consulta esses módulos.
Primeiro módulo: **Rescisão**, que mostra quanto eu receberia se saísse da empresa hoje.

- Os cálculos rodam no navegador com a data do dia: nada precisa ser atualizado.
- O chat não usa IA nem API paga: ele entende as perguntas por palavras-chave e datas
  (`src/iris/linguagem.js`) e cada módulo monta a resposta com o próprio cálculo.
- Os dados pessoais **não ficam no código**. Eles ficam nos Secrets do GitHub.
- O GitHub Actions monta a página, criptografa com a senha (StatiCrypt, AES-256) e publica no GitHub Pages.

## Secrets do repositório

| Secret | O que é |
|---|---|
| `IRIS_DADOS` | JSON com os dados fixos (modelo em `dados.exemplo.json`) |
| `IRIS_SENHA` | Senha de acesso à página (mínimo de 12 caracteres; use uma frase longa) |

### Campos de `IRIS_DADOS`

| Campo | Descrição |
|---|---|
| `nome` | Como a Iris te chama |
| `admissao` | Data de admissão (`AAAA-MM-DD`) |
| `salarioFixo` | Salário-base mensal |
| `adicionaisFixos` | Adicionais mensais fixos (periculosidade, insalubridade etc.) |
| `mediaVariaveis` | Média mensal de horas extras e comissões nos últimos 12 meses |
| `dependentesIR` | Dependentes para o Imposto de Renda |
| `fgts.saldo` / `fgts.dataReferencia` | Saldo do último extrato do FGTS e a data dele. A Iris projeta o saldo a partir daí |
| `ferias.periodosGozados` | Quantos períodos aquisitivos de férias você já tirou |
| `seguroDesemprego.solicitacoesAnteriores` | Quantas vezes já pediu seguro-desemprego |

**Quando atualizar:** ao tirar férias (`periodosGozados`), ao mudar de salário ou, de vez em quando, com um extrato novo do FGTS. Para atualizar, edite o secret e rode o workflow de novo (aba Actions → Publicar Iris → Run workflow).

## Rodar localmente

```bash
npm install
cp dados.exemplo.json dados.json   # edite com seus dados; dados.json fica fora do git
npm run teste
npm run build                      # gera dist/index.html (sem criptografia, não publique)
```

## Criar um novo módulo

1. Copie `src/modulos/rescisao/` para uma pasta nova.
2. Exporte `{ id, nome, icone, renderizar, responder, exemplos }`.
   `responder(texto, dados, contexto)` recebe a pergunta já normalizada (minúsculas, sem acentos)
   e devolve o texto da resposta, ou `null` se a pergunta não for com esse módulo.
3. Adicione o módulo em `src/modulos/index.js`.

Ele aparece no menu e a Iris passa a responder sobre ele no chat.

## Tabelas legais

`src/modulos/rescisao/tabelas.js` tem INSS, IRRF (com o redutor da Lei 15.270/2025) e seguro-desemprego de 2026. Atualize esses valores todo mês de janeiro.

Os valores são estimativas e não substituem o cálculo oficial da empresa ou do sindicato.
