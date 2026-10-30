// Testes do cálculo de rescisão: node scripts/teste.mjs
import assert from "node:assert/strict";
import { calcularINSS, calcularIRRF, calcularCenario, data } from "../src/modulos/rescisao/calculo.js";
import { responder } from "../src/modulos/rescisao/respostas.js";
import { lerData, normalizar } from "../src/iris/linguagem.js";
import { criarChat } from "../src/iris/chat.js";

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

const pedido = calcularCenario(exemplo, hoje, "pedido_demissao");
assert.equal(pedido.fgts.disponivelSaque, 0);
assert.equal(pedido.seguroDesemprego.parcelas, 0);

// Depois de 30/11 desconta a 1ª parcela do 13º
const dez = calcularCenario(exemplo, data("2026-12-05"), "sem_justa_causa");
assert.ok(dez.descontos.some((d) => d.nome.startsWith("Adiantamento")));

// ---------- leitura de datas ----------
const ler = (t) => {
  const d = lerData(normalizar(t), hoje);
  return d && d.toISOString().slice(0, 10);
};
assert.equal(ler("e em 1º de março?"), "2027-03-01");
assert.equal(ler("no dia 15/12"), "2026-12-15");
assert.equal(ler("em 01/03/2027"), "2027-03-01");
assert.equal(ler("daqui a 3 meses"), "2027-01-30");
assert.equal(ler("em dez dias"), "2026-11-09");
assert.equal(ler("em dezembro"), "2026-12-01");
assert.equal(ler("em março de 2028"), "2028-03-01");
assert.equal(ler("ano que vem"), "2027-10-30");
assert.equal(ler("quanto recebo hoje?"), null);

// ---------- chat ----------
const ctx = {};
const perguntar = (t) => responder(normalizar(t), exemplo, ctx, hoje);
assert.match(perguntar("Quanto eu recebo se for demitido hoje?"), /demitido sem justa causa hoje.*R\$\s?74\.122,28/s);
assert.match(perguntar("E se eu pedir demissão?"), /pedir demissão hoje/);
assert.match(perguntar("e em março?"), /pedir demissão em 01\/03\/2027/);
assert.match(perguntar("Quanto de FGTS no acordo?"), /acordo.*80%/s);
assert.match(perguntar("tenho direito a seguro desemprego se pedir demissão?"), /não teria direito/);
assert.match(perguntar("quanto eu ganho saindo hoje?"), /Comparando/);
assert.equal(perguntar("qual a previsão do tempo?"), null);
const chat = criarChat(exemplo);
assert.match(chat("oi"), /Oi, Fulano/);
assert.match(chat("qual a capital da França?"), /Ainda não sei/);

console.log(perguntar("detalhes da demissão sem justa causa"));
console.log("\nOK: todos os testes passaram");
