// Painel da Iris: um menu com os módulos instalados.
// __IRIS_DADOS__ é injetado pelo build (scripts/build.mjs).

import { MODULOS } from "./modulos/index.js";

const dados = __IRIS_DADOS__;

const menu = document.querySelector("#menu");
const conteudo = document.querySelector("#conteudo");

function abrir(id) {
  const modulo = MODULOS.find((m) => m.id === id) ?? MODULOS[0];
  menu.querySelectorAll("button").forEach((b) => b.classList.toggle("ativo", b.dataset.id === modulo.id));
  conteudo.replaceChildren();
  modulo.renderizar(conteudo, dados);
  try { localStorage.setItem("iris:tela", modulo.id); } catch {}
}

menu.innerHTML = MODULOS
  .map((m) => `<button data-id="${m.id}"><span>${m.icone}</span>${m.nome}</button>`)
  .join("");
menu.addEventListener("click", (e) => {
  const botao = e.target.closest("button");
  if (botao) abrir(botao.dataset.id);
});

let inicial = MODULOS[0].id;
try { inicial = localStorage.getItem("iris:tela") ?? inicial; } catch {}
abrir(inicial);
