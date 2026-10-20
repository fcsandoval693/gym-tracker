from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0007_routineexercise_equipment_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='exercise',
            name='is_builtin',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exercise',
            name='equipment',
            field=models.CharField(choices=[('dumbbell', 'Mancuernas'), ('plates', 'Barra y discos'), ('machine', 'Maquina'), ('bodyweight', 'Peso corporal'), ('other', 'Otro')], default='other', max_length=12),
        ),
        migrations.AddField(
            model_name='exercise',
            name='variant_label',
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name='exercise',
            name='variants',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='routineexercise',
            name='variant',
            field=models.CharField(blank=True, max_length=60),
        ),
    ]
