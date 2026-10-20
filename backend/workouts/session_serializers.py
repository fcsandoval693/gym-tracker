from rest_framework import serializers
from .models import WEIGHT_UNITS, EQUIPMENT_CHOICES
from .serializers import ExerciseField, ExerciseSerializer


class SessionExerciseEditSerializer(serializers.Serializer):
    current_exercise = serializers.IntegerField(min_value=1)
    exercise = ExerciseField(required=False)
    new_exercise = ExerciseSerializer(required=False)
    weight_unit = serializers.ChoiceField(choices=WEIGHT_UNITS, required=False)
    equipment = serializers.ChoiceField(choices=EQUIPMENT_CHOICES, required=False)
    name = serializers.CharField(max_length=100, required=False)
    muscle_group = serializers.CharField(max_length=100, allow_blank=True, required=False)

    def validate(self, attrs):
        if ('exercise' in attrs) == ('new_exercise' in attrs):
            raise serializers.ValidationError('Selecciona un ejercicio o crea uno nuevo.')
        return attrs


class SessionExerciseCompleteSerializer(serializers.Serializer):
    exercise = serializers.IntegerField(min_value=1)
    completed = serializers.BooleanField(default=True)
