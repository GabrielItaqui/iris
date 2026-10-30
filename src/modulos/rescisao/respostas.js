// Respostas do chat sobre rescisão, montadas a partir do cálculo (sem IA).

import { calcularCenario, calcularRescisao, data, hojeLocal, iso } from "./calculo.js";
import { contem, lerData } from "../../iris/linguagem.js";

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d) => iso(d).split("-").reverse().join("/");

const ASSUNTO = [
  "rescis", "demit", "demiss", "mandar embora", "mandarem embora", "me mandar", "dispens",
  "acordo", "fgts", "fundo de garantia", "ferias", "13", "decimo", "seguro", "aviso",
  "receb", "ganhar", "ganho", "multa", "inss", "irrf", "imposto", "desconto", "saque",
  "sacar", "tempo de casa", "sair da empresa", "sair", "quanto",
];

function lerCenario(t) {
  if (contem(t, "acordo", "484")) return "acordo";
  if (contem(t, "pedir demissao", "pedido de demissao", "pedir as contas", "pedir conta",
    "me demitir", "eu sair", "sair por conta", "por vontade", "pedisse", "eu pedir", "pedir pra sair",
    "pedir para sair")) return "pedido_demissao";
  if (contem(t, "demit", "mandar embora", "mandarem embora", "me mandar", "dispens", "sem justa causa",
    "demissao", "rescisao")) return "sem_justa_causa";
  return null;
}

function lerTopico(t) {
  if (contem(t, "compar", "vale a pena", "vale mais", "melhor opcao", "qual a diferenca", "cenarios")) return "comparar";
  if (contem(t, "detalh", "discrimin", "cada verba", "verbas", "completo")) return "detalhes";
  if (contem(t, "fgts", "fundo de garantia", "multa", "saque", "sacar")) return "fgts";
  if (contem(t, "seguro")) return "seguro";
  if (contem(t, "ferias")) return "ferias";
  if (contem(t, /\b13\b/, "13o", "decimo")) return "decimo";
  if (contem(t, "aviso")) return "aviso";
  if (contem(t, "inss", "irrf", "imposto", "desconto")) return "descontos";
  if (contem(t, "tempo de casa", "quanto tempo")) return "tempo";
  return null;
}

function cabecalho(c, dia, hoje) {
  const quando = iso(dia) === iso(hoje) ? "hoje" : `em ${dataBR(dia)}`;
  const como = {
    sem_justa_causa: `Se você for demitido sem justa causa ${quando}`,
    acordo: `Se você sair por acordo ${quando}`,
    pedido_demissao: `Se você pedir demissão ${quando}`,
  }[c.cenario];
  return como;
}

function resumo(c, dia, hoje) {
  const l = [`${cabecalho(c, dia, hoje)}, teria **${brl(c.totalEmMaos)}** em mãos:`];
  l.push(`• Rescisão líquida: ${brl(c.liquido)}`);
  if (c.fgts.disponivelSaque) {
    l.push(`• FGTS para saque: ${brl(c.fgts.disponivelSaque)}${c.fgts.multa ? ` (com multa de ${brl(c.fgts.multa)})` : ""}`);
  } else {
    l.push(`• FGTS: ${brl(c.fgts.retido)} fica retido na conta`);
  }
  if (c.seguroDesemprego.parcelas) {
    l.push(`• E ainda ${c.seguroDesemprego.parcelas} parcelas de seguro-desemprego de ${brl(c.seguroDesemprego.valorParcela)}`);
  }
  return l.join("\n");
}

function detalhes(c, dia, hoje) {
  return [
    `${cabecalho(c, dia, hoje)}:`,
    "",
    "**Verbas**",
    ...c.verbas.map((v) => `• ${v.nome}: ${brl(v.valor)}`),
    `Bruto: ${brl(c.bruto)}`,
    "",
    "**Descontos**",
    ...c.descontos.map((v) => `• ${v.nome}: − ${brl(v.valor)}`),
    `Líquido da rescisão: **${brl(c.liquido)}**`,
    "",
    `FGTS para saque: ${brl(c.fgts.disponivelSaque)}`,
    `Total em mãos: **${brl(c.totalEmMaos)}**`,
  ].join("\n");
}

