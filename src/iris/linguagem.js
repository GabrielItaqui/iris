// Ferramentas para a Iris entender perguntas em português sem depender de IA:
// normalização de texto, busca por palavras-chave e leitura de datas.

const MESES = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};

const NUMEROS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30,
};

// Minúsculas, sem acentos e sem "º"/"ª".
export function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ºª°]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// true se o texto contém alguma das expressões (aceita regex ou string).
export function contem(texto, ...expressoes) {
  return expressoes.some((e) => (e instanceof RegExp ? e.test(texto) : texto.includes(e)));
}

function utc(a, m, d) {
  return new Date(Date.UTC(a, m, d));
}

function valida(a, m, d) {
  const dt = utc(a, m, d);
  return dt.getUTCMonth() === m && dt.getUTCDate() === d ? dt : null;
}

function somarMeses(d, n) {
  const a = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const ultimo = utc(a, m + 1, 0).getUTCDate();
  return utc(a, m, Math.min(d.getUTCDate(), ultimo));
}

function numero(palavra) {
  return /^\d+$/.test(palavra) ? Number(palavra) : NUMEROS[palavra];
}

// Sem ano explícito, uma data que já passou vai para o ano seguinte.
function proxima(m, d, hoje) {
  let dt = valida(hoje.getUTCFullYear(), m, d);
  if (dt && dt < hoje) dt = valida(hoje.getUTCFullYear() + 1, m, d);
  return dt;
}

// Procura uma data no texto (já normalizado). Devolve Date (UTC) ou null.
export function lerData(t, hoje) {
  let r;

  if ((r = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const [, d, m, a] = r;
    if (a) return valida(a.length === 2 ? 2000 + Number(a) : Number(a), m - 1, Number(d));
    return proxima(m - 1, Number(d), hoje);
  }

  const nomesMes = Object.keys(MESES).join("|");
  if ((r = t.match(new RegExp(`\\b(\\d{1,2}|primeiro) de (${nomesMes})\\b(?: de (\\d{4}))?`)))) {
    const d = r[1] === "primeiro" ? 1 : Number(r[1]);
    const m = MESES[r[2]];
    return r[3] ? valida(Number(r[3]), m, d) : proxima(m, d, hoje);
  }

  // Antes dos nomes de mês: "em dez dias" é prazo, não dezembro.
  if ((r = t.match(/\b(?:daqui a|daqui|em|depois de|apos|dentro de) (\d+|[a-z]+) (dias?|semanas?|mes|meses|anos?)\b/))) {
    const n = numero(r[1]);
    if (n) {
      if (r[2].startsWith("dia")) return utc(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + n);
      if (r[2].startsWith("semana")) return utc(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + 7 * n);
      if (r[2].startsWith("mes")) return somarMeses(hoje, n);
      return somarMeses(hoje, 12 * n);
    }
  }

  // "em março": dia 1º do mês (ou hoje, se for o mês atual).
  if ((r = t.match(new RegExp(`\\b(?:em|no mes de|ate|para) (${nomesMes})\\b(?: de (\\d{4}))?`)))) {
    const m = MESES[r[1]];
    if (r[2]) return utc(Number(r[2]), m, 1);
    const dt = utc(hoje.getUTCFullYear(), m, 1);
    return m < hoje.getUTCMonth() ? utc(hoje.getUTCFullYear() + 1, m, 1) : dt < hoje ? hoje : dt;
  }

  if (contem(t, "amanha")) return utc(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + 1);
  if (contem(t, "semana que vem", "proxima semana")) return utc(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + 7);
  if (contem(t, "mes que vem", "proximo mes")) return somarMeses(hoje, 1);
  if (contem(t, "ano que vem", "proximo ano")) return somarMeses(hoje, 12);
  if (contem(t, "fim do ano", "final do ano")) return utc(hoje.getUTCFullYear(), 11, 31);

  return null;
}
