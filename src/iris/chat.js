// Chat da Iris: conversa com o Claude e usa os módulos como ferramentas.

import Anthropic from "@anthropic-ai/sdk";
import { MODULOS } from "../modulos/index.js";
import { hojeLocal, iso } from "../modulos/rescisao/calculo.js";

const MODELO = "claude-opus-5-5";

function sistema(dados) {
  return `Você é a Iris, assistente pessoal de ${dados.nome ?? "seu dono"}. Responda em português do Brasil, de forma direta e calorosa.

Hoje é ${iso(hojeLocal())}.

Você tem ferramentas que leem os dados reais do usuário. Sempre que a pergunta envolver valores dele (rescisão, FGTS, férias, seguro-desemprego etc.), chame a ferramenta e responda com os números que ela devolver. Nunca invente nem estime valores por conta própria. Formate valores em reais (R$ 1.234,56).

Os cálculos são estimativas: o saldo do FGTS é projetado a partir do último extrato informado. Mencione isso quando for relevante, sem repetir em toda resposta.`;
}

export function criarChat(dados, apiKey) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const tools = MODULOS.flatMap((m) => m.ferramentas ?? []);
  const donoDa = Object.fromEntries(
    MODULOS.flatMap((m) => (m.ferramentas ?? []).map((t) => [t.name, m])),
  );
  const mensagens = [];

  function executar(bloco) {
    try {
      const resultado = donoDa[bloco.name].executar(bloco.name, bloco.input ?? {}, dados);
      return { type: "tool_result", tool_use_id: bloco.id, content: JSON.stringify(resultado) };
    } catch (erro) {
      return { type: "tool_result", tool_use_id: bloco.id, content: erro.message, is_error: true };
    }
  }

  // Envia uma mensagem e devolve o texto final da Iris.
  return async function enviar(texto) {
    const inicio = mensagens.length;
    mensagens.push({ role: "user", content: texto });

    for (let volta = 0; volta < 8; volta++) {
      let resposta;
      try {
        resposta = await client.beta.messages.create({
          model: MODELO,
          max_tokens: 16000,
          output_config: { effort: "low" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: sistema(dados),
          tools,
          messages: mensagens,
        });
      } catch (erro) {
        mensagens.length = inicio; // descarta a pergunta que falhou para o histórico seguir válido
        if (erro instanceof Anthropic.AuthenticationError) return "Minha chave da API não é válida. Confira o secret ANTHROPIC_API_KEY.";
        if (erro instanceof Anthropic.RateLimitError) return "Muitas mensagens seguidas. Tente de novo em alguns segundos.";
        if (erro instanceof Anthropic.APIError) return `Erro da API (${erro.status}): ${erro.message}`;
        return `Não consegui me conectar: ${erro.message}`;
      }

      mensagens.push({ role: "assistant", content: resposta.content });

      if (resposta.stop_reason === "refusal") {
        return "Não posso ajudar com esse pedido.";
      }
      if (resposta.stop_reason !== "tool_use") {
        return resposta.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
      }

      const resultados = resposta.content.filter((b) => b.type === "tool_use").map(executar);
      mensagens.push({ role: "user", content: resultados });
    }
    return "Me perdi nas contas. Pode reformular a pergunta?";
  };
}
