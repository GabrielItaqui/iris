# Iris

Assistente pessoal com um menu de módulos e um chat (Claude) que consulta esses módulos.
Primeiro módulo: **Rescisão**, que mostra quanto eu receberia se saísse da empresa hoje.

- Os cálculos rodam no navegador com a data do dia: nada precisa ser atualizado.
- Os dados pessoais **não ficam no código**. Eles ficam nos Secrets do GitHub.
- O GitHub Actions monta a página, criptografa com a senha (StatiCrypt, AES-256) e publica no GitHub Pages.

## Secrets do repositório

| Secret | O que é |
|---|---|
| `IRIS_DADOS` | JSON com os dados fixos (modelo em `dados.exemplo.json`) |
| `IRIS_SENHA` | Senha de acesso à página (mínimo de 12 caracteres; use uma frase longa) |
| `ANTHROPIC_API_KEY` | Chave da API do Claude para o chat. Crie uma chave só para a Iris e defina um limite de gasto no console da Anthropic |

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
2. Exporte `{ id, nome, icone, renderizar, ferramentas, executar }`.
3. Adicione o módulo em `src/modulos/index.js`.

Ele aparece no menu e a Iris passa a poder consultá-lo no chat.

## Tabelas legais

`src/modulos/rescisao/tabelas.js` tem INSS, IRRF (com o redutor da Lei 15.270/2025) e seguro-desemprego de 2026. Atualize esses valores todo mês de janeiro.

Os valores são estimativas e não substituem o cálculo oficial da empresa ou do sindicato.
