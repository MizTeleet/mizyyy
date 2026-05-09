# Android WorkHoursTracker

Полная Android Studio версия приложения находится в модуле `app` и реализована на Kotlin + Jetpack Compose + Material3.

## Открыть в Android Studio

1. Откройте корень репозитория как Gradle/Android проект.
2. Дождитесь Gradle Sync.
3. Выполните `Build > Build Bundle(s) / APK(s) > Build APK(s)`.

## Сборка из терминала

```bash
JAVA_HOME=/path/to/jdk17 gradle :app:assembleDebug
```

APK после успешной сборки будет находиться в:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Требования

- Android Studio с Android SDK Platform 35.
- JDK 17.
- Доступ к Google Maven / Maven Central для загрузки Android Gradle Plugin, Kotlin plugin и Compose dependencies.
