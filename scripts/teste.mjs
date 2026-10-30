// Testes: node scripts/teste.mjs
// 1. cálculo do painel (JS) em casos conhecidos
// 2. o script da skill (Python) dá exatamente os mesmos números que o painel
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calcularINSS, calcularIRRF, calcularCenario, calcularRescisao, data, iso } from "../src/modulos/rescisao/calculo.js";

const exemplo = {
  nome: "Fulano",
  admissao: "2021-03-15",
  salarioFixo: 6000,
  adicionaisFixos: 0,
  mediaVariaveis: 800,
  dependentesIR: 0,
  fgts: { saldo: 25000, dataReferencia: "2026-10-01" },
  ferias: { periodosGozados: 4 },
  seguroDesemprego: { solicitacoesAnteriores: 0 },
};

// ---------- cálculo ----------

// INSS: teto de desconto 2026 é R$ 988,09
assert.equal(calcularINSS(10000), 988.09);
assert.equal(calcularINSS(1621), 121.58);

// IRRF: isento até R$ 5.000 com o redutor
assert.equal(calcularIRRF(5000, calcularINSS(5000), 0), 0);
assert.ok(calcularIRRF(8000, calcularINSS(8000), 0) > 0);

const hoje = data("2026-10-30");
const sjc = calcularCenario(exemplo, hoje, "sem_justa_causa");
// 5 anos completos: 30 + 15 = 45 dias de aviso
assert.match(sjc.verbas.find((v) => v.nome.startsWith("Aviso")).nome, /45 dias/);
assert.equal(sjc.dataProjetada, "2026-12-14");
// 13º: jan..dez (dezembro com 14 dias não conta) = 11/12
assert.match(sjc.verbas.find((v) => v.nome.startsWith("13º")).nome, /11\/12/);
// Férias proporcionais: 15/03 a 14/12 = 9 meses
assert.match(sjc.verbas.find((v) => v.nome.startsWith("Férias proporcionais")).nome, /9\/12/);
// 5 períodos completos, 4 gozados = 1 vencido (simples, concessivo até 03/2027)
assert.equal(sjc.verbas.filter((v) => v.nome.startsWith("Férias vencidas")).length, 1);
assert.equal(sjc.seguroDesemprego.parcelas, 5);
assert.equal(sjc.seguroDesemprego.valorParcela, 2518.65);
assert.equal(sjc.totalEmMaos, 74122.28);

const pedido = calcularCenario(exemplo, hoje, "pedido_demissao");
assert.equal(pedido.fgts.disponivelSaque, 0);
assert.equal(pedido.seguroDesemprego.parcelas, 0);

// Depois de 30/11 desconta a 1ª parcela do 13º
const dez = calcularCenario(exemplo, data("2026-12-05"), "sem_justa_causa");
assert.ok(dez.descontos.some((d) => d.nome.startsWith("Adiantamento")));

console.log("OK: cálculo do painel");

// ---------- painel (JS) x skill (Python) ----------

const perfis = [
  exemplo,
  // salário baixo, dependentes, férias em dobro, FGTS antigo, segunda solicitação de seguro
  {
    admissao: "2019-02-28", salarioFixo: 2100, adicionaisFixos: 300, mediaVariaveis: 0, dependentesIR: 2,
    fgts: { saldo: 9000, dataReferencia: "2025-06-10" }, ferias: { periodosGozados: 4 },
    seguroDesemprego: { solicitacoesAnteriores: 1 },
  },
  // recém-contratado, salário alto
  {
    admissao: "2026-01-31", salarioFixo: 15000, fgts: { saldo: 0, dataReferencia: "2026-01-31" },
  },
];

const datas = ["2026-11-29", "2026-11-30", "2026-12-19", "2026-12-20", "2027-02-28", "2027-03-15", "2028-02-29"];
for (let d = data("2026-10-30"); d < data("2028-12-31"); d = new Date(d.getTime() + 37 * 86400000)) datas.push(iso(d));

const python = process.platform === "win32" ? "python" : "python3";
const pasta = mkdtempSync(join(tmpdir(), "iris-"));
const script = join("skill", "iris", "scripts", "rescisao.py");

function iguais(a, b, caminho) {
  if (typeof a === "number" && typeof b === "number") {
    assert.ok(Math.abs(a - b) < 0.011, `${caminho}: painel ${a} x skill ${b}`);
  } else if (a && typeof a === "object") {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), `${caminho}: campos diferentes`);
    for (const k of Object.keys(a)) iguais(a[k], b[k], `${caminho}.${k}`);
  } else {
    assert.equal(a, b, caminho);
  }
}

let comparacoes = 0;
perfis.forEach((perfil, i) => {
  const arquivo = join(pasta, `perfil${i}.json`);
  writeFileSync(arquivo, JSON.stringify(perfil));
  for (const d of datas) {
    if (data(d) < data(perfil.admissao)) continue;
    const js = calcularRescisao(perfil, data(d));
    const py = JSON.parse(execFileSync(python, [script, "--dados", arquivo, "--data", d], { encoding: "utf8" }));
    iguais(js, py, `perfil ${i} em ${d}`);
    comparacoes++;
  }
});

console.log(`OK: painel e skill iguais em ${comparacoes} comparações`);
