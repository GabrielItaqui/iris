#!/usr/bin/env python3
"""Cálculo de rescisão CLT da Iris.

Mesmo cálculo do painel (src/modulos/rescisao/calculo.js). Qualquer mudança
aqui precisa ser feita lá também; `npm run teste` compara os dois.

Uso:
  python rescisao.py                         # hoje, os três cenários
  python rescisao.py --data 2027-03-01       # outra data de saída
  python rescisao.py --cenario acordo        # um cenário só
  python rescisao.py --ajuste salarioFixo=8000 --ajuste ferias.periodosGozados=5
                                             # simulação sem alterar dados.json
Saída: JSON em stdout.
"""

import argparse
import calendar
import json
import math
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# ---------- tabelas legais (atualizar todo janeiro) ----------

INSS_FAIXAS = [(1621.00, 0.075), (2902.84, 0.09), (4354.27, 0.12), (8475.55, 0.14)]

IRRF_FAIXAS = [
    (2428.80, 0.0, 0.0),
    (2826.65, 0.075, 182.16),
    (3751.05, 0.15, 394.16),
    (4664.68, 0.225, 675.49),
    (math.inf, 0.275, 908.73),
]
IRRF_DEPENDENTE = 189.59
IRRF_SIMPLIFICADO = 607.20
REDUTOR_ISENCAO_ATE = 5000.00
REDUTOR_MAXIMO = 312.89
REDUTOR_TRANSICAO_ATE = 7350.00
REDUTOR_CONSTANTE = 978.62
REDUTOR_FATOR = 0.133145

SEGURO_PISO = 1621.00
SEGURO_TETO = 2518.65
SEGURO_FAIXA1_ATE = 2222.17
SEGURO_FAIXA2_ATE = 3703.99
SEGURO_FAIXA2_BASE = 1777.74

FGTS_DEPOSITO = 0.08
FGTS_RENDIMENTO_ANUAL = 0.03

CENARIOS = {
    "sem_justa_causa": dict(nome="Demissão sem justa causa", fracao_aviso=1, multa=0.4, saque=1, seguro=True),
    "acordo": dict(nome="Acordo (art. 484-A)", fracao_aviso=0.5, multa=0.2, saque=0.8, seguro=False),
    "pedido_demissao": dict(nome="Pedido de demissão", fracao_aviso=0, multa=0, saque=0, seguro=False),
}

# Brasil não tem horário de verão desde 2019: UTC-3 fixo.
BRASILIA = timezone(timedelta(hours=-3))

# ---------- utilitários ----------


def arred(v):
    # Igual ao JS: Math.round(Number(v.toFixed(10)) * 100) / 100
    return math.floor(float(f"{v:.10f}") * 100 + 0.5) / 100


def ler_data(texto):
    return date.fromisoformat(texto)


def br(d):
    return d.strftime("%d/%m/%Y")


def somar_meses(d, n):
    m = d.month - 1 + n
    ano, mes = d.year + m // 12, m % 12 + 1
    return date(ano, mes, min(d.day, calendar.monthrange(ano, mes)[1]))


def anos_completos(ini, fim):
    anos = fim.year - ini.year
    if somar_meses(ini, anos * 12) > fim:
        anos -= 1
    return max(0, anos)


def meses_completos(ini, fim):
    meses = (fim.year - ini.year) * 12 + fim.month - ini.month
    if somar_meses(ini, meses) > fim:
        meses -= 1
    return max(0, meses)


# ---------- impostos ----------


def calcular_inss(base):
    desconto, anterior = 0.0, 0.0
    for ate, aliquota in INSS_FAIXAS:
        if base <= anterior:
            break
        desconto += (min(base, ate) - anterior) * aliquota
        anterior = ate
    return arred(desconto)


def calcular_irrf(bruto, inss, dependentes):
    deducao = max(inss + dependentes * IRRF_DEPENDENTE, IRRF_SIMPLIFICADO)
    base = max(0.0, bruto - deducao)
    _, aliquota, parcela = next(f for f in IRRF_FAIXAS if base <= f[0])
    imposto = max(0.0, base * aliquota - parcela)
    reducao = 0.0
    if bruto <= REDUTOR_ISENCAO_ATE:
        reducao = REDUTOR_MAXIMO
    elif bruto <= REDUTOR_TRANSICAO_ATE:
        reducao = max(0.0, REDUTOR_CONSTANTE - REDUTOR_FATOR * bruto)
    return arred(max(0.0, imposto - reducao))


# ---------- verbas ----------


def avos13(admissao, fim, ano):
    avos = 0
    for mes in range(1, 13):
        ini = max(admissao, date(ano, mes, 1))
        fim_mes = min(fim, date(ano, mes, calendar.monthrange(ano, mes)[1]))
        if fim_mes >= ini and (fim_mes - ini).days + 1 >= 15:
            avos += 1
    return avos


