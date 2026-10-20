"""Asigna a un usuario los datos que se crearon antes de que existiera el login.

Uso: python manage.py claim_data tu@email.com
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from workouts.models import Exercise, Routine, WorkoutSession


class Command(BaseCommand):
    help = 'Asigna a un usuario las rutinas, sesiones y ejercicios propios que no tienen dueño.'

    def add_arguments(self, parser):
        parser.add_argument('email')

    def handle(self, *args, **options):
        try:
            user = get_user_model().objects.get(email__iexact=options['email'])
        except get_user_model().DoesNotExist:
            raise CommandError('No existe ningún usuario con ese email. Regístrate primero en la app.')
        routines = Routine.objects.filter(user__isnull=True).update(user=user)
        sessions = WorkoutSession.objects.filter(user__isnull=True).update(user=user)
        exercises = Exercise.objects.filter(user__isnull=True, is_builtin=False).update(user=user)
        self.stdout.write(self.style.SUCCESS(
            f'Asignados a {user.email}: {routines} rutinas, {sessions} sesiones y {exercises} ejercicios propios.'))
