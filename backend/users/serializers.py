from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name']
        # El email identifica la cuenta: de momento no se puede cambiar desde la app.
        read_only_fields = ['id', 'email']

    def validate_first_name(self, value):
        return value.strip()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Ya existe una cuenta con este email.')
        return email

    def validate(self, attrs):
        # Usa los validadores de contraseña de Django (longitud, demasiado común, solo números...).
        validate_password(attrs['password'], User(email=attrs['email'], first_name=attrs.get('first_name', '')))
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(self.context.get('request'), email=attrs['email'].strip().lower(), password=attrs['password'])
        if not user:
            raise serializers.ValidationError('Email o contraseña incorrectos.')
        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        # Pedir la contraseña actual evita que alguien con tu sesión abierta te la cambie.
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('La contraseña actual no es correcta.')
        return value

    def validate(self, attrs):
        if attrs['current_password'] == attrs['new_password']:
            raise serializers.ValidationError({'new_password': 'La nueva contraseña debe ser distinta de la actual.'})
        validate_password(attrs['new_password'], self.context['request'].user)
        return attrs
