// Testes do cálculo de rescisão: node scripts/teste.mjs
import assert from "node:assert/strict";
import { calcularINSS, calcularIRRF, calcularCenario, calcularRescisao, data } from "../src/modulos/rescisao/calculo.js";

const exemplo = {
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

console.log(JSON.stringify(calcularRescisao(exemplo, hoje), null, 2));
console.log("\nOK: todos os testes passaram");