def decimo_terceiro(admissao, hoje, fim, rem):
    ano = hoje.year
    pago_no_ano = hoje >= date(ano, 12, 20)
    adiantou = hoje >= date(ano, 11, 30)
    avos, adiantamento = 0, 0.0
    if not pago_no_ano:
        avos += avos13(admissao, fim, ano)
        if adiantou:
            adiantamento = rem * avos13(admissao, date(ano, 11, 30), ano) / 12 / 2
    if fim.year > ano:
        avos += avos13(admissao, fim, fim.year)
    return avos, arred(rem * avos / 12), arred(adiantamento)


def ferias(dados, admissao, hoje, fim, rem):
    periodos = anos_completos(admissao, fim)
    gozados = dados.get("ferias", {}).get("periodosGozados", 0)
    vencidas = []
    for i in range(gozados + 1, periodos + 1):
        fim_aquisitivo = somar_meses(admissao, i * 12) - timedelta(days=1)
        em_dobro = hoje > somar_meses(fim_aquisitivo, 12)
        valor = rem * (2 if em_dobro else 1)
        vencidas.append(dict(
            periodo=f"{br(somar_meses(admissao, (i - 1) * 12))} a {br(fim_aquisitivo)}",
            emDobro=em_dobro, valor=arred(valor), terco=arred(valor / 3),
        ))
    inicio = somar_meses(admissao, periodos * 12)
    avos = meses_completos(inicio, fim)
    if (fim - somar_meses(inicio, avos)).days + 1 >= 15:
        avos += 1
    avos = min(avos, 12)
    prop = rem * avos / 12
    return vencidas, dict(avos=avos, valor=arred(prop), terco=arred(prop / 3))


def saldo_fgts(dados, hoje, rem):
    ref = ler_data(dados["fgts"]["dataReferencia"])
    taxa = (1 + FGTS_RENDIMENTO_ANUAL) ** (1 / 12) - 1
    saldo = dados["fgts"]["saldo"]
    for i in range(1, meses_completos(ref, hoje) + 1):
        saldo = saldo * (1 + taxa) + rem * FGTS_DEPOSITO
        if somar_meses(ref, i).month == 12:
            saldo += rem * FGTS_DEPOSITO  # 13º
    return arred(saldo)


def seguro_desemprego(dados, admissao, hoje, rem):
    if rem <= SEGURO_FAIXA1_ATE:
        parcela = rem * 0.8
    elif rem <= SEGURO_FAIXA2_ATE:
        parcela = SEGURO_FAIXA2_BASE + (rem - SEGURO_FAIXA1_ATE) * 0.5
    else:
        parcela = SEGURO_TETO
    parcela = min(SEGURO_TETO, max(SEGURO_PISO, parcela))
    meses = min(36, meses_completos(admissao, hoje))
    anteriores = dados.get("seguroDesemprego", {}).get("solicitacoesAnteriores", 0)
    minimo = 12 if anteriores == 0 else 9 if anteriores == 1 else 6
    parcelas = 5 if meses >= 24 else 4 if meses >= 12 else 3 if meses >= minimo else 0
    return dict(parcelas=parcelas, valorParcela=arred(parcela), total=arred(parcela * parcelas))


# ---------- cenários ----------


def remuneracao_mensal(dados):
    return dados["salarioFixo"] + dados.get("adicionaisFixos", 0) + dados.get("mediaVariaveis", 0)


