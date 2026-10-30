// Módulo "Rescisão": o que aparece no menu e o que a Iris responde no chat.

import { renderizar } from "./tela.js";
import { responder } from "./respostas.js";

export default {
  id: "rescisao",
  nome: "Rescisão",
  descricao: "Quanto eu receberia se saísse da empresa hoje",
  icone: "💼",
  renderizar,
  responder,
  exemplos: [
    "Quanto eu recebo se for demitido hoje?",
    "E se eu pedir demissão?",
    "Quanto de FGTS no acordo em 1º de março?",
  ],
};
