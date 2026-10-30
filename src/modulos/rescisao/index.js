// Módulo "Rescisão": o que aparece no menu e o que a Iris pode consultar no chat.

import { calcularRescisao, calcularCenario, CENARIOS, data, hojeLocal } from "./calculo.js";
import { renderizar } from "./tela.js";

export default {
  id: "rescisao",
  nome: "Rescisão",
  descricao: "Quanto eu receberia se saísse da empresa hoje",
  icone: "💼",
  renderizar,

  ferramentas: [
    {
      name: "consultar_rescisao",
      description:
        "Calcula a rescisão trabalhista do usuário (CLT) com os dados reais dele. " +
        "Sem 'data', calcula para hoje. Retorna verbas, descontos, líquido, FGTS sacável, " +
        "multa, seguro-desemprego e o total em mãos. Sem 'cenario', retorna os três " +
        "cenários: sem_justa_causa, acordo e pedido_demissao.",
      input_schema: {
        type: "object",
        properties: {
          data: {
            type: "string",
            description: "Data da saída no formato AAAA-MM-DD. Omita para usar hoje.",
          },
          cenario: { type: "string", enum: Object.keys(CENARIOS) },
        },
        additionalProperties: false,
      },
    },
  ],

  executar(nome, entrada, dados) {
    if (nome !== "consultar_rescisao") throw new Error(`Ferramenta desconhecida: ${nome}`);
    if (entrada.data && !/^\d{4}-\d{2}-\d{2}$/.test(entrada.data)) {
      throw new Error("Use a data no formato AAAA-MM-DD.");
    }
    if (entrada.cenario && !CENARIOS[entrada.cenario]) {
      throw new Error(`Cenário inválido: ${entrada.cenario}`);
    }
    const dia = entrada.data ? data(entrada.data) : hojeLocal();
    if (dia < data(dados.admissao)) throw new Error("A data é anterior à admissão.");
    return entrada.cenario ? calcularCenario(dados, dia, entrada.cenario) : calcularRescisao(dados, dia);
  },
};
