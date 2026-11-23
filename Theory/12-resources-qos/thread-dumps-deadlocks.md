# Thread dumps, deadlocks и диагностика зависших Java-приложений

## Зачем это Production Support Engineer

Java-сервис может оставаться `Running`, readiness может быть успешной, CPU/RAM — без явной аномалии, но запросы зависают или перестают обрабатываться. Причина иногда находится не в Kubernetes, а внутри JVM: потоки блокируются, ждут locks, зависают на I/O, исчерпывают worker pool или образуют deadlock.

Thread dump — моментальный снимок состояния потоков JVM. Он помогает понять, **чем заняты потоки и чего они ждут**. Один dump — лишь snapshot; для динамики обычно сравнивают несколько dumps, снятых с интервалом.

## 1. Thread dump: что это и что в нём есть

Thread dump содержит, в зависимости от JVM и инструмента:

- имя и ID потока;
- состояние потока;
- stack trace — цепочку методов, в которой находится поток;
- информацию о locks/monitors, которые поток держит или ожидает;
- сведения о deadlock, если JVM смогла его обнаружить;
- некоторые дополнительные сведения JVM и native thread.

Thread dump не является профилем CPU и не показывает историю потока. Он не доказывает сам по себе, что конкретный метод всегда медленный.

## 2. Состояния потоков Java

Состояния Java thread (из `Thread.State`) не равны напрямую состояниям процессов Linux.

### RUNNABLE

Поток готов к исполнению или выполняется; в Java это состояние может также включать ожидание некоторых операций ввода-вывода в native code. RUNNABLE не гарантирует, что поток непрерывно получает CPU.

Что смотреть: повторяющиеся stack frames, hot loops, CPU usage, профилировщик, native I/O.

### BLOCKED

Поток ожидает входа в synchronized monitor, который удерживается другим потоком. Часто это lock contention.

Что смотреть: какой monitor ожидается, какой поток владеет lock, повторяется ли ситуация в нескольких dumps.

### WAITING

Поток ожидает неопределённо долгое время, например `Object.wait()`, `LockSupport.park()`, ожидание другого потока или события.

WAITING не обязательно проблема: idle workers часто находятся в ожидании, когда им нечего делать.

### TIMED_WAITING

Поток ожидает с timeout, например `Thread.sleep()`, timed wait или ожидание результата с ограничением времени.

TIMED_WAITING также может быть нормальным состоянием. Важно выяснить, почему поток ждёт, и соответствует ли это ожидаемому поведению.

## 3. Как снять thread dump

Используй только разрешённые средства доступа к контейнеру/Node и согласованный runbook. Не устанавливай инструменты и не меняй параметры JVM в production без разрешения.

### Вариант A: jcmd

Если JDK tools присутствуют в контейнере и ты имеешь права:

```bash
jcmd <pid> Thread.print
```

Чтобы получить dump в файл (выполняй команду в подходящем shell с разрешениями):

```bash
jcmd <pid> Thread.print > /tmp/thread-dump.txt
```

### Вариант B: jstack

```bash
jstack <pid>
jstack -l <pid>
```

Опция `-l` добавляет информацию о lock-ах. Доступность и детали зависят от версии JDK и окружения.

### Вариант C: сигнал SIGQUIT (Linux HotSpot)

В некоторых конфигурациях HotSpot сигнал `SIGQUIT` (часто `kill -3 <pid>`) приводит к выводу thread dump в stdout/stderr JVM, то есть в container logs.

```bash
kill -3 <pid>
```

**Это не то же самое, что SIGKILL:** сигнал -3 для HotSpot обычно запрашивает диагностический dump, а не завершает JVM. Но обязательно уточни JVM, ОС, PID namespace и production runbook; не используй сигнал как универсальный способ для любой Java runtime.

### Kubernetes-контекст

Сначала найди контейнер и проверь, какие инструменты доступны:

```bash
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl exec -n <namespace> <pod> -c <container> -- ps
```

