// Módulo "Rescisão" do painel. A Iris (skill no Claude) usa o mesmo cálculo
// em skill/iris/scripts/rescisao.py.

import { renderizar } from "./tela.js";

export default {
  id: "rescisao",
  nome: "Rescisão",
  descricao: "Quanto eu receberia se saísse da empresa hoje",
  icone: "💼",
  renderizar,
};
