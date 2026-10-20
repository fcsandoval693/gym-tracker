from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from .serializers import ChangePasswordSerializer, LoginSerializer, RegisterSerializer, UserSerializer


class AuthThrottle(SimpleRateThrottle):
    """Máximo de intentos por minuto desde una misma conexión (el valor 'auth' de settings.py)."""
    scope = 'auth'

    def get_cache_key(self, request, view):
        # get_ident devuelve la dirección IP de quien hace la petición.
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


def token_response(user, code=status.HTTP_200_OK):
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': UserSerializer(user).data}, status=code)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return token_response(serializer.save(), status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def login(request):
    serializer = LoginSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    return token_response(serializer.validated_data['user'])


@api_view(['POST'])
def logout(request):
    # Borrar el token lo invalida: aunque alguien lo hubiera copiado, ya no sirve.
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'PATCH'])
def me(request):
    # GET: tus datos. PATCH: cambiar tu nombre.
    if request.method == 'PATCH':
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@throttle_classes([AuthThrottle])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data['new_password'])
    request.user.save(update_fields=['password'])
    # Se cambia el token: cualquier otro dispositivo con la sesión abierta tendrá que volver a entrar.
    Token.objects.filter(user=request.user).delete()
    return token_response(request.user)