Если в образе есть нужная утилита, и доступ разрешён, можно выполнить команду внутри контейнера. Минимальные runtime images часто не содержат `jcmd`/`jstack`; tools из другого контейнера могут не иметь доступа к JVM из-за PID namespace, UID, JDK/runtime mismatch или attach restrictions.

Не добавляй privileged containers и не меняй production Pod ради снятия dump без согласования.

## 4. Почему важно снять несколько dumps

Снимок показывает, где потоки находятся в данный момент. Повторные dumps, например с интервалом 10–30 секунд (в зависимости от инцидента и допустимого overhead), помогают определить:

- один и тот же stack долго не меняется — возможно, поток завис или долго ждёт;
- BLOCKED threads ждут один и тот же monitor;
- пул workers постоянно занят одинаковыми задачами;
- потоки двигаются между frames — возможно, workload работает, но медленно;
- количество threads растёт между snapshots.

Сравни минимум два, а часто три snapshots, если это допустимо. Слишком частые dumps сами создают overhead; выбери частоту по runbook и тяжести ситуации.

## 5. Deadlock

Deadlock — взаимная блокировка, при которой два или более потоков ждут ресурсы, удерживаемые друг другом, и не могут продолжить.

Упрощённый пример:

- Thread A удерживает Lock 1 и ждёт Lock 2.
- Thread B удерживает Lock 2 и ждёт Lock 1.
- Оба потока не могут продолжить.

```text
Thread A: holds Lock 1 -> waiting for Lock 2
Thread B: holds Lock 2 -> waiting for Lock 1
```

В thread dump HotSpot может явно сообщить о найденном deadlock и перечислить involved threads/locks.

**Важно:** отсутствие явного deadlock report не исключает всех проблем с зависанием, starvation, distributed locks или зависимостями вне JVM.

## 6. Lock contention и один заблокированный поток — не всегда deadlock

### Lock contention

Многие threads конкурируют за один lock. Потоки могут постепенно продолжать работу, но производительность резко падает. Это не deadlock, если владелец lock периодически освобождает его.

Признаки:

- много BLOCKED threads;
- в dumps ожидают один и тот же monitor;
- lock owner часто находится в критической секции;
- latency растёт при concurrency.

### Starvation

Поток или задача длительное время не получает необходимый ресурс/возможность исполнения. Остальные продолжают работу. Thread dump может показывать repeated waiting, но для доказательства starvation часто нужны snapshots, pool metrics и runtime evidence.

### Deadlock

Циклическое ожидание locks, при котором участники не могут продолжить. Ищи цикл зависимостей, а не просто много BLOCKED threads.

## 7. Thread pool exhaustion

Thread dump может помочь выявить занятые workers, но **не всегда показывает размер пула, очередь и rejected tasks**. Это нужно получать из application metrics, logs, JMX или telemetry конкретного framework.

Проверяй:

- configured pool size;
- active workers;
- idle workers;
- queue depth;
- rejected tasks;
- task duration;
- threads, которые долго ждут connection, lock или downstream;
- timeout-и и отменённые задачи.

Если все workers ждут медленный downstream, увеличение pool size может усилить нагрузку на dependency и ухудшить инцидент.

## 8. Как читать stack trace: практический подход

Не пытайся сразу анализировать все строки каждого thread. Сначала группируй:

1. Threads по имени и типу (HTTP workers, scheduler, GC, application threads).
2. State (RUNNABLE, BLOCKED, WAITING, TIMED_WAITING).
3. Повторяющиеся top frames.
4. Locks held / locks waited for.
5. Внешние вызовы (JDBC, HTTP client, filesystem, messaging).
6. Сопоставление с thread pool и application metrics.

Stack trace с JDBC или HTTP client frames может указывать, где поток проводит время, но не всегда раскрывает точную причину. Дополнительно нужны dependency-side metrics, timeout configuration, traces или logs.

## 9. Production Support алгоритм

