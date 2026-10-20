from django.db import migrations


def backfill(apps, schema_editor):
    Session = apps.get_model('workouts', 'WorkoutSession')
    Planned = apps.get_model('workouts', 'RoutineExercise')
    Set = apps.get_model('workouts', 'WorkoutSet')
    alias = schema_editor.connection.alias
    for session in Session.objects.using(alias).select_related('routine_day__routine').iterator():
        if session.exercise_plan:
            continue
        plan = {}
        if session.routine_day_id:
            session.routine_name = session.routine_day.routine.name
            session.day_name = session.routine_day.name
            for item in Planned.objects.using(alias).filter(routine_day_id=session.routine_day_id).select_related('exercise').order_by('position', 'id'):
                if item.exercise:
                    plan[item.exercise_id] = {'id': item.exercise_id, 'name': item.exercise.name, 'muscle_group': item.exercise.muscle_group}
        for item in Set.objects.using(alias).filter(workout_session_id=session.pk).select_related('exercise'):
            if item.exercise:
                plan.setdefault(item.exercise_id, {'id': item.exercise_id, 'name': item.exercise.name, 'muscle_group': item.exercise.muscle_group})
        session.exercise_plan = list(plan.values())
        session.save(using=alias, update_fields=['routine_name', 'day_name', 'exercise_plan'])
    for item in Set.objects.using(alias).filter(exercise_snapshot__isnull=True).select_related('exercise').iterator():
        if item.exercise:
            item.exercise_snapshot = item.exercise_id
            item.exercise_name = item.exercise.name
            item.save(using=alias, update_fields=['exercise_snapshot', 'exercise_name'])


class Migration(migrations.Migration):
    dependencies = [('workouts', '0005_workoutset_exercise_name_and_more')]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
