# Android WorkHoursTracker

Android версия приложения реализована на Kotlin + Jetpack Compose в модуле `app`.

## Сборка APK

```bash
JAVA_HOME=/path/to/jdk17 ./gradlew :app:assembleDebug
```

В текущем репозитории можно также использовать установленный Gradle:

```bash
JAVA_HOME=/path/to/jdk17 gradle :app:assembleDebug
```

APK после успешной сборки будет находиться в:

```text
app/build/outputs/apk/debug/app-debug.apk
```

> Для сборки нужен Android SDK и доступ к Google Maven / Maven Central для загрузки Android Gradle Plugin и Compose dependencies.
