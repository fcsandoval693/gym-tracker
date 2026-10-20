"""Genera un historial de ejemplo (por defecto 12 semanas) a partir de tus entrenamientos reales.

Uso:
    python manage.py seed_history tu@email.com            # 12 semanas
    python manage.py seed_history tu@email.com --weeks 8  # otro número de semanas
    python manage.py seed_history tu@email.com --clear    # borra solo lo generado

Cómo funciona:
- Toma como punto de partida tu última sesión real de cada entrenamiento (Push, Pull...).
  Si un entrenamiento no tiene sesiones, usa sus ejercicios con pesos orientativos según el material.
- Crea sesiones hacia atrás, antes de tu primera sesión real, en los días de la semana
  de tu rutina. Cuanto más atrás, algo menos de peso: así se ve una progresión.
- Las sesiones creadas quedan marcadas (generated=True) y nunca se mezclan con las reales:
  volver a ejecutar el comando reemplaza las generadas y --clear las borra.
"""
import random
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from workouts.models import Exercise, RoutineDay, RoutineExercise, WorkoutSession, WorkoutSet

# Series de partida cuando un entrenamiento todavía no tiene ninguna sesión real.
DEFAULT_SETS = {
    'plates': [(40, 8)] * 4,
    'machine': [(35, 10)] * 3,
    'dumbbell': [(12, 10)] * 3,
    'bodyweight': [(0, 10)] * 3,
    'other': [(20, 10)] * 3,
}
# Cuánto peso se quita cada dos semanas hacia atrás (en kg; en libras se duplica).
STEP = {'plates': 2.5, 'machine': 2.5, 'dumbbell': 1, 'bodyweight': 0, 'other': 2.5}


def round_to(value, step):
    return round(round(value / step) * step, 2) if step else value


class Command(BaseCommand):
    help = 'Genera semanas de historial de ejemplo basadas en tus sesiones reales.'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--weeks', type=int, default=12)
        parser.add_argument('--clear', action='store_true', help='Solo borra las sesiones generadas.')
        parser.add_argument('--seed', type=int, default=7, help='Semilla para que el resultado sea repetible.')

    def handle(self, *args, **options):
        try:
            user = get_user_model().objects.get(email__iexact=options['email'])
        except get_user_model().DoesNotExist:
            raise CommandError('No existe ningún usuario con ese email.')

        with transaction.atomic():
            removed, _ = WorkoutSession.objects.filter(user=user, generated=True).delete()
            if options['clear']:
                self.stdout.write(self.style.SUCCESS(f'Borradas las sesiones generadas ({removed} objetos).'))
                return
            created_sessions, created_sets = self.generate(user, options['weeks'], random.Random(options['seed']))

        self.stdout.write(self.style.SUCCESS(
            f'Creadas {created_sessions} sesiones y {created_sets} series de ejemplo para {user.email}.'))

    def generate(self, user, weeks, rng):
        days = list(RoutineDay.objects.filter(routine__user=user).select_related('routine').order_by('id'))
        if not days:
            raise CommandError('Este usuario no tiene entrenamientos. Crea una rutina (por ejemplo Push, Pull, Legs) primero.')

        # Qué entrenamiento toca cada día de la semana (0 = lunes).
        schedule = {weekday: day for day in days for weekday in day.weekdays}
        if not schedule:  # Sin días asignados: se reparten en lunes, miércoles y viernes.
            schedule = {weekday: days[index % len(days)] for index, weekday in enumerate([0, 2, 4])}

        templates = {day.id: self.template(user, day) for day in set(schedule.values())}
        real = WorkoutSession.objects.filter(user=user, generated=False).order_by('start_time').first()
        end = timezone.localdate(real.start_time) if real else timezone.localdate()
        start = end - timedelta(weeks=weeks)

        sessions = sets = 0
        date = start
        while date < end:
            day = schedule.get(date.weekday())
            template = templates.get(day.id) if day else None
            if template and template['plan'] and rng.random() > 0.1:  # ~1 de cada 10 sesiones se "salta"
                weeks_back = (end - date).days // 7
                sets += self.create_session(user, day, date, template, weeks_back, rng)
                sessions += 1
            date += timedelta(days=1)
        return sessions, sets

    def template(self, user, day):
        """Plan y series de referencia de un entrenamiento: su última sesión real o valores orientativos."""
        last = (WorkoutSession.objects.filter(user=user, routine_day=day, generated=False, end_time__isnull=False)
                .order_by('-start_time').first())
        if last and last.exercise_plan:
            done = list(last.workoutset_set.order_by('id'))
            plan, series = [], {}
            for item in last.exercise_plan:
                rows = [(s.weight, s.reps) for s in done if s.exercise_snapshot == item['id']]
                if rows:
                    plan.append({**item, 'completed': True})
                    series[item['id']] = rows
            if plan:
                return {'plan': plan, 'series': series}
        plan, series = [], {}
        for item in RoutineExercise.objects.filter(routine_day=day, exercise__isnull=False).select_related('exercise').order_by('position', 'id'):
            name = f'{item.exercise.name} · {item.variant}' if item.variant else item.exercise.name
            plan.append({'id': item.exercise_id, 'name': name, 'muscle_group': item.exercise.muscle_group,
                         'weight_unit': item.weight_unit, 'equipment': item.equipment, 'variant': item.variant, 'completed': True})
            series[item.exercise_id] = DEFAULT_SETS.get(item.equipment, DEFAULT_SETS['other'])
        return {'plan': plan, 'series': series}

    def create_session(self, user, day, date, template, weeks_back, rng):
        start = timezone.make_aware(datetime.combine(date, time(17, 0)) + timedelta(minutes=rng.randint(0, 120)))
        total_sets = sum(len(rows) for rows in template['series'].values())
        session = WorkoutSession.objects.create(
            user=user, routine_day=day, generated=True, routine_name=day.routine.name, day_name=day.name,
            start_time=start, end_time=start + timedelta(minutes=30 + total_sets * 2 + rng.randint(-5, 10)),
            exercise_plan=template['plan'],
        )
        exercises = {e.pk: e for e in Exercise.objects.filter(pk__in=[item['id'] for item in template['plan']])}
        rows = []
        for item in template['plan']:
            equipment = item.get('equipment', 'other')
            unit = item.get('weight_unit', 'kg')
            step = STEP.get(equipment, 2.5) * (2 if unit == 'lb' else 1)
            for index, (weight, reps) in enumerate(template['series'][item['id']]):
                if weight > 0:
                    # Cada dos semanas hacia atrás, un escalón menos de peso (sin bajar de la mitad).
                    weight = max(round_to(weight - step * (weeks_back // 2), step), round_to(weight * 0.5, step) or step)
                    reps = reps + (weeks_back % 2)
                else:
                    reps = max(3, reps - weeks_back // 2)
                if index == len(template['series'][item['id']]) - 1 and rng.random() < 0.3:
                    reps = max(3, reps - 1)  # La última serie a veces sale peor.
                rows.append(WorkoutSet(workout_session=session, exercise=exercises.get(item['id']), exercise_snapshot=item['id'],
                                       exercise_name=item['name'], weight=weight, reps=reps, weight_unit=unit))
        WorkoutSet.objects.bulk_create(rows)
        return len(rows)
