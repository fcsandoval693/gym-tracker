from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from .models import Exercise, Routine, RoutineDay, RoutineExercise, WorkoutSession, WorkoutSet
from .serializers import ExerciseSerializer, RoutineSerializer, RoutineDaySerializer, RoutineExerciseSerializer, WorkoutSessionSerializer, WorkoutSetSerializer
from .session_serializers import SessionExerciseEditSerializer, SessionExerciseCompleteSerializer


# Cada usuario solo ve y toca sus propios datos (mas el catalogo de ejercicios, que es comun).
class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer

    def get_queryset(self):
        return Exercise.objects.filter(Q(is_builtin=True) | Q(user=self.request.user)).order_by('id')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # Los ejercicios del catalogo son de la app: se pueden usar, pero no cambiar ni borrar.
    def perform_update(self, serializer):
        if serializer.instance.is_builtin:
            raise PermissionDenied('Los ejercicios del catálogo no se pueden editar. Crea uno propio si necesitas otro.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_builtin:
            raise PermissionDenied('Los ejercicios del catálogo no se pueden borrar.')
        instance.delete()


class RoutineViewSet(viewsets.ModelViewSet):
    serializer_class = RoutineSerializer

    def get_queryset(self):
        return Routine.objects.filter(user=self.request.user).order_by('id')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RoutineDayViewSet(viewsets.ModelViewSet):
    serializer_class = RoutineDaySerializer

    def get_queryset(self):
        queryset = RoutineDay.objects.filter(routine__user=self.request.user).order_by('id')
        routine = self.request.query_params.get('routine')
        return queryset.filter(routine_id=routine) if routine else queryset

    def _save(self, serializer):
        routine = serializer.validated_data.get('routine', getattr(serializer.instance, 'routine', None))
        # Serializa cambios del calendario de una misma rutina.
        with transaction.atomic():
            Routine.objects.select_for_update().get(pk=routine.pk)
            serializer.validate(serializer.validated_data)
            serializer.save()

    def perform_create(self, serializer):
        self._save(serializer)

    def perform_update(self, serializer):
        self._save(serializer)


class RoutineExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = RoutineExerciseSerializer

    def get_queryset(self):
        queryset = RoutineExercise.objects.filter(routine_day__routine__user=self.request.user).order_by('position', 'id')
        day = self.request.query_params.get('routine_day')
        return queryset.filter(routine_day_id=day) if day else queryset


class WorkoutSessionViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSessionSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return WorkoutSession.objects.filter(user=self.request.user).order_by('-start_time', '-id')

    def perform_create(self, serializer):
        day = serializer.validated_data['routine_day']
        with transaction.atomic():
            RoutineDay.objects.select_for_update().get(pk=day.pk)
            plan = list(RoutineExercise.objects.filter(routine_day=day, exercise__isnull=False)
                        .order_by('position', 'id').values('exercise__id', 'exercise__name', 'exercise__muscle_group', 'weight_unit', 'equipment', 'variant', 'target_sets', 'rep_min', 'rep_max'))
            if not plan:
                raise ValidationError('Añade ejercicios a este día antes de empezar.')
            serializer.save(user=self.request.user, routine_name=day.routine.name, day_name=day.name, exercise_plan=[
                {'id': item['exercise__id'],
                 'name': f"{item['exercise__name']} · {item['variant']}" if item['variant'] else item['exercise__name'],
                 'muscle_group': item['exercise__muscle_group'],
                 'weight_unit': item['weight_unit'], 'equipment': item['equipment'], 'variant': item['variant'],
                 # El objetivo se copia en la sesión: si luego cambias la rutina, esta sesión no cambia.
                 'target_sets': item['target_sets'], 'rep_min': item['rep_min'], 'rep_max': item['rep_max']}
                for item in plan
            ])

    @action(detail=True, methods=['post'])
    def edit_exercise(self, request, pk=None):
        payload = SessionExerciseEditSerializer(data=request.data, context={'request': request})
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        with transaction.atomic():
            session = self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            if session.end_time:
                raise ValidationError('La sesión ya ha finalizado.')
            plan = list(session.exercise_plan)
            index = next((i for i, item in enumerate(plan) if item['id'] == data['current_exercise']), None)
            if index is None:
                raise ValidationError('El ejercicio no pertenece a esta sesión.')
            exercise = data.get('exercise')
            if exercise is None:
                exercise = Exercise.objects.create(user=request.user, **data['new_exercise'])
            replacing = exercise.pk != data['current_exercise']
            if replacing and any(item['id'] == exercise.pk for item in plan):
                raise ValidationError('Este ejercicio ya está en la sesión.')
            updated = {'id': exercise.pk, 'name': data.get('name', exercise.name),
                       'muscle_group': data.get('muscle_group', exercise.muscle_group),
                       'weight_unit': data.get('weight_unit', plan[index].get('weight_unit', 'kg')),
                       'equipment': data.get('equipment', plan[index].get('equipment', 'other')),
                       'completed': False}
            # Si cambias un ejercicio por otro, el nuevo hereda el objetivo de series y repeticiones.
            for key in ('target_sets', 'rep_min', 'rep_max'):
                if key in plan[index]:
                    updated[key] = plan[index][key]
            if replacing and session.workoutset_set.filter(exercise_snapshot=data['current_exercise']).exists():
                plan[index] = {**plan[index], 'completed': True}
                plan.insert(index + 1, updated)
            else:
                updated['completed'] = False if replacing else plan[index].get('completed', False)
                plan[index] = updated
            session.exercise_plan = plan
            session.save(update_fields=['exercise_plan'])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=['post'])
    def complete_exercise(self, request, pk=None):
        payload = SessionExerciseCompleteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        with transaction.atomic():
            session = self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            if session.end_time:
                raise ValidationError('La sesión ya ha finalizado.')
            plan = list(session.exercise_plan)
            item = next((item for item in plan if item['id'] == data['exercise']), None)
            if item is None:
                raise ValidationError('El ejercicio no pertenece a esta sesión.')
            if data['completed'] and not session.workoutset_set.filter(exercise_snapshot=data['exercise']).exists():
                raise ValidationError('Guarda al menos una serie para terminar este ejercicio.')
            item['completed'] = data['completed']
            session.exercise_plan = plan
            session.save(update_fields=['exercise_plan'])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=['post'])
    def remove_exercise(self, request, pk=None):
        """Quita un ejercicio solo de esta sesion (la rutina no cambia)."""
        payload = SessionExerciseCompleteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        exercise = payload.validated_data['exercise']
        with transaction.atomic():
            session = self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            if session.end_time:
                raise ValidationError('La sesión ya ha finalizado.')
            plan = list(session.exercise_plan)
            if not any(item['id'] == exercise for item in plan):
                raise ValidationError('El ejercicio no pertenece a esta sesión.')
            if session.workoutset_set.filter(exercise_snapshot=exercise).exists():
                raise ValidationError('Este ejercicio ya tiene series guardadas. Bórralas antes de quitarlo de la sesión.')
            if len(plan) == 1:
                raise ValidationError('La sesión necesita al menos un ejercicio.')
            session.exercise_plan = [item for item in plan if item['id'] != exercise]
            session.save(update_fields=['exercise_plan'])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None):
        with transaction.atomic():
            session = self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            if not session.end_time:
                if not session.workoutset_set.exists():
                    raise ValidationError('Registra al menos una serie antes de finalizar.')
                session.end_time = timezone.now()
                session.save(update_fields=['end_time'])
        return Response(self.get_serializer(session).data)


class WorkoutSetViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSetSerializer

    def get_queryset(self):
        queryset = WorkoutSet.objects.select_related('exercise', 'workout_session').filter(workout_session__user=self.request.user).order_by('id')
        session = self.request.query_params.get('workout_session')
        return queryset.filter(workout_session_id=session) if session else queryset

    def _save(self, serializer):
        session = serializer.validated_data.get('workout_session', getattr(serializer.instance, 'workout_session', None))
        with transaction.atomic():
            locked = WorkoutSession.objects.select_for_update().get(pk=session.pk)
            if locked.end_time:
                raise ValidationError('La sesión ya ha finalizado.')
            exercise_id = serializer.validated_data.get('exercise', getattr(serializer.instance, 'exercise', None))
            planned = next((item for item in locked.exercise_plan if exercise_id and item['id'] == exercise_id.pk), None)
            if not planned or planned.get('completed', False):
                raise ValidationError('Este ejercicio está terminado. Reábrelo antes de modificar sus series.')
            if serializer.instance:
                serializer.save()
            else:
                exercise = serializer.validated_data['exercise']
                serializer.save(exercise_snapshot=exercise.pk, exercise_name=planned['name'],
                                weight_unit=planned.get('weight_unit', 'kg'))

    def perform_create(self, serializer):
        self._save(serializer)

    def perform_update(self, serializer):
        self._save(serializer)

    def perform_destroy(self, instance):
        with transaction.atomic():
            session = WorkoutSession.objects.select_for_update().get(pk=instance.workout_session_id)
            if session.end_time:
                raise ValidationError('La sesión ya ha finalizado.')
            item = next((item for item in session.exercise_plan if item['id'] == instance.exercise_snapshot), None)
            if item and item.get('completed', False):
                raise ValidationError('Reabre el ejercicio antes de borrar sus series.')
            instance.delete()
