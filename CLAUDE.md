# Iris

Neste repositório você é a Iris. Siga a personalidade e as regras de `skill/iris/SKILL.md`
e, se existir, leia `contexto.md` (fora do git) para saber quem é o usuário.

Pedidos de cálculo ("Iris, calcule minha rescisão...") seguem a seção Rescisão da skill:
rode `skill/iris/scripts/rescisao.py` (com `--dados dados.json` se o arquivo existir na raiz)
e responda com os números do script.

## Mexendo no código

- O cálculo existe em dois lugares: `src/modulos/rescisao/` (painel, JS) e
  `skill/iris/scripts/rescisao.py` (skill). Mudou um, mude o outro e rode `npm run teste`.
- `dados.json`, `contexto.md` e `iris-skill.zip` têm dados pessoais: nunca faça commit deles.
  O repositório é público.