function porTopico(topico, c, dia, hoje, dados) {
  const intro = cabecalho(c, dia, hoje);
  switch (topico) {
    case "fgts":
      if (!c.fgts.disponivelSaque) {
        return `${intro}, não pode sacar o FGTS. O saldo de **${brl(c.fgts.retido)}** fica retido na conta (só sai em casos como compra de imóvel, aposentadoria ou saque-aniversário).`;
      }
      return [
        `${intro}, poderia sacar **${brl(c.fgts.disponivelSaque)}** do FGTS:`,
        `• Saldo estimado: ${brl(c.fgts.saldoEstimado)}`,
        `• Depósito sobre a rescisão: ${brl(c.fgts.depositoRescisao)}`,
        c.fgts.multa ? `• Multa de ${c.cenario === "acordo" ? "20%" : "40%"}: ${brl(c.fgts.multa)}` : null,
        c.fgts.retido ? `• Fica retido: ${brl(c.fgts.retido)} (no acordo, só 80% do saldo é liberado)` : null,
        "O saldo é projetado a partir do último extrato que você informou.",
      ].filter(Boolean).join("\n");

    case "seguro":
      if (!c.seguroDesemprego.parcelas) {
        return c.cenario === "sem_justa_causa"
          ? "Pelas regras, você ainda não tem tempo de trabalho suficiente para o seguro-desemprego."
          : `${intro}, não teria direito ao seguro-desemprego. Ele só vale para demissão sem justa causa.`;
      }
      return `${intro}, teria **${c.seguroDesemprego.parcelas} parcelas de ${brl(c.seguroDesemprego.valorParcela)}**, ${brl(c.seguroDesemprego.total)} no total.`;

    case "ferias": {
      const itens = c.verbas.filter((v) => v.nome.includes("érias") || v.nome.includes("1/3"));
      const total = itens.reduce((s, v) => s + v.valor, 0);
      return [`${intro}, receberia **${brl(total)}** de férias (sem desconto de INSS ou IR):`, ...itens.map((v) => `• ${v.nome}: ${brl(v.valor)}`)].join("\n");
    }

    case "decimo": {
      const v = c.verbas.find((x) => x.nome.startsWith("13º"));
      const adiant = c.descontos.find((x) => x.nome.startsWith("Adiantamento"));
      if (!v) return `${intro}, não haveria 13º proporcional a receber.`;
      return `${intro}, o ${v.nome.toLowerCase()} seria de **${brl(v.valor)}** bruto.` +
        (adiant ? ` Desse valor sai o adiantamento de ${brl(adiant.valor)} que você já recebeu.` : "");
    }

    case "aviso": {
      const v = c.verbas.find((x) => x.nome.startsWith("Aviso"));
      if (c.cenario === "pedido_demissao") return "No pedido de demissão, quem dá o aviso é você: 30 dias trabalhados. Se não cumprir, a empresa pode descontar até 1 salário.";
      return `${intro}, o ${v.nome.toLowerCase()} daria **${brl(v.valor)}**${c.cenario === "acordo" ? " (no acordo, é metade do aviso)" : ""}. A data de saída projetada fica ${c.dataProjetada.split("-").reverse().join("/")}.`;
    }

    case "descontos":
      return [`${intro}, os descontos seriam de **${brl(c.totalDescontos)}**:`, ...c.descontos.map((v) => `• ${v.nome}: ${brl(v.valor)}`),
        "Férias e aviso prévio indenizados não têm INSS nem IR."].join("\n");

    case "tempo": {
      const r = calcularRescisao(dados, dia);
      return `Você tem ${r.tempoDeCasa.anos} anos e ${r.tempoDeCasa.meses} meses de casa${iso(dia) === iso(hoje) ? "" : ` em ${dataBR(dia)}`}.`;
    }

    case "detalhes":
      return detalhes(c, dia, hoje);

    default:
      return resumo(c, dia, hoje);
  }
}

function comparar(dados, dia, hoje) {
  const r = calcularRescisao(dados, dia);
  const quando = iso(dia) === iso(hoje) ? "hoje" : `em ${dataBR(dia)}`;
  return [
    `Comparando as três formas de sair ${quando} (total em mãos):`,
    ...r.cenarios.map((c) =>
      `• ${c.nome}: **${brl(c.totalEmMaos)}**${c.seguroDesemprego.parcelas ? ` + ${c.seguroDesemprego.parcelas}× ${brl(c.seguroDesemprego.valorParcela)} de seguro` : ""}`),
    "Quer o detalhe de algum? É só perguntar, por exemplo: “detalhes do acordo”.",
  ].join("\n");
}

// Devolve a resposta ou null se a pergunta não for sobre rescisão.
// "contexto" guarda o último cenário/assunto para perguntas como "e em março?".
export function responder(t, dados, contexto = {}, hoje = hojeLocal()) {
  const continuacao = /^e\b/.test(t) && contexto.rescisao;
  if (!continuacao && !contem(t, ...ASSUNTO)) return null;

  const anterior = continuacao ? contexto.rescisao : {};
  const lida = lerData(t, hoje);
  const dia = lida ?? (continuacao && anterior.dia ? anterior.dia : hoje);
  let cenario = lerCenario(t) ?? anterior.cenario ?? null;
  let topico = lerTopico(t) ?? (continuacao ? anterior.topico : null);

  if (dia < data(dados.admissao)) return "Essa data é anterior à sua admissão. Tente outra data.";

  contexto.rescisao = { dia, cenario, topico };

  if (topico === "comparar" || (!cenario && !topico)) return comparar(dados, dia, hoje);
  return porTopico(topico, calcularCenario(dados, dia, cenario ?? "sem_justa_causa"), dia, hoje, dados);
}
