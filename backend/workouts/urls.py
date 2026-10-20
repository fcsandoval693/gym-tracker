from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ExerciseViewSet, RoutineViewSet, RoutineDayViewSet, RoutineExerciseViewSet, WorkoutSessionViewSet, WorkoutSetViewSet

router = DefaultRouter() # Genera varias rutas automaticamente a través de DRF para cada ViewSet.De no existir hay que cablear las urls a mano
router.register("exercises", ExerciseViewSet, basename="exercise")
router.register("routines", RoutineViewSet, basename="routine")
router.register("routine-days", RoutineDayViewSet, basename="routine-day")
router.register("routine-exercises", RoutineExerciseViewSet, basename="routine-exercise")
router.register("workout-sessions", WorkoutSessionViewSet, basename="workout-session")
router.register("workout-sets", WorkoutSetViewSet, basename="workout-set")


urlpatterns = [
    path("", include(router.urls)),
]