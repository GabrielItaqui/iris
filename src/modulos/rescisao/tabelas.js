// Tabelas legais vigentes. Atualize uma vez por ano (normalmente em janeiro).

// INSS 2026 — Portaria Interministerial MPS/MF nº 13/2026 (progressiva)
export const INSS = {
  vigencia: "2026",
  faixas: [
    { ate: 1621.0, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.09 },
    { ate: 4354.27, aliquota: 0.12 },
    { ate: 8475.55, aliquota: 0.14 },
  ],
};

// IRRF — tabela progressiva mensal (vigente desde maio/2025)
// + redutor da Lei 15.270/2025 (a partir de jan/2026)
export const IRRF = {
  vigencia: "2026",
  faixas: [
    { ate: 2428.8, aliquota: 0, deducao: 0 },
    { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
    { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
    { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
    { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
  ],
  deducaoDependente: 189.59,
  descontoSimplificado: 607.2,
  redutor: {
    isencaoAte: 5000.0,
    reducaoMaximaIsencao: 312.89,
    transicaoAte: 7350.0,
    constante: 978.62,
    fator: 0.133145,
  },
};

// Seguro-desemprego 2026 (vigente desde 11/01/2026)
export const SEGURO_DESEMPREGO = {
  vigencia: "2026",
  piso: 1621.0,
  teto: 2518.65,
  faixa1Ate: 2222.17,
  faixa2Ate: 3703.99,
  faixa2Base: 1777.74,
};

export const FGTS = {
  aliquotaDeposito: 0.08,
  rendimentoAnual: 0.03, // 3% a.a. (sem TR e sem distribuição de lucros: estimativa conservadora)
};
