"""Catalogo de ejercicios que viene de serie con la app.

Cada entrada: (nombre, grupo muscular, material por defecto, tipo de variante, variantes).
Si ya existe un ejercicio con el mismo nombre, se convierte en ejercicio del catalogo en vez de duplicarlo.
"""
from django.db import migrations

CATALOG = [
    # Pecho
    ('Press de banca', 'Pecho', 'plates', 'Agarre', ['Medio', 'Abierto', 'Cerrado']),
    ('Press de banca inclinado', 'Pecho', 'plates', 'Agarre', ['Medio', 'Abierto', 'Cerrado']),
    ('Press de banca declinado', 'Pecho', 'plates', '', []),
    ('Press con mancuernas', 'Pecho', 'dumbbell', 'Inclinación', ['Plano', 'Inclinado', 'Declinado']),
    ('Aperturas con mancuernas', 'Pecho', 'dumbbell', 'Inclinación', ['Plano', 'Inclinado']),
    ('Cruce de poleas', 'Pecho', 'machine', 'Altura de la polea', ['Alta', 'Media', 'Baja']),
    ('Press de pecho en máquina', 'Pecho', 'machine', 'Inclinación', ['Plano', 'Inclinado']),
    ('Contractor de pecho', 'Pecho', 'machine', '', []),
    ('Fondos en paralelas', 'Pecho', 'bodyweight', 'Énfasis', ['Pecho', 'Tríceps']),
    ('Flexiones', 'Pecho', 'bodyweight', 'Tipo', ['Normales', 'Abiertas', 'Diamante', 'Inclinadas', 'Declinadas']),
    # Espalda
    ('Dominadas', 'Espalda', 'bodyweight', 'Agarre', ['Prono abierto', 'Prono cerrado', 'Supino', 'Neutro']),
    ('Jalón al pecho', 'Espalda', 'machine', 'Agarre', ['Prono abierto', 'Prono cerrado', 'Supino', 'Neutro', 'Triángulo']),
    ('Remo con barra', 'Espalda', 'plates', 'Agarre', ['Prono', 'Supino']),
    ('Remo con mancuerna', 'Espalda', 'dumbbell', 'Apoyo', ['Un brazo en banco', 'Pecho apoyado en banco inclinado']),
    ('Remo en polea baja', 'Espalda', 'machine', 'Agarre', ['Neutro (triángulo)', 'Prono abierto', 'Supino']),
    ('Remo en máquina', 'Espalda', 'machine', 'Agarre', ['Neutro', 'Prono']),
    ('Remo en T', 'Espalda', 'plates', 'Agarre', ['Neutro', 'Prono']),
    ('Peso muerto', 'Espalda', 'plates', 'Estilo', ['Convencional', 'Sumo', 'Barra hexagonal']),
    ('Pull-over en polea', 'Espalda', 'machine', 'Agarre', ['Barra recta', 'Cuerda']),
    ('Hiperextensiones', 'Espalda', 'bodyweight', '', []),
    ('Encogimientos', 'Espalda', 'dumbbell', 'Material', ['Mancuernas', 'Barra']),
    # Hombros
    ('Press militar', 'Hombros', 'plates', 'Posición', ['De pie', 'Sentado']),
    ('Press de hombros con mancuernas', 'Hombros', 'dumbbell', 'Tipo', ['Sentado', 'De pie', 'Arnold']),
    ('Press de hombros en máquina', 'Hombros', 'machine', '', []),
    ('Elevaciones laterales', 'Hombros', 'dumbbell', 'Posición', ['De pie', 'Sentado', 'Tumbado de lado']),
    ('Elevaciones laterales en polea', 'Hombros', 'machine', '', []),
    ('Elevaciones frontales', 'Hombros', 'dumbbell', 'Agarre', ['Prono', 'Neutro']),
    ('Pájaros', 'Hombros', 'dumbbell', 'Posición', ['Inclinado de pie', 'Pecho apoyado en banco']),
    ('Deltoides posterior en máquina', 'Hombros', 'machine', '', []),
    ('Face pull', 'Hombros', 'machine', 'Agarre', ['Cuerda', 'Barra']),
    ('Remo al mentón', 'Hombros', 'plates', 'Agarre', ['Cerrado', 'Abierto']),
    # Bíceps
    ('Curl con barra', 'Bíceps', 'plates', 'Barra', ['Recta', 'Z']),
    ('Curl con mancuernas', 'Bíceps', 'dumbbell', 'Ejecución', ['Alterno', 'Simultáneo']),
    ('Curl martillo', 'Bíceps', 'dumbbell', 'Ejecución', ['Alterno', 'Simultáneo', 'Cruzado']),
    ('Curl predicador', 'Bíceps', 'plates', 'Material', ['Barra Z', 'Mancuerna', 'Máquina']),
    ('Curl en polea', 'Bíceps', 'machine', 'Agarre', ['Barra recta', 'Barra Z', 'Cuerda']),
    ('Curl concentrado', 'Bíceps', 'dumbbell', '', []),
    ('Curl inclinado con mancuernas', 'Bíceps', 'dumbbell', '', []),
    # Tríceps
    ('Extensión de tríceps en polea', 'Tríceps', 'machine', 'Agarre', ['Cuerda', 'Barra recta', 'Barra en V', 'A una mano']),
    ('Press francés', 'Tríceps', 'plates', 'Material', ['Barra Z', 'Barra recta', 'Mancuernas']),
    ('Extensión de tríceps sobre la cabeza', 'Tríceps', 'dumbbell', 'Ejecución', ['A dos manos', 'A una mano', 'En polea']),
    ('Press de banca agarre cerrado', 'Tríceps', 'plates', '', []),
    ('Fondos entre bancos', 'Tríceps', 'bodyweight', '', []),
    ('Patada de tríceps', 'Tríceps', 'dumbbell', 'Material', ['Mancuerna', 'Polea']),
    # Piernas
    ('Sentadilla', 'Cuádriceps', 'plates', 'Tipo', ['Barra alta', 'Barra baja', 'Frontal']),
    ('Sentadilla goblet', 'Cuádriceps', 'dumbbell', '', []),
    ('Sentadilla búlgara', 'Cuádriceps', 'dumbbell', 'Énfasis', ['Cuádriceps', 'Glúteo']),
    ('Prensa de piernas', 'Cuádriceps', 'machine', 'Posición de los pies', ['Media', 'Alta', 'Baja', 'Abierta']),
    ('Sentadilla hack', 'Cuádriceps', 'machine', '', []),
    ('Extensión de cuádriceps', 'Cuádriceps', 'machine', 'Ejecución', ['Bilateral', 'Unilateral']),
    ('Zancadas', 'Cuádriceps', 'dumbbell', 'Dirección', ['Hacia delante', 'Hacia atrás', 'Caminando']),
    ('Subida al cajón', 'Cuádriceps', 'dumbbell', '', []),
    ('Peso muerto rumano', 'Isquiotibiales', 'plates', 'Material', ['Barra', 'Mancuernas', 'Unilateral']),
    ('Curl femoral', 'Isquiotibiales', 'machine', 'Posición', ['Tumbado', 'Sentado', 'De pie']),
    ('Buenos días', 'Isquiotibiales', 'plates', '', []),
    ('Hip thrust', 'Glúteos', 'plates', 'Material', ['Barra', 'Máquina', 'Unilateral']),
    ('Puente de glúteo', 'Glúteos', 'bodyweight', '', []),
    ('Patada de glúteo en polea', 'Glúteos', 'machine', '', []),
    ('Abducción de cadera', 'Glúteos', 'machine', '', []),
    ('Aducción de cadera', 'Piernas', 'machine', '', []),
    ('Elevación de gemelos', 'Gemelos', 'machine', 'Posición', ['De pie', 'Sentado', 'En prensa']),
    # Abdominales
    ('Plancha', 'Abdominales', 'bodyweight', 'Tipo', ['Frontal', 'Lateral']),
    ('Crunch', 'Abdominales', 'bodyweight', 'Tipo', ['En el suelo', 'En polea', 'En máquina']),
    ('Elevación de piernas', 'Abdominales', 'bodyweight', 'Posición', ['Colgado', 'En paralelas', 'En el suelo']),
    ('Rueda abdominal', 'Abdominales', 'other', '', []),
    ('Giros rusos', 'Abdominales', 'bodyweight', '', []),
    ('Pallof press', 'Abdominales', 'machine', '', []),
    # Cuerpo completo
    ('Swing con kettlebell', 'Cuerpo completo', 'other', '', []),
    ('Thruster', 'Cuerpo completo', 'plates', 'Material', ['Barra', 'Mancuernas']),
    ('Paseo del granjero', 'Cuerpo completo', 'dumbbell', '', []),
    ('Burpees', 'Cuerpo completo', 'bodyweight', '', []),
]


def seed(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    for name, group, equipment, label, variants in CATALOG:
        existing = Exercise.objects.filter(name__iexact=name).order_by('id').first()
        values = {'muscle_group': group, 'equipment': equipment, 'variant_label': label, 'variants': variants, 'is_builtin': True}
        if existing:
            for key, value in values.items():
                setattr(existing, key, value)
            existing.save()
        else:
            Exercise.objects.create(name=name, **values)


def unseed(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    # Solo se borran los del catalogo que nadie usa; el resto vuelve a ser un ejercicio normal.
    for exercise in Exercise.objects.filter(is_builtin=True):
        used = exercise.routineexercise_set.exists() or exercise.workoutset_set.exists()
        if used:
            exercise.is_builtin = False
            exercise.save(update_fields=['is_builtin'])
        else:
            exercise.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0008_exercise_catalog_fields'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