def calcular_cenario(dados, hoje, chave):
    c = CENARIOS[chave]
    rem = remuneracao_mensal(dados)
    admissao = ler_data(dados["admissao"])
    anos = anos_completos(admissao, hoje)

    dias_aviso = math.floor(min(90, 30 + 3 * anos) * c["fracao_aviso"] + 0.5)  # Math.round do JS
    fim = hoje + timedelta(days=dias_aviso)

    dias_mes = min(30, hoje.day)
    saldo_salario = arred(rem / 30 * dias_mes)
    aviso = arred(rem / 30 * dias_aviso)
    avos_13, bruto_13, adiantamento = decimo_terceiro(admissao, hoje, fim, rem)
    vencidas, prop = ferias(dados, admissao, hoje, fim, rem)

    dep = dados.get("dependentesIR", 0)
    inss_saldo = calcular_inss(saldo_salario)
    irrf_saldo = calcular_irrf(saldo_salario, inss_saldo, dep)
    inss_13 = calcular_inss(bruto_13)
    irrf_13 = calcular_irrf(bruto_13, inss_13, dep)

    verbas = [dict(nome=f"Saldo de salário ({dias_mes} {'dia' if dias_mes == 1 else 'dias'})", valor=saldo_salario)]
    if aviso:
        verbas.append(dict(nome=f"Aviso prévio indenizado ({dias_aviso} dias)", valor=aviso))
    verbas.append(dict(nome=f"13º proporcional ({avos_13}/12)", valor=bruto_13))
    for v in vencidas:
        verbas.append(dict(nome=f"Férias vencidas{' em dobro' if v['emDobro'] else ''} ({v['periodo']})", valor=v["valor"]))
        verbas.append(dict(nome="1/3 sobre férias vencidas", valor=v["terco"]))
    verbas.append(dict(nome=f"Férias proporcionais ({prop['avos']}/12)", valor=prop["valor"]))
    verbas.append(dict(nome="1/3 sobre férias proporcionais", valor=prop["terco"]))
    verbas = [v for v in verbas if v["valor"] > 0]

    descontos = [
        dict(nome="INSS sobre saldo de salário", valor=inss_saldo),
        dict(nome="IRRF sobre saldo de salário", valor=irrf_saldo),
        dict(nome="INSS sobre 13º", valor=inss_13),
        dict(nome="IRRF sobre 13º", valor=irrf_13),
        dict(nome="Adiantamento do 13º já recebido", valor=adiantamento),
    ]
    descontos = [d for d in descontos if d["valor"] > 0]

    bruto = arred(sum(v["valor"] for v in verbas))
    total_descontos = arred(sum(d["valor"] for d in descontos))
    liquido = arred(bruto - total_descontos)

    saldo = saldo_fgts(dados, hoje, rem)
    deposito = arred((saldo_salario + aviso + bruto_13) * FGTS_DEPOSITO)
    base_multa = saldo + deposito
    multa = arred(base_multa * c["multa"])
    saque = arred(base_multa * c["saque"] + multa)

    seguro = seguro_desemprego(dados, admissao, hoje, rem) if c["seguro"] else dict(parcelas=0, valorParcela=0, total=0)

    return dict(
        cenario=chave,
        nome=c["nome"],
        dataProjetada=fim.isoformat(),
        verbas=verbas,
        descontos=descontos,
        bruto=bruto,
        totalDescontos=total_descontos,
        liquido=liquido,
        fgts=dict(
            saldoEstimado=saldo,
            depositoRescisao=deposito,
            multa=multa,
            disponivelSaque=saque,
            retido=arred(base_multa - base_multa * c["saque"]),
        ),
        seguroDesemprego=seguro,
        totalEmMaos=arred(liquido + saque),
    )


def calcular_rescisao(dados, hoje):
    admissao = ler_data(dados["admissao"])
    return dict(
        dataCalculo=hoje.isoformat(),
        admissao=dados["admissao"],
        tempoDeCasa=dict(anos=anos_completos(admissao, hoje), meses=meses_completos(admissao, hoje) % 12),
        remuneracaoMensal=remuneracao_mensal(dados),
        cenarios=[calcular_cenario(dados, hoje, k) for k in CENARIOS],
    )


# ---------- linha de comando ----------


def aplicar_ajuste(dados, ajuste):
    caminho, _, valor = ajuste.partition("=")
    try:
        valor = json.loads(valor)
    except json.JSONDecodeError:
        pass  # texto, como uma data
    alvo = dados
    *pais, campo = caminho.split(".")
    for p in pais:
        alvo = alvo.setdefault(p, {})
    alvo[campo] = valor


def main():
    padrao = Path(__file__).resolve().parent.parent / "dados.json"
    p = argparse.ArgumentParser(description="Calcula a rescisão CLT do usuário.")
    p.add_argument("--data", help="data de saída AAAA-MM-DD (padrão: hoje, horário de Brasília)")
    p.add_argument("--cenario", choices=list(CENARIOS))
    p.add_argument("--dados", default=str(padrao), help="arquivo de dados (padrão: dados.json da skill)")
    p.add_argument("--ajuste", action="append", default=[], metavar="CAMPO=VALOR",
                   help="altera um dado só nesta simulação; pode repetir")
    args = p.parse_args()

    dados = json.loads(Path(args.dados).read_text(encoding="utf-8"))
    for a in args.ajuste:
        aplicar_ajuste(dados, a)

    hoje = ler_data(args.data) if args.data else datetime.now(BRASILIA).date()
    if hoje < ler_data(dados["admissao"]):
        sys.exit("A data é anterior à admissão.")

    resultado = calcular_cenario(dados, hoje, args.cenario) if args.cenario else calcular_rescisao(dados, hoje)
    sys.stdout.reconfigure(encoding="utf-8")
    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == "__main__":
    main()
