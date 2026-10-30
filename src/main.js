// Ponto de entrada da Iris: menu de módulos + chat.
// __IRIS_DADOS__ é injetado pelo build (scripts/build.mjs).

import { MODULOS } from "./modulos/index.js";
import { criarChat } from "./iris/chat.js";

const dados = __IRIS_DADOS__;

const menu = document.querySelector("#menu");
const conteudo = document.querySelector("#conteudo");

const telas = [
  { id: "chat", nome: "Conversar", icone: "✨", renderizar: renderizarChat },
  ...MODULOS,
];

function abrir(id) {
  const tela = telas.find((t) => t.id === id) ?? telas[0];
  menu.querySelectorAll("button").forEach((b) => b.classList.toggle("ativo", b.dataset.id === tela.id));
  conteudo.replaceChildren();
  tela.renderizar(conteudo, dados);
  try { localStorage.setItem("iris:tela", tela.id); } catch {}
}

menu.innerHTML = telas
  .map((t) => `<button data-id="${t.id}"><span>${t.icone}</span>${t.nome}</button>`)
  .join("");
menu.addEventListener("click", (e) => {
  const botao = e.target.closest("button");
  if (botao) abrir(botao.dataset.id);
});

// ---------- chat ----------

const enviar = criarChat(dados);
const historico = [];

function escapar(texto) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function formatar(texto) {
  return escapar(texto)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function renderizarChat(container) {
  container.innerHTML = `
    <section class="chat">
      <div class="mensagens" id="mensagens"></div>
      <form id="form-chat">
        <input id="pergunta" autocomplete="off" placeholder="Pergunte algo à Iris…" />
        <button type="submit">Enviar</button>
      </form>
    </section>`;

  const lista = container.querySelector("#mensagens");
  const form = container.querySelector("#form-chat");
  const campo = container.querySelector("#pergunta");

  function mostrar(autor, texto) {
    const div = document.createElement("div");
    div.className = `msg ${autor}`;
    div.innerHTML = formatar(texto);
    lista.append(div);
    lista.scrollTop = lista.scrollHeight;
    return div;
  }

  if (!historico.length) {
    const sugestoes = MODULOS.flatMap((m) => m.exemplos ?? []);
    lista.innerHTML = `
      <div class="boas-vindas">
        <p>Oi${dados.nome ? `, ${escapar(dados.nome)}` : ""}! O que você quer saber?</p>
        <div class="sugestoes">${sugestoes.map((s) => `<button type="button">${s}</button>`).join("")}</div>
      </div>`;
    lista.querySelectorAll(".sugestoes button").forEach((b) =>
      b.addEventListener("click", () => { campo.value = b.textContent; form.requestSubmit(); }),
    );
  }
  historico.forEach(([autor, texto]) => mostrar(autor, texto));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto) return;
    lista.querySelector(".boas-vindas")?.remove();
    campo.value = "";
    const resposta = enviar(texto);
    historico.push(["eu", texto], ["iris", resposta]);
    mostrar("eu", texto);
    mostrar("iris", resposta);
  });
  campo.focus();
}

let inicial = "chat";
try { inicial = localStorage.getItem("iris:tela") ?? "chat"; } catch {}
abrir(inicial);
