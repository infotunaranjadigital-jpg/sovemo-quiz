import urllib.request
import json

base = "http://localhost:3000"

print("--- 1. VERIFICANDO RUTAS HTTP ---")
routes = ["/", "/votar", "/pantalla", "/admin"]
for r in routes:
    req = urllib.request.Request(base + r)
    with urllib.request.urlopen(req) as resp:
        print(f"OK {r}: Status {resp.status}")

print("\n--- 2. VERIFICANDO API STATE ---")
with urllib.request.urlopen(base + "/api/state") as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print("totalQuestions:", data.get("totalQuestions"))
    print("currentQuestionId:", data.get("currentQuestionId"))

print("\n--- 3. VERIFICANDO ADMIN OVERVIEW ---")
with urllib.request.urlopen(base + "/api/admin/overview?pin=sovemo2026") as resp:
    admin_data = json.loads(resp.read().decode('utf-8'))
    print("Admin Questions count:", len(admin_data.get("questions", [])))

print("\n--- 4. VERIFICANDO EXPORTACIÓN CSV ---")
with urllib.request.urlopen(base + "/api/export-csv?pin=sovemo2026") as resp:
    csv_bytes = resp.read()
    csv_text = csv_bytes.decode('utf-8', errors='ignore')
    print("CSV Status:", resp.status)
    print("CSV Size bytes:", len(csv_bytes))
    print("CSV Header:", csv_text.splitlines()[0][1:]) # omit BOM for console

print("\n--- 5. VERIFICANDO REINICIO / LIMPIEZA DE FORMULARIO ---")
req = urllib.request.Request(
    base + "/api/reset-votes",
    data=json.dumps({"pin": "sovemo2026"}).encode('utf-8'),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req) as resp:
    reset_data = json.loads(resp.read().decode('utf-8'))
    print("Reset response:", reset_data)

print("\n¡TODAS LAS PRUEBAS FUNCIONAN AL 100%!")
