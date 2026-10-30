// Cálculo de rescisão CLT. Funções puras: recebem os dados fixos e uma data,
// devolvem um objeto com todas as verbas. Nada aqui depende do navegador.

import { INSS, IRRF, SEGURO_DESEMPREGO, FGTS } from "./tabelas.js";

// ---------- datas (sempre em UTC, sem hora) ----------

const DIA = 86400000;

export function data(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function hojeLocal(agora = new Date()) {
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

export function iso(d) {
  return d.toISOString().slice(0, 10);
}

function br(d) {
  return iso(d).split("-").reverse().join("/");
}

function somarDias(d, n) {
  return new Date(d.getTime() + n * DIA);
}

// Soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02).
function somarMeses(d, n) {
  const a = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(d.getUTCDate(), ultimo)));
}

function diasEntre(inicio, fim) {
  return Math.round((fim - inicio) / DIA);
}

function anosCompletos(inicio, fim) {
  let anos = fim.getUTCFullYear() - inicio.getUTCFullYear();
  if (somarMeses(inicio, anos * 12) > fim) anos--;
  return Math.max(0, anos);
}

function mesesCompletos(inicio, fim) {
  let meses =
    (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 +
    fim.getUTCMonth() - inicio.getUTCMonth();
  if (somarMeses(inicio, meses) > fim) meses--;
  return Math.max(0, meses);
}

// toFixed(10) remove o ruído de ponto flutuante (121,575 vira 121,58, não 121,57)
const arred = (v) => Math.round(Number(v.toFixed(10)) * 100) / 100;

// ---------- impostos ----------

export function calcularINSS(base) {
  let desconto = 0;
  let anterior = 0;
  for (const { ate, aliquota } of INSS.faixas) {
    if (base <= anterior) break;
    desconto += (Math.min(base, ate) - anterior) * aliquota;
    anterior = ate;
  }
  return arred(desconto);
}

export function calcularIRRF(bruto, inss, dependentes) {
  const deducoesLegais = inss + dependentes * IRRF.deducaoDependente;
  const deducao = Math.max(deducoesLegais, IRRF.descontoSimplificado);
  const base = Math.max(0, bruto - deducao);
  const faixa = IRRF.faixas.find((f) => base <= f.ate);
  const imposto = Math.max(0, base * faixa.aliquota - faixa.deducao);

  const r = IRRF.redutor;
  let reducao = 0;
  if (bruto <= r.isencaoAte) reducao = r.reducaoMaximaIsencao;
  else if (bruto <= r.transicaoAte) reducao = Math.max(0, r.constante - r.fator * bruto);

  return arred(Math.max(0, imposto - reducao));
}

// ---------- verbas ----------

// Avos de 13º: cada mês do ano com 15 dias ou mais trabalhados conta 1/12.
function avos13(admissao, fim, ano) {
  let avos = 0;
  for (let m = 0; m < 12; m++) {
    const ini = new Date(Math.max(admissao, Date.UTC(ano, m, 1)));
    const fimMes = new Date(Math.min(fim, Date.UTC(ano, m + 1, 0)));
    if (fimMes >= ini && diasEntre(ini, fimMes) + 1 >= 15) avos++;
  }
  return avos;
}

function decimoTerceiro(dados, hoje, fim, remuneracao) {
  const admissao = data(dados.admissao);
  const ano = hoje.getUTCFullYear();
  const pagoNoAno = hoje >= new Date(Date.UTC(ano, 11, 20)); // 2ª parcela até 20/12
  const adiantou = hoje >= new Date(Date.UTC(ano, 10, 30)); // 1ª parcela até 30/11

  let avos = 0;
  let adiantamento = 0;
  if (!pagoNoAno) {
    avos += avos13(admissao, fim, ano);
    if (adiantou) {
      adiantamento = (remuneracao * avos13(admissao, new Date(Date.UTC(ano, 10, 30)), ano)) / 12 / 2;
    }
  }
  if (fim.getUTCFullYear() > ano) avos += avos13(admissao, fim, fim.getUTCFullYear());

  return { avos, bruto: arred((remuneracao * avos) / 12), adiantamento: arred(adiantamento) };
}

function ferias(dados, hoje, fim, remuneracao) {
  const admissao = data(dados.admissao);
  const periodos = anosCompletos(admissao, fim);
  const gozados = dados.ferias?.periodosGozados ?? 0;

  const vencidas = [];
  for (let i = gozados + 1; i <= periodos; i++) {
    const fimAquisitivo = somarDias(somarMeses(admissao, i * 12), -1);
    const fimConcessivo = somarMeses(fimAquisitivo, 12);
    const emDobro = hoje > fimConcessivo;
    const valor = remuneracao * (emDobro ? 2 : 1);
    vencidas.push({
      periodo: `${br(somarMeses(admissao, (i - 1) * 12))} a ${br(fimAquisitivo)}`,
      emDobro,
      valor: arred(valor),
      terco: arred(valor / 3),
    });
  }

  const inicioAtual = somarMeses(admissao, periodos * 12);
  let avos = mesesCompletos(inicioAtual, fim);
  const sobra = diasEntre(somarMeses(inicioAtual, avos), fim) + 1;
  if (sobra >= 15) avos++;
  avos = Math.min(avos, 12);
  const proporcional = (remuneracao * avos) / 12;

  return {
    vencidas,
    proporcionais: { avos, valor: arred(proporcional), terco: arred(proporcional / 3) },
  };
}

// Saldo do FGTS projetado até hoje a partir de um extrato de referência.
function saldoFGTS(dados, hoje, remuneracao) {
  const ref = data(dados.fgts.dataReferencia);
  const meses = mesesCompletos(ref, hoje);
  const taxa = Math.pow(1 + FGTS.rendimentoAnual, 1 / 12) - 1;
  let saldo = dados.fgts.saldo;
  for (let i = 1; i <= meses; i++) {
    saldo = saldo * (1 + taxa) + remuneracao * FGTS.aliquotaDeposito;
    if (somarMeses(ref, i).getUTCMonth() === 11) saldo += remuneracao * FGTS.aliquotaDeposito; // 13º
  }
  return arred(saldo);
}

function seguroDesemprego(dados, hoje, remuneracao) {
  const s = SEGURO_DESEMPREGO;
  let parcela;
  if (remuneracao <= s.faixa1Ate) parcela = remuneracao * 0.8;
  else if (remuneracao <= s.faixa2Ate) parcela = s.faixa2Base + (remuneracao - s.faixa1Ate) * 0.5;
  else parcela = s.teto;
  parcela = Math.min(s.teto, Math.max(s.piso, parcela));

  const meses = Math.min(36, mesesCompletos(data(dados.admissao), hoje));
  const anteriores = dados.seguroDesemprego?.solicitacoesAnteriores ?? 0;
  const minimo = anteriores === 0 ? 12 : anteriores === 1 ? 9 : 6;
  let parcelas = 0;
  if (meses >= 24) parcelas = 5;
  else if (meses >= 12) parcelas = 4;
  else if (meses >= minimo) parcelas = 3;

  return { parcelas, valorParcela: arred(parcela), total: arred(parcela * parcelas) };
}

// ---------- cenários ----------

export const CENARIOS = {
  sem_justa_causa: {
    nome: "Demissão sem justa causa",
    fracaoAviso: 1,
    multaFGTS: 0.4,
    saqueFGTS: 1,
    seguro: true,
  },
  acordo: {
    nome: "Acordo (art. 484-A)",
    fracaoAviso: 0.5,
    multaFGTS: 0.2,
    saqueFGTS: 0.8,
    seguro: false,
  },
  pedido_demissao: {
    nome: "Pedido de demissão",
    fracaoAviso: 0,
    multaFGTS: 0,
    saqueFGTS: 0,
    seguro: false,
  },
};

export function remuneracaoMensal(dados) {
  return dados.salarioFixo + (dados.adicionaisFixos ?? 0) + (dados.mediaVariaveis ?? 0);
}

export function calcularCenario(dados, hoje, chave) {
  const c = CENARIOS[chave];
  const remuneracao = remuneracaoMensal(dados);
  const admissao = data(dados.admissao);
  const anos = anosCompletos(admissao, hoje);

  const diasAvisoDireito = Math.min(90, 30 + 3 * anos);
  const diasAviso = Math.round(diasAvisoDireito * c.fracaoAviso);
  const fim = somarDias(hoje, diasAviso); // data projetada pelo aviso indenizado

  const diasMes = Math.min(30, hoje.getUTCDate());
  const saldoSalario = arred((remuneracao / 30) * diasMes);
  const aviso = arred((remuneracao / 30) * diasAviso);
  const d13 = decimoTerceiro(dados, hoje, fim, remuneracao);
  const fer = ferias(dados, hoje, fim, remuneracao);

  const dependentes = dados.dependentesIR ?? 0;
  const inssSaldo = calcularINSS(saldoSalario);
  const irrfSaldo = calcularIRRF(saldoSalario, inssSaldo, dependentes);
  const inss13 = calcularINSS(d13.bruto);
  const irrf13 = calcularIRRF(d13.bruto, inss13, dependentes);

  const verbas = [
    { nome: `Saldo de salário (${diasMes} ${diasMes === 1 ? "dia" : "dias"})`, valor: saldoSalario },
    ...(aviso ? [{ nome: `Aviso prévio indenizado (${diasAviso} dias)`, valor: aviso }] : []),
    { nome: `13º proporcional (${d13.avos}/12)`, valor: d13.bruto },
    ...fer.vencidas.flatMap((v) => [
      { nome: `Férias vencidas${v.emDobro ? " em dobro" : ""} (${v.periodo})`, valor: v.valor },
      { nome: "1/3 sobre férias vencidas", valor: v.terco },
    ]),
    { nome: `Férias proporcionais (${fer.proporcionais.avos}/12)`, valor: fer.proporcionais.valor },
    { nome: "1/3 sobre férias proporcionais", valor: fer.proporcionais.terco },
  ].filter((v) => v.valor > 0);

  const descontos = [
    { nome: "INSS sobre saldo de salário", valor: inssSaldo },
    { nome: "IRRF sobre saldo de salário", valor: irrfSaldo },
    { nome: "INSS sobre 13º", valor: inss13 },
    { nome: "IRRF sobre 13º", valor: irrf13 },
    { nome: "Adiantamento do 13º já recebido", valor: d13.adiantamento },
  ].filter((v) => v.valor > 0);

  const bruto = arred(verbas.reduce((s, v) => s + v.valor, 0));
  const totalDescontos = arred(descontos.reduce((s, v) => s + v.valor, 0));
  const liquido = arred(bruto - totalDescontos);

  const saldoAtual = saldoFGTS(dados, hoje, remuneracao);
  const depositoRescisao = arred((saldoSalario + aviso + d13.bruto) * FGTS.aliquotaDeposito);
  const baseMulta = saldoAtual + depositoRescisao;
  const multa = arred(baseMulta * c.multaFGTS);
  const saque = arred(baseMulta * c.saqueFGTS + multa);

  const seguro = c.seguro
    ? seguroDesemprego(dados, hoje, remuneracao)
    : { parcelas: 0, valorParcela: 0, total: 0 };

  return {
    cenario: chave,
    nome: c.nome,
    dataProjetada: iso(fim),
    verbas,
    descontos,
    bruto,
    totalDescontos,
    liquido,
    fgts: {
      saldoEstimado: saldoAtual,
      depositoRescisao,
      multa,
      disponivelSaque: saque,
      retido: arred(baseMulta - baseMulta * c.saqueFGTS),
    },
    seguroDesemprego: seguro,
    totalEmMaos: arred(liquido + saque),
  };
}

export function calcularRescisao(dados, hoje = hojeLocal()) {
  const admissao = data(dados.admissao);
  return {
    dataCalculo: iso(hoje),
    admissao: dados.admissao,
    tempoDeCasa: {
      anos: anosCompletos(admissao, hoje),
      meses: mesesCompletos(admissao, hoje) % 12,
    },
    remuneracaoMensal: remuneracaoMensal(dados),
    cenarios: Object.keys(CENARIOS).map((k) => calcularCenario(dados, hoje, k)),
  };
}
