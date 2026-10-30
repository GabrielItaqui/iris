// Chat da Iris: tudo roda no navegador, sem IA e sem custo.
// Cada módulo tem uma função responder(texto, dados, contexto) que devolve
// a resposta ou null quando a pergunta não é com ele.

import { MODULOS } from "../modulos/index.js";
import { contem, normalizar } from "./linguagem.js";

function ajuda() {
  const exemplos = MODULOS.flatMap((m) => m.exemplos ?? []);
  return ["Por enquanto eu entendo perguntas como:", ...exemplos.map((e) => `• ${e}`)].join("\n");
}

export function criarChat(dados) {
  const contexto = {};

  return function enviar(texto) {
    const t = normalizar(texto);

    for (const modulo of MODULOS) {
      const resposta = modulo.responder?.(t, dados, contexto);
      if (resposta) return resposta;
    }

    if (contem(t, /^(oi|ola|bom dia|boa tarde|boa noite|e ai|hey)\b/)) {
      return `Oi${dados.nome ? `, ${dados.nome}` : ""}! ${ajuda()}`;
    }
    if (contem(t, "obrigad", "valeu", "brigad")) return "Por nada! 💜";
    if (contem(t, "ajuda", "o que voce", "o que vc", "como funciona")) return ajuda();
    return `Ainda não sei responder isso. ${ajuda()}`;
  };
}
