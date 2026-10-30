// Gera dist/index.html: um único arquivo com CSS, JS e os dados embutidos.
//
// Dados (primeiro que existir):
//   1. variável de ambiente IRIS_DADOS (JSON) — usada pelo GitHub Actions
//   2. dados.json na raiz (local, fora do git)
//   3. dados.exemplo.json
// Chave da API: variável de ambiente ANTHROPIC_API_KEY (opcional; sem ela o chat fica desligado).
//
// ATENÇÃO: dist/index.html sai SEM criptografia. Só publique a pasta site/,
// gerada depois por `npm run criptografar`.

import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

function lerDados() {
  if (process.env.IRIS_DADOS) return { dados: JSON.parse(process.env.IRIS_DADOS), origem: "IRIS_DADOS" };
  for (const arquivo of ["dados.json", "dados.exemplo.json"]) {
    if (existsSync(arquivo)) return { dados: JSON.parse(readFileSync(arquivo, "utf8")), origem: arquivo };
  }
  throw new Error("Nenhum dado encontrado. Crie dados.json a partir de dados.exemplo.json.");
}

const { dados, origem } = lerDados();
for (const campo of ["admissao", "salarioFixo", "fgts"]) {
  if (dados[campo] == null) throw new Error(`Campo obrigatório ausente nos dados: ${campo}`);
}

const resultado = await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  write: false,
  define: {
    __IRIS_DADOS__: JSON.stringify(dados),
    __IRIS_API_KEY__: JSON.stringify(process.env.ANTHROPIC_API_KEY ?? ""),
  },
});

const js = resultado.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync("src/estilo.css", "utf8");
const html = readFileSync("src/index.html", "utf8")
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => js);

mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
console.log(`dist/index.html gerado (dados: ${origem}, chat: ${process.env.ANTHROPIC_API_KEY ? "ligado" : "desligado"})`);
