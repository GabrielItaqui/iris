"""Gera iris-skill.zip para enviar ao Claude (Configurações → Capacidades → Skills).

Junta a pasta skill/iris com o seu dados.json e o contexto.md (que ficam fora do git).
Uso: python scripts/empacotar_skill.py
"""

import json
import sys
import zipfile
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
origem = raiz / "skill" / "iris"
dados = raiz / "dados.json"
contexto = raiz / "contexto.md"  # opcional: quem é o usuário, também fora do git
destino = raiz / "iris-skill.zip"

if not dados.exists():
    sys.exit("dados.json não encontrado. Copie dados.exemplo.json para dados.json e preencha.")
json.loads(dados.read_text(encoding="utf-8"))  # falha cedo se o JSON estiver quebrado

with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
    for arquivo in sorted(origem.rglob("*")):
        if arquivo.is_file() and "__pycache__" not in arquivo.parts and arquivo.name not in ("dados.json", "contexto.md"):
            z.write(arquivo, Path("iris") / arquivo.relative_to(origem))
    z.write(dados, "iris/dados.json")
    if contexto.exists():
        z.write(contexto, "iris/contexto.md")

print(f"Gerado: {destino.name}")
with zipfile.ZipFile(destino) as z:
    for nome in z.namelist():
        print("  " + nome)
