age = 15
print(f"Dentro de 20 años tendrás {age + 20} años.")
print("Mi mensaje")
if age >= 18:
    print("Eres mayor de edad.")
    print  ("Puedes votar.")
else:
    print("Eres menor de edad.")
    print("No puedes votar.")

import os
os.system("cls")

print("\n Sentencia condicional con elif")
nota = 5
if nota >= 9:
    print("Excelente")
elif nota >= 7:
    print("Muy bien")
elif nota >= 5:
    print("Bien")
else:
    print("Necesitas mejorar")

print("\n Condiciones múltiples")
edad = 18
tiene_carnet = False
if edad >= 18 and tiene_carnet:
    print("Puedes conducir en Valencia.")
else:
    print("No puedes conducir en Valencia.")

if edad >= 18 or tiene_carnet:
    print("Puedes conducir en Brasil.")
else: 
    print("No puedes conducir en Brasil.")

es_fin_de_semana = True
if es_fin_de_semana:
    print("Hoy es fin de semana.")
if not es_fin_de_semana:
    print("Hoy es un día laborable.")