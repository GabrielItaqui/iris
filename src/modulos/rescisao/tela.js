import { calcularRescisao } from "./calculo.js";

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (s) => s.split("-").reverse().join("/");

function linhas(itens, sinal = "") {
  return itens
    .map((i) => `<div class="linha"><span>${i.nome}</span><span>${sinal}${brl(i.valor)}</span></div>`)
    .join("");
}

function cartao(c) {
  const seguro = c.seguroDesemprego.parcelas
    ? `<div class="linha destaque-suave"><span>Seguro-desemprego</span>
         <span>${c.seguroDesemprego.parcelas}× ${brl(c.seguroDesemprego.valorParcela)}</span></div>`
    : "";
  const retido = c.fgts.retido > 0
    ? `<div class="linha nota"><span>FGTS que fica retido na conta</span><span>${brl(c.fgts.retido)}</span></div>`
    : "";
  const nota = c.cenario === "pedido_demissao"
    ? `<p class="nota">Considera aviso prévio trabalhado ou dispensado. Se você não cumprir, a empresa pode descontar até 1 salário.</p>`
    : "";

  return `
    <article class="cenario">
      <header>
        <h3>${c.nome}</h3>
        <p class="total">${brl(c.totalEmMaos)}</p>
        <p class="legenda">em mãos (rescisão líquida + FGTS sacável)</p>
      </header>
      <details>
        <summary>Ver detalhes</summary>
        <h4>Verbas</h4>
        ${linhas(c.verbas)}
        <div class="linha soma"><span>Bruto</span><span>${brl(c.bruto)}</span></div>
        <h4>Descontos</h4>
        ${linhas(c.descontos, "− ")}
        <div class="linha soma"><span>Líquido da rescisão</span><span>${brl(c.liquido)}</span></div>
        <h4>FGTS</h4>
        <div class="linha"><span>Saldo estimado hoje</span><span>${brl(c.fgts.saldoEstimado)}</span></div>
        <div class="linha"><span>Depósito sobre a rescisão</span><span>${brl(c.fgts.depositoRescisao)}</span></div>
        ${c.fgts.multa ? `<div class="linha"><span>Multa</span><span>${brl(c.fgts.multa)}</span></div>` : ""}
        <div class="linha soma"><span>Disponível para saque</span><span>${brl(c.fgts.disponivelSaque)}</span></div>
        ${retido}
        ${seguro}
        ${c.dataProjetada !== c.dataCalculo ? `<p class="nota">Data projetada com o aviso: ${dataBR(c.dataProjetada)}</p>` : ""}
        ${nota}
      </details>
    </article>`;
}

export function renderizar(container, dados) {
  const r = calcularRescisao(dados);
  r.cenarios.forEach((c) => (c.dataCalculo = r.dataCalculo));
  container.innerHTML = `
    <section class="modulo-rescisao">
      <p class="contexto">
        Se fosse hoje, <strong>${dataBR(r.dataCalculo)}</strong> ·
        ${r.tempoDeCasa.anos} anos e ${r.tempoDeCasa.meses} meses de casa ·
        remuneração de ${brl(r.remuneracaoMensal)}
      </p>
      <div class="cenarios">${r.cenarios.map(cartao).join("")}</div>
      <p class="nota">Estimativa. O saldo do FGTS é projetado a partir do último extrato informado.</p>
    </section>`;
}
