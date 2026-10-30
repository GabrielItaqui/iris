"""Gera iris-skill.zip para enviar ao Claude (Configurações → Capacidades → Skills).

Junta a pasta skill/iris com o seu dados.json (que fica fora do git).
Uso: python scripts/empacotar_skill.py
"""

import json
import sys
import zipfile
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
origem = raiz / "skill" / "iris"
dados = raiz / "dados.json"
destino = raiz / "iris-skill.zip"

if not dados.exists():
    sys.exit("dados.json não encontrado. Copie dados.exemplo.json para dados.json e preencha.")
json.loads(dados.read_text(encoding="utf-8"))  # falha cedo se o JSON estiver quebrado

with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
    for arquivo in sorted(origem.rglob("*")):
        if arquivo.is_file() and "__pycache__" not in arquivo.parts and arquivo.name != "dados.json":
            z.write(arquivo, Path("iris") / arquivo.relative_to(origem))
    z.write(dados, "iris/dados.json")

print(f"Gerado: {destino.name}")
with zipfile.ZipFile(destino) as z:
    for nome in z.namelist():
        print("  " + nome)