1. **Зафиксируй симптом:** endpoint, p95/p99, error rate, timeout count, время начала.
2. **Определи scope:** все replicas или один Pod? Один Node? Одна версия приложения?
3. **Проверь Kubernetes:** restarts, events, rollout, CPU throttling, memory, readiness.
4. **Проверь JVM metrics:** thread count, pool metrics, GC pauses, CPU, если доступны.
5. **Сними thread dump** через approved method; зафиксируй timestamp, Pod, container и PID.
6. **Если возможно, сними повторные dumps** через разумный интервал, чтобы сравнить состояние threads.
7. **Сгруппируй потоки:** BLOCKED, RUNNABLE, WAITING, TIMED_WAITING; выдели повторяющиеся stack traces и locks.
8. **Проверь pool/queue/dependency metrics** — thread dump не заменяет метрики.
9. **Формулируй гипотезу:** deadlock, contention, stuck I/O, pool exhaustion, slow dependency или просто idle workers.
10. **Не делай restart первым шагом**, если dump может дать важные данные и сбор безопасен. При severe incident действуй по runbook и приоритету восстановления; сбор диагностики не должен задерживать согласованное mitigation.

## 10. Пример инцидента

**Симптом:** Java API не отвечает на часть запросов. Pod `Running`, readiness иногда проходит, CPU 20%, memory стабильна, рестартов нет.

Собраны три thread dumps с интервалом 15 секунд:

- большая часть HTTP worker threads в каждом snapshot ждёт получения connection из JDBC pool;
- pool metrics показывают, что все connections заняты, acquisition queue растёт;
- в dumps не обнаружен JVM monitor deadlock;
- database latency и число активных/долго выполняющихся запросов увеличены.

Рабочая гипотеза: threads не заблокированы друг другом внутри JVM; они ждут доступ к DB connections. Возможная первичная причина — медленные DB queries или downstream DB saturation, а pool exhaustion — следствие.

Следующие проверки: database wait/lock reports, slow query metrics, pool acquisition/hold times, длительность транзакций, timeout-и и сравнение с healthy instances. Thread dump помог локализовать ожидание, но root cause подтверждается внешними метриками.

## 11. Безопасность и ограничения

Thread dumps могут содержать:

- аргументы методов;
- SQL или фрагменты запросов;
- пользовательские данные;
- tokens/credentials, если они попали в stack или контекст;
- имена внутренних сервисов и инфраструктуры.

Сохраняй и передавай dumps согласно правилам компании. Не загружай production dumps в публичные paste services или сторонние AI/сайты. Учитывай, что сам сбор может вызвать кратковременный overhead.

## Краткие правила

- Один dump — snapshot, несколько — динамика.
- WAITING и TIMED_WAITING часто являются нормой.
- RUNNABLE не гарантирует, что поток активно потребляет CPU.
- BLOCKED обычно означает ожидание monitor lock, но это ещё не deadlock.
- Deadlock — циклическое ожидание; contention — конкуренция, при которой прогресс может продолжаться.
- Thread dump не заменяет metrics thread pools, queues, connections и downstream dependencies.
- Restart может восстановить работу, но уничтожить evidence; соблюдай incident runbook.
- Не раскрывай thread dumps: они могут содержать чувствительные данные.

## Вопросы для самопроверки

1. Чем thread dump отличается от heap dump и GC log?
2. Что означает BLOCKED, и почему это не обязательно deadlock?
3. Почему WAITING может быть нормальным состоянием?
4. Как определить deadlock по locks и threads?
5. Почему три thread dumps информативнее одного?
6. Как thread pool exhaustion может выглядеть как зависание приложения?
7. Почему threads, ожидающие JDBC connection, не доказывают, что JVM lock deadlock?
8. Что ты проверишь кроме thread dump при диагностике зависшего API?
9. Какие sensitive data могут содержаться в thread dump?
10. Когда restart оправдан, а когда стоит сначала собрать evidence?

## Связанные материалы

- [JVM Heap, Garbage Collection и Stop-the-Wорld pauses](jvm-heap-gc-stw.md)
- [Performance troubleshooting: CPU, Memory и Disk в норме](performance-troubleshooting-normal-resources.md)
- [Resources, QoS, OOMKilled и eviction](README.md)
- [Java Thread Dumps (Oracle troubleshooting guide)](https://docs.oracle.com/en/java/javase/21/troubleshoot/troubleshooting-guide.pdf)
