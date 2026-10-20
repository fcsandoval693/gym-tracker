from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from .models import Exercise, Routine, RoutineDay, RoutineExercise, WorkoutSession, WorkoutSet


class AuthAPITestCase(APITestCase):
    """Cada prueba se ejecuta con un usuario que ya ha iniciado sesion."""

    def _pre_setup(self):
        super()._pre_setup()
        self.user = get_user_model().objects.create_user(email='yo@example.com', password='clave-segura-123')
        self.client.force_authenticate(self.user)


class WorkoutFlowTests(AuthAPITestCase):
    def test_routine_unit_and_material_are_copied_and_series_keep_unit(self):
        planned = RoutineExercise.objects.get(routine_day=self.day)
        configured = self.client.patch(f'/api/routine-exercises/{planned.pk}/', {
            'weight_unit': 'lb', 'equipment': 'machine',
        }, format='json')
        self.assertEqual(configured.status_code, 200)
        session = self.start()
        response = self.client.get(f'/api/workout-sessions/{session}/')
        self.assertEqual(response.data['exercise_plan'][0]['weight_unit'], 'lb')
        self.assertEqual(response.data['exercise_plan'][0]['equipment'], 'machine')
        saved = self.client.post('/api/workout-sets/', {
            'workout_session': session, 'exercise': self.exercise.pk, 'weight': 100, 'reps': 10,
            'weight_unit': 'kg',
        }, format='json')
        self.assertEqual(saved.data['weight_unit'], 'lb')
        changed = self.client.post(f'/api/workout-sessions/{session}/edit_exercise/', {
            'current_exercise': self.exercise.pk, 'exercise': self.exercise.pk,
            'weight_unit': 'kg', 'equipment': 'dumbbell',
        }, format='json')
        self.assertEqual(changed.status_code, 200)
        old = self.client.get(f"/api/workout-sets/{saved.data['id']}/")
        self.assertEqual(old.data['weight_unit'], 'lb')
        new = self.client.post('/api/workout-sets/', {
            'workout_session': session, 'exercise': self.exercise.pk, 'weight': 20.5, 'reps': 8,
        }, format='json')
        self.assertEqual(new.data['weight_unit'], 'kg')
        planned.refresh_from_db()
        self.assertEqual(planned.weight_unit, 'lb')

    def test_create_exercise_during_session_and_rollback_invalid_request(self):
        session = self.start()
        endpoint = f'/api/workout-sessions/{session}/edit_exercise/'
        response = self.client.post(endpoint, {
            'current_exercise': self.exercise.pk,
            'new_exercise': {'name': 'Nuevo movimiento', 'muscle_group': 'Espalda'},
            'weight_unit': 'lb', 'equipment': 'plates',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        created = Exercise.objects.get(name='Nuevo movimiento')
        self.assertEqual(response.data['exercise_plan'][0]['id'], created.pk)
        self.assertEqual(RoutineExercise.objects.get(routine_day=self.day).exercise_id, self.exercise.pk)
        count = Exercise.objects.count()
        bad = self.client.post(endpoint, {
            'current_exercise': 999999, 'new_exercise': {'name': 'No debe crearse'},
        }, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(Exercise.objects.count(), count)
        both = self.client.post(endpoint, {
            'current_exercise': created.pk, 'exercise': created.pk,
            'new_exercise': {'name': 'Ambiguo'},
        }, format='json')
        self.assertEqual(both.status_code, 400)
        bad_unit = self.client.post(endpoint, {
            'current_exercise': created.pk, 'exercise': created.pk, 'weight_unit': 'ton',
        }, format='json')
        self.assertEqual(bad_unit.status_code, 400)

    def test_session_replacement_preserves_saved_series_and_template(self):
        session = self.start()
        replacement = Exercise.objects.create(user=self.user, name='Press inclinado', muscle_group='Pecho')
        saved = self.client.post('/api/workout-sets/', {
            'workout_session': session, 'exercise': self.exercise.pk, 'weight': 60, 'reps': 10,
        }, format='json')
        changed = self.client.post(f'/api/workout-sessions/{session}/edit_exercise/', {
            'current_exercise': self.exercise.pk, 'exercise': replacement.pk,
        }, format='json')
        self.assertEqual(changed.status_code, 200)
        self.assertTrue(changed.data['exercise_plan'][0]['completed'])
        self.assertEqual(changed.data['exercise_plan'][1]['id'], replacement.pk)
        self.assertEqual(RoutineExercise.objects.get(routine_day=self.day).exercise_id, self.exercise.pk)
        record = self.client.get(f"/api/workout-sets/{saved.data['id']}/")
        self.assertEqual(record.data['exercise_snapshot'], self.exercise.pk)
        self.assertEqual(record.data['exercise_name'], 'Press banca')
        self.assertEqual(self.client.post('/api/workout-sets/', {
            'workout_session': session, 'exercise': self.exercise.pk, 'weight': 30, 'reps': 5,
        }, format='json').status_code, 400)
        duplicate = self.client.post(f'/api/workout-sessions/{session}/edit_exercise/', {
            'current_exercise': replacement.pk, 'exercise': self.exercise.pk,
        }, format='json')
        self.assertEqual(duplicate.status_code, 400)

    def test_replace_before_sets_and_edit_session_name(self):
        session = self.start()
        replacement = Exercise.objects.create(user=self.user, name='Press militar', muscle_group='Hombros')
        changed = self.client.post(f'/api/workout-sessions/{session}/edit_exercise/', {
            'current_exercise': self.exercise.pk, 'exercise': replacement.pk,
            'name': 'Press con mancuernas', 'muscle_group': 'Hombros',
        }, format='json')
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(len(changed.data['exercise_plan']), 1)
        self.assertEqual(changed.data['exercise_plan'][0]['name'], 'Press con mancuernas')
        replacement.refresh_from_db()
        self.assertEqual(replacement.name, 'Press militar')

    def test_complete_reopen_and_lock_session_exercises(self):
        session = self.start()
        url = f'/api/workout-sessions/{session}/complete_exercise/'
        self.assertEqual(self.client.post(url, {'exercise': self.exercise.pk}, format='json').status_code, 400)
        saved = self.client.post('/api/workout-sets/', {
            'workout_session': session, 'exercise': self.exercise.pk, 'weight': 62.5, 'reps': 8,
        }, format='json')
        done = self.client.post(url, {'exercise': self.exercise.pk}, format='json')
        self.assertTrue(done.data['exercise_plan'][0]['completed'])
        self.assertEqual(self.client.delete(f"/api/workout-sets/{saved.data['id']}/").status_code, 400)
        reopened = self.client.post(url, {'exercise': self.exercise.pk, 'completed': False}, format='json')
        self.assertFalse(reopened.data['exercise_plan'][0]['completed'])
        self.assertEqual(self.client.patch(f"/api/workout-sets/{saved.data['id']}/", {'weight': 65}, format='json').status_code, 200)
        self.client.post(f'/api/workout-sessions/{session}/finish/', {}, format='json')
        self.assertEqual(self.client.post(url, {'exercise': self.exercise.pk}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/workout-sessions/{session}/edit_exercise/', {
            'current_exercise': self.exercise.pk, 'exercise': self.exercise.pk, 'name': 'Cambio',
        }, format='json').status_code, 400)

    def setUp(self):
        self.routine = Routine.objects.create(user=self.user, name='Push Pull Legs')
        self.day = RoutineDay.objects.create(name='Push', routine=self.routine, weekdays=[0, 3])
        self.exercise = Exercise.objects.create(user=self.user, name='Press banca', muscle_group='Pecho')
        RoutineExercise.objects.create(routine_day=self.day, exercise=self.exercise, position=0)

    def start(self):
        response = self.client.post('/api/workout-sessions/', {'routine_day': self.day.pk}, format='json')
        self.assertEqual(response.status_code, 201)
        return response.data['id']

    def test_start_save_finish_and_resume(self):
        session = self.start()
        response = self.client.get(f'/api/workout-sessions/{session}/')
        self.assertEqual(response.data['status'], 'active')
        self.assertEqual(response.data['exercise_plan'][0]['name'], 'Press banca')
        self.assertEqual(response.data['routine_name'], self.routine.name)
        saved = self.client.post('/api/workout-sets/', {
            'workout_session': session, 'exercise': self.exercise.pk, 'weight': 60.5, 'reps': 10,
        }, format='json')
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(len(self.client.get(f'/api/workout-sets/?workout_session={session}').data), 1)
        finished = self.client.post(f'/api/workout-sessions/{session}/finish/', {}, format='json')
        self.assertEqual(finished.status_code, 200)
        self.assertEqual(finished.data['status'], 'completed')
        repeated = self.client.post(f'/api/workout-sessions/{session}/finish/', {}, format='json')
        self.assertEqual(repeated.data['end_time'], finished.data['end_time'])
        self.assertEqual(self.client.patch(f"/api/workout-sets/{saved.data['id']}/", {'weight': 90}, format='json').status_code, 400)
        self.assertEqual(self.client.delete(f"/api/workout-sets/{saved.data['id']}/").status_code, 400)
        self.assertEqual(self.client.post('/api/workout-sets/', {
            'workout_session': session, 'exercise': self.exercise.pk, 'weight': 20, 'reps': 5,
        }, format='json').status_code, 400)

    def test_reject_empty_day_and_empty_finish(self):
        day = RoutineDay.objects.create(name='Pull', routine=self.routine)
        self.assertEqual(self.client.post('/api/workout-sessions/', {'routine_day': day.pk}, format='json').status_code, 400)
        session = self.start()
        self.assertEqual(self.client.post(f'/api/workout-sessions/{session}/finish/', {}, format='json').status_code, 400)

    def test_invalid_sets_and_other_session(self):
        session = self.start()
        second = self.start()
        other = Exercise.objects.create(user=self.user, name='Remo')
        data = {'workout_session': session, 'exercise': self.exercise.pk, 'weight': -1, 'reps': 0}
        self.assertEqual(self.client.post('/api/workout-sets/', data, format='json').status_code, 400)
        data.update(weight=10, reps=5, exercise=other.pk)
        self.assertEqual(self.client.post('/api/workout-sets/', data, format='json').status_code, 400)
        data['exercise'] = self.exercise.pk
        saved = self.client.post('/api/workout-sets/', data, format='json')
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(self.client.patch(f"/api/workout-sets/{saved.data['id']}/", {'workout_session': second}, format='json').status_code, 400)

    def test_calendar_validation_and_filtering(self):
        response = self.client.post('/api/routine-days/', {'routine': self.routine.pk, 'name': 'Pull', 'weekdays': [0]}, format='json')
        self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/routine-days/', {'routine': self.routine.pk, 'name': 'Pull', 'weekdays': [1, 4]}, format='json')
        self.assertEqual(response.status_code, 201)
        for values in ([8], [1, 1]):
            self.assertEqual(self.client.patch(f"/api/routine-days/{response.data['id']}/", {'weekdays': values}, format='json').status_code, 400)
        another = Routine.objects.create(user=self.user, name='Otra')
        RoutineDay.objects.create(name='Full body', routine=another)
        self.assertEqual(len(self.client.get(f'/api/routine-days/?routine={self.routine.pk}').data), 2)

    def test_snapshot_survives_template_deletion(self):
        session = self.start()
        self.exercise.name = 'Nombre nuevo'
        self.exercise.save()
        self.day.delete()
        record = WorkoutSession.objects.get(pk=session)
        self.assertIsNone(record.routine_day)
        self.assertEqual(record.day_name, 'Push')
        self.assertEqual(record.exercise_plan[0]['name'], 'Press banca')

    def test_saved_series_survives_exercise_deletion(self):
        session = self.start()
        saved = self.client.post('/api/workout-sets/', {
            'workout_session': session, 'exercise': self.exercise.pk, 'weight': 60, 'reps': 10,
        }, format='json')
        exercise_id = self.exercise.pk
        self.exercise.delete()
        response = self.client.get(f"/api/workout-sets/{saved.data['id']}/")
        self.assertIsNone(response.data['exercise'])
        self.assertEqual(response.data['exercise_snapshot'], exercise_id)
        self.assertEqual(response.data['exercise_name'], 'Press banca')
        self.assertEqual(self.client.post(f'/api/workout-sessions/{session}/finish/', {}, format='json').status_code, 200)


class ExerciseCatalogTests(AuthAPITestCase):

    def setUp(self):
        self.routine = Routine.objects.create(user=self.user, name='Push Pull Legs')
        self.day = RoutineDay.objects.create(name='Pull', routine=self.routine, weekdays=[1])

    def test_catalog_is_seeded_with_variants(self):
        rows = self.client.get('/api/exercises/').data
        builtin = [row for row in rows if row['is_builtin']]
        self.assertGreater(len(builtin), 50)
        row = next(row for row in builtin if row['name'] == 'Remo con barra')
        self.assertEqual(row['equipment'], 'plates')
        self.assertEqual(row['variant_label'], 'Agarre')
        self.assertIn('Supino', row['variants'])

    def test_builtin_exercises_cannot_be_changed_or_deleted(self):
        builtin = Exercise.objects.filter(is_builtin=True).first()
        response = self.client.patch(f'/api/exercises/{builtin.pk}/', {'name': 'Otro'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.delete(f'/api/exercises/{builtin.pk}/').status_code, 403)
        self.assertTrue(Exercise.objects.filter(pk=builtin.pk, name=builtin.name).exists())

    def test_user_can_create_edit_and_delete_own_exercise(self):
        created = self.client.post('/api/exercises/', {'name': 'Mi ejercicio', 'muscle_group': 'Espalda', 'equipment': 'machine', 'is_builtin': True}, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertFalse(created.data['is_builtin'])
        self.assertEqual(self.client.patch(f"/api/exercises/{created.data['id']}/", {'name': 'Renombrado'}, format='json').status_code, 200)
        self.assertEqual(self.client.delete(f"/api/exercises/{created.data['id']}/").status_code, 204)

    def test_variant_is_validated_and_copied_to_session(self):
        row = Exercise.objects.get(name='Remo con barra', is_builtin=True)
        bad = self.client.post('/api/routine-exercises/', {'routine_day': self.day.pk, 'exercise': row.pk, 'position': 0, 'variant': 'Inventada'}, format='json')
        self.assertEqual(bad.status_code, 400)
        good = self.client.post('/api/routine-exercises/', {'routine_day': self.day.pk, 'exercise': row.pk, 'position': 0, 'variant': 'Supino', 'equipment': 'plates'}, format='json')
        self.assertEqual(good.status_code, 201)
        session = self.client.post('/api/workout-sessions/', {'routine_day': self.day.pk}, format='json')
        self.assertEqual(session.data['exercise_plan'][0]['name'], 'Remo con barra · Supino')
        self.assertEqual(session.data['exercise_plan'][0]['variant'], 'Supino')

    def test_targets_are_validated_and_copied_to_session(self):
        row = Exercise.objects.get(name='Remo con barra', is_builtin=True)
        url = '/api/routine-exercises/'
        bad = self.client.post(url, {'routine_day': self.day.pk, 'exercise': row.pk, 'position': 0, 'rep_min': 12, 'rep_max': 8}, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertIn('rep_max', bad.data)
        too_many = self.client.post(url, {'routine_day': self.day.pk, 'exercise': row.pk, 'position': 0, 'target_sets': 11}, format='json')
        self.assertEqual(too_many.status_code, 400)
        good = self.client.post(url, {'routine_day': self.day.pk, 'exercise': row.pk, 'position': 0, 'target_sets': 4, 'rep_min': 6, 'rep_max': 10}, format='json')
        self.assertEqual(good.status_code, 201)
        self.assertEqual((good.data['target_sets'], good.data['rep_min'], good.data['rep_max']), (4, 6, 10))
        session = self.client.post('/api/workout-sessions/', {'routine_day': self.day.pk}, format='json')
        plan = session.data['exercise_plan'][0]
        self.assertEqual((plan['target_sets'], plan['rep_min'], plan['rep_max']), (4, 6, 10))
        # Cambiar la rutina después no modifica la sesión ya empezada.
        self.client.patch(f"{url}{good.data['id']}/", {'target_sets': 2}, format='json')
        again = self.client.get(f"/api/workout-sessions/{session.data['id']}/")
        self.assertEqual(again.data['exercise_plan'][0]['target_sets'], 4)


class SessionRemoveExerciseTests(AuthAPITestCase):

    def setUp(self):
        routine = Routine.objects.create(user=self.user, name='Push Pull Legs')
        self.day = RoutineDay.objects.create(name='Push', routine=routine, weekdays=[0])
        self.press = Exercise.objects.create(user=self.user, name='Press A', muscle_group='Pecho')
        self.dips = Exercise.objects.create(user=self.user, name='Fondos A', muscle_group='Tríceps')
        RoutineExercise.objects.create(routine_day=self.day, exercise=self.press, position=0)
        RoutineExercise.objects.create(routine_day=self.day, exercise=self.dips, position=1)
        self.session = self.client.post('/api/workout-sessions/', {'routine_day': self.day.pk}, format='json').data['id']

    def remove(self, exercise):
        return self.client.post(f'/api/workout-sessions/{self.session}/remove_exercise/', {'exercise': exercise.pk}, format='json')

    def test_remove_only_from_today_session(self):
        response = self.remove(self.dips)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data['exercise_plan']], [self.press.pk])
        self.assertEqual(RoutineExercise.objects.filter(routine_day=self.day).count(), 2)

    def test_cannot_remove_exercise_with_sets_or_the_last_one(self):
        self.client.post('/api/workout-sets/', {'workout_session': self.session, 'exercise': self.press.pk, 'weight': 50, 'reps': 8}, format='json')
        self.assertEqual(self.remove(self.press).status_code, 400)
        self.assertEqual(self.remove(self.dips).status_code, 200)
        self.client.delete(f"/api/workout-sets/{WorkoutSet.objects.get(workout_session=self.session).pk}/")
        self.assertEqual(self.remove(self.press).status_code, 400)


class AuthAndOwnershipTests(APITestCase):
    def setUp(self):
        # El límite de intentos se guarda en la caché: se vacía para que cada prueba empiece de cero.
        cache.clear()

    def test_too_many_login_attempts_are_blocked(self):
        self.client.post('/api/auth/register/', {'email': 't@example.com', 'password': 'entrena-fuerte-26'}, format='json')
        codes = [self.client.post('/api/auth/login/', {'email': 't@example.com', 'password': 'mala'}, format='json').status_code for _ in range(10)]
        self.assertEqual(codes[-1], 429)  # 429 = "demasiadas peticiones"

    def test_register_login_me_and_logout(self):
        created = self.client.post('/api/auth/register/', {'email': 'Nuevo@Example.com', 'password': 'una-clave-larga-9', 'first_name': 'Ana'}, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['user']['email'], 'nuevo@example.com')
        self.assertEqual(self.client.post('/api/auth/register/', {'email': 'nuevo@example.com', 'password': 'una-clave-larga-9'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login/', {'email': 'nuevo@example.com', 'password': 'mal'}, format='json').status_code, 400)
        login = self.client.post('/api/auth/login/', {'email': 'nuevo@example.com', 'password': 'una-clave-larga-9'}, format='json')
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + login.data['token'])
        self.assertEqual(self.client.get('/api/auth/me/').data['first_name'], 'Ana')
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_weak_password_is_rejected(self):
        response = self.client.post('/api/auth/register/', {'email': 'a@example.com', 'password': '12345678'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_update_name_but_not_email(self):
        token = self.client.post('/api/auth/register/', {'email': 'n@example.com', 'password': 'entrena-fuerte-26', 'first_name': 'Fran'}, format='json').data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        response = self.client.patch('/api/auth/me/', {'first_name': '  Fernando ', 'email': 'otro@example.com'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.data['first_name'], response.data['email']), ('Fernando', 'n@example.com'))

    def test_change_password(self):
        old = self.client.post('/api/auth/register/', {'email': 'p@example.com', 'password': 'entrena-fuerte-26'}, format='json').data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {old}')
        url = '/api/auth/change-password/'
        self.assertEqual(self.client.post(url, {'current_password': 'mal', 'new_password': 'otra-clave-larga-9'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'current_password': 'entrena-fuerte-26', 'new_password': '12345678'}, format='json').status_code, 400)
        response = self.client.post(url, {'current_password': 'entrena-fuerte-26', 'new_password': 'otra-clave-larga-9'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data['token'], old)
        # El token antiguo deja de valer y la nueva contraseña sirve para entrar.
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.client.credentials()
        login = self.client.post('/api/auth/login/', {'email': 'p@example.com', 'password': 'otra-clave-larga-9'}, format='json')
        self.assertEqual(login.status_code, 200)

    def test_api_requires_login(self):
        self.assertEqual(self.client.get('/api/routines/').status_code, 401)

    def test_users_only_see_and_use_their_own_data(self):
        User = get_user_model()
        ana = User.objects.create_user(email='ana@example.com', password='clave-segura-123')
        luis = User.objects.create_user(email='luis@example.com', password='clave-segura-123')
        routine = Routine.objects.create(user=ana, name='Rutina de Ana')
        own = Exercise.objects.create(user=ana, name='Ejercicio de Ana')
        self.client.force_authenticate(luis)
        self.assertEqual(self.client.get('/api/routines/').data, [])
        self.assertEqual(self.client.get(f'/api/routines/{routine.pk}/').status_code, 404)
        ids = [row['id'] for row in self.client.get('/api/exercises/').data]
        self.assertNotIn(own.pk, ids)
        self.assertTrue(len(ids) > 50)  # sigue viendo el catalogo
        bad = self.client.post('/api/routine-days/', {'routine': routine.pk, 'name': 'Intruso'}, format='json')
        self.assertEqual(bad.status_code, 400)
        mine = self.client.post('/api/routines/', {'name': 'Rutina de Luis'}, format='json')
        self.assertEqual(Routine.objects.get(pk=mine.data['id']).user, luis)


class SeedAndClaimCommandTests(APITestCase):

    def test_claim_and_seed_history(self):
        user = get_user_model().objects.create_user(email='yo@example.com', password='clave-segura-123')
        routine = Routine.objects.create(name='Push Pull Legs')
        push = RoutineDay.objects.create(routine=routine, name='Push', weekdays=[0, 3])
        bench = Exercise.objects.get(name='Press de banca', is_builtin=True)
        RoutineExercise.objects.create(routine_day=push, exercise=bench, position=0, equipment='plates')
        call_command('claim_data', 'yo@example.com', verbosity=0)
        routine.refresh_from_db()
        self.assertEqual(routine.user, user)
        call_command('seed_history', 'yo@example.com', '--weeks', '4', verbosity=0)
        generated = WorkoutSession.objects.filter(user=user, generated=True)
        self.assertTrue(4 <= generated.count() <= 8)
        self.assertTrue(WorkoutSet.objects.filter(workout_session__in=generated).exists())
        call_command('seed_history', 'yo@example.com', '--clear', verbosity=0)
        self.assertFalse(WorkoutSession.objects.filter(generated=True).exists())
