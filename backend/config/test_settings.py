import os
from .settings import *  # noqa: F403

# Las pruebas no modifican PostgreSQL.
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.environ.get('GYM_TEST_DB', ':memory:')}}
