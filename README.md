# Iris

Duas partes que usam o mesmo cálculo:

- **Painel** (este site): mostra quanto eu receberia se saísse da empresa hoje. Publicado no
  GitHub Pages com senha: https://gabrielitaqui.github.io/iris/
- **Iris** (skill no Claude, em `skill/iris/`): a assistente com quem converso. Ela roda o
  cálculo em Python (`skill/iris/scripts/rescisao.py`) e responde com os números reais.

`npm run teste` garante que o painel (JS) e a skill (Python) dão os mesmos valores.

## Painel

- Os cálculos rodam no navegador com a data do dia: nada precisa ser atualizado.
- Os dados pessoais **não ficam no código**. Eles ficam nos Secrets do GitHub.
- O GitHub Actions testa, monta a página, criptografa com a senha (StatiCrypt, AES-256) e publica.

### Secrets do repositório

| Secret | O que é |
|---|---|
| `IRIS_DADOS` | JSON com os dados fixos (modelo em `dados.exemplo.json`) |
| `IRIS_SENHA` | Senha de acesso à página (mínimo de 12 caracteres; use uma frase longa) |

## Skill da Iris

```bash
python scripts/empacotar_skill.py   # gera iris-skill.zip com o seu dados.json
```

Opcional: crie `contexto.md` na raiz com quem você é e como quer ser tratado. Ele entra no zip,
a Iris lê antes de responder, e também fica fora do git.

No Claude: **Configurações → Capacidades → Skills → Enviar skill** e escolha `iris-skill.zip`.
O zip tem seus dados: não compartilhe e não suba no git (já está no `.gitignore`).

## Campos dos dados

| Campo | Descrição |
|---|---|
| `nome` | Como a Iris te chama |
| `admissao` | Data de admissão (`AAAA-MM-DD`) |
| `salarioFixo` | Salário-base mensal |
| `adicionaisFixos` | Adicionais mensais fixos (periculosidade, insalubridade etc.) |
| `mediaVariaveis` | Média mensal de horas extras e comissões nos últimos 12 meses |
| `dependentesIR` | Dependentes para o Imposto de Renda |
| `fgts.saldo` / `fgts.dataReferencia` | Saldo do último extrato do FGTS e a data dele. O saldo é projetado a partir daí |
| `ferias.periodosGozados` | Quantos períodos aquisitivos de férias você já tirou |
| `seguroDesemprego.solicitacoesAnteriores` | Quantas vezes já pediu seguro-desemprego |

**Quando os dados mudarem** (férias, aumento, extrato novo do FGTS), edite `dados.json` e atualize os dois lados:

```powershell
Get-Content dados.json -Raw | gh secret set IRIS_DADOS -R GabrielItaqui/iris; gh workflow run deploy.yml -R GabrielItaqui/iris
python scripts/empacotar_skill.py   # e envie o novo zip no Claude
```

## Desenvolvimento

```bash
npm install
npm run teste      # cálculo + comparação painel x skill
npm run build      # gera dist/index.html sem criptografia (não publique)
```

Novo módulo no painel: copie `src/modulos/rescisao/`, adapte e registre em `src/modulos/index.js`.
Para a Iris saber dele, acrescente um script em `skill/iris/scripts/` e uma seção no `SKILL.md`.

## Tabelas legais

INSS, IRRF (com o redutor da Lei 15.270/2025) e seguro-desemprego de 2026 estão em
`src/modulos/rescisao/tabelas.js` **e** no topo de `skill/iris/scripts/rescisao.py`.
Atualize os dois todo janeiro; o teste avisa se ficarem diferentes.

Os valores são estimativas e não substituem o cálculo oficial da empresa ou do sindicato.
