from django.conf import settings
from django.db import models
from django.utils import timezone

WEIGHT_UNITS = [('kg', 'Kilogramos'), ('lb', 'Libras')]
EQUIPMENT_CHOICES = [('dumbbell', 'Mancuernas'), ('plates', 'Barra y discos'),
                     ('machine', 'Máquina'), ('bodyweight', 'Peso corporal'), ('other', 'Otro')]

class Exercise(models.Model):
    # Dueño del ejercicio propio. Los del catálogo (is_builtin) no tienen dueño: son de todos.
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100)
    muscle_group = models.CharField(max_length=100, blank=True)
    # Los ejercicios del catálogo vienen de serie: el usuario los usa pero no los edita ni los borra.
    is_builtin = models.BooleanField(default=False)
    equipment = models.CharField(max_length=12, choices=EQUIPMENT_CHOICES, default='other')
    # Variantes del ejercicio (agarre, inclinación...). variant_label dice qué tipo de variante son.
    variant_label = models.CharField(max_length=40, blank=True)
    variants = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name

class Routine(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100)

class RoutineDay(models.Model):
    name = models.CharField(max_length=100)
    weekdays = models.JSONField(default=list, blank=True)
    routine = models.ForeignKey(
        Routine, 
        on_delete=models.CASCADE,
    )

class RoutineExercise(models.Model):
    weight_unit = models.CharField(max_length=2, choices=WEIGHT_UNITS, default='kg')
    equipment = models.CharField(max_length=12, choices=EQUIPMENT_CHOICES, default='other')
    variant = models.CharField(max_length=60, blank=True)
    # Objetivo del ejercicio en la rutina: cuántas series y en qué rango de repeticiones.
    # Ejemplo: 4 series de 8 a 10 reps. Cuando llegas a 10 en todas, toca subir peso.
    target_sets = models.PositiveSmallIntegerField(default=3)
    rep_min = models.PositiveSmallIntegerField(default=8)
    rep_max = models.PositiveSmallIntegerField(default=12)

    routine_day = models.ForeignKey(
        RoutineDay,
        on_delete=models.SET_NULL,
        null=True
    )
    exercise = models.ForeignKey(
            Exercise,
            on_delete=models.SET_NULL,
            null=True
        )
    position = models.PositiveIntegerField()

class WorkoutSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    # Sesiones creadas por el comando seed_history (datos de ejemplo); se pueden borrar con --clear.
    generated = models.BooleanField(default=False)

    routine_day = models.ForeignKey(
        RoutineDay,
        on_delete=models.SET_NULL,
        null=True
    )
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    routine_name = models.CharField(max_length=100, blank=True)
    day_name = models.CharField(max_length=100, blank=True)
    exercise_plan = models.JSONField(default=list, blank=True)



class WorkoutSet(models.Model):
    weight_unit = models.CharField(max_length=2, choices=WEIGHT_UNITS, default='kg')
    exercise_snapshot = models.PositiveIntegerField(null=True, blank=True)
    exercise_name = models.CharField(max_length=100, blank=True)

    exercise = models.ForeignKey(
        Exercise,
        on_delete=models.SET_NULL,
        null=True
    )  
    workout_session = models.ForeignKey(
        WorkoutSession,
        on_delete=models.CASCADE,
    )
    weight = models.FloatField() 
    reps = models.IntegerField()
