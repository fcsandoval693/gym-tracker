import math
from django.db.models import Q
from rest_framework import serializers
from .models import Exercise, Routine, RoutineDay, RoutineExercise, WorkoutSession, WorkoutSet


class OwnedRelatedField(serializers.PrimaryKeyRelatedField):
    """Relacion que solo acepta objetos del usuario que hace la peticion."""

    def __init__(self, owner_lookup, **kwargs):
        self.owner_lookup = owner_lookup
        super().__init__(**kwargs)

    def get_queryset(self):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return super().get_queryset().none()
        return super().get_queryset().filter(**{self.owner_lookup: request.user})


class ExerciseField(serializers.PrimaryKeyRelatedField):
    """Un ejercicio del catalogo o uno propio del usuario."""

    def get_queryset(self):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return Exercise.objects.none()
        return Exercise.objects.filter(Q(is_builtin=True) | Q(user=request.user))


class ExerciseSerializer(serializers.ModelSerializer):
    variants = serializers.ListField(child=serializers.CharField(max_length=60), required=False, max_length=12)

    class Meta:
        model = Exercise
        fields = ['id', 'name', 'muscle_group', 'is_builtin', 'equipment', 'variant_label', 'variants']
        read_only_fields = ['is_builtin']

    def validate_variants(self, value):
        cleaned = [item.strip() for item in value if item.strip()]
        if len(cleaned) != len(set(item.lower() for item in cleaned)):
            raise serializers.ValidationError('No repitas variantes.')
        return cleaned


class RoutineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Routine
        fields = ['id', 'name']


class RoutineDaySerializer(serializers.ModelSerializer):
    routine = OwnedRelatedField('user', queryset=Routine.objects.all())
    weekdays = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=6), required=False)

    class Meta:
        model = RoutineDay
        fields = ['id', 'name', 'routine', 'weekdays']

    def validate(self, attrs):
        routine = attrs.get('routine', getattr(self.instance, 'routine', None))
        weekdays = attrs.get('weekdays', getattr(self.instance, 'weekdays', []))
        if len(weekdays) != len(set(weekdays)):
            raise serializers.ValidationError({'weekdays': 'No repitas un día de la semana.'})
        others = RoutineDay.objects.filter(routine=routine)
        if self.instance:
            others = others.exclude(pk=self.instance.pk)
        if any(set(weekdays).intersection(day.weekdays) for day in others):
            raise serializers.ValidationError({'weekdays': 'Ese día ya tiene un entrenamiento en esta rutina.'})
        return attrs


class RoutineExerciseSerializer(serializers.ModelSerializer):
    routine_day = OwnedRelatedField('routine__user', queryset=RoutineDay.objects.all())
    exercise = ExerciseField()
    target_sets = serializers.IntegerField(min_value=1, max_value=10, required=False)
    rep_min = serializers.IntegerField(min_value=1, max_value=100, required=False)
    rep_max = serializers.IntegerField(min_value=1, max_value=100, required=False)

    class Meta:
        model = RoutineExercise
        fields = ['id', 'routine_day', 'exercise', 'position', 'weight_unit', 'equipment', 'variant', 'target_sets', 'rep_min', 'rep_max']

    def validate(self, attrs):
        day = attrs.get('routine_day', getattr(self.instance, 'routine_day', None))
        exercise = attrs.get('exercise', getattr(self.instance, 'exercise', None))
        variant = attrs.get('variant', getattr(self.instance, 'variant', ''))
        rep_min = attrs.get('rep_min', getattr(self.instance, 'rep_min', 8))
        rep_max = attrs.get('rep_max', getattr(self.instance, 'rep_max', 12))
        if rep_min > rep_max:
            raise serializers.ValidationError({'rep_max': 'El máximo de repeticiones no puede ser menor que el mínimo.'})
        if variant and exercise and variant not in (exercise.variants or []):
            raise serializers.ValidationError({'variant': 'Esa variante no existe para este ejercicio.'})
        query = RoutineExercise.objects.filter(routine_day=day, exercise=exercise)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError('Este ejercicio ya está en el entrenamiento.')
        return attrs


class WorkoutSessionSerializer(serializers.ModelSerializer):
    routine_day = OwnedRelatedField('routine__user', queryset=RoutineDay.objects.all(), allow_null=False)
    status = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutSession
        fields = ['id', 'routine_day', 'start_time', 'end_time', 'routine_name', 'day_name', 'exercise_plan', 'status']
        read_only_fields = ['start_time', 'end_time', 'routine_name', 'day_name', 'exercise_plan', 'status']

    def get_status(self, obj):
        return 'completed' if obj.end_time else 'active'

    def validate_routine_day(self, day):
        if not RoutineExercise.objects.filter(routine_day=day, exercise__isnull=False).exists():
            raise serializers.ValidationError('Añade ejercicios a este día antes de empezar.')
        return day


class WorkoutSetSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(read_only=True)
    weight = serializers.FloatField(min_value=0, max_value=10000)
    reps = serializers.IntegerField(min_value=1, max_value=10000)
    exercise = ExerciseField(allow_null=False)
    workout_session = OwnedRelatedField('user', queryset=WorkoutSession.objects.all())

    class Meta:
        model = WorkoutSet
        fields = ['id', 'exercise', 'exercise_name', 'exercise_snapshot', 'workout_session', 'weight', 'weight_unit', 'reps']
        read_only_fields = ['exercise_snapshot', 'weight_unit']

    def validate_weight(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError('El peso debe ser un número finito.')
        return value

    def validate(self, attrs):
        session = attrs.get('workout_session', getattr(self.instance, 'workout_session', None))
        exercise = attrs.get('exercise', getattr(self.instance, 'exercise', None))
        if not exercise:
            raise serializers.ValidationError('El ejercicio ya no está disponible.')
        if self.instance and exercise.pk != self.instance.exercise_id:
            raise serializers.ValidationError('No se puede cambiar el ejercicio de una serie guardada.')
        if self.instance and session.pk != self.instance.workout_session_id:
            raise serializers.ValidationError('No se puede trasladar una serie a otra sesión.')
        if session.end_time:
            raise serializers.ValidationError('La sesión ya ha finalizado.')
        allowed = [item['id'] for item in session.exercise_plan]
        if exercise.pk not in allowed:
            raise serializers.ValidationError('El ejercicio no pertenece a esta sesión.')
        return attrs
