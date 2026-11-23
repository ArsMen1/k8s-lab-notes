# Redis incident: cache hit rate падает, latency приложения растёт

## Сценарий

После релиза backend latency выросла, хотя Redis доступен, Pod Redis не перезапускался, CPU и память Redis не выглядят критичными.

**Твоя задача:** диагностировать инцидент как Production Support Engineer. Не предполагай заранее, что проблема в самом Redis.

## Симптомы

| Метрика | До инцидента | Сейчас |
|---|---:|---:|
| Application p95 latency | 180 ms | 2.9 s |
| Cache hit ratio | 94% | 41% |
| Request rate | 1,200 req/s | 1,250 req/s |
| Redis CPU | 28% | 34% |
| Redis memory used | 4.1 GiB | 4.2 GiB |
| Redis evicted keys | 0/min | 3/min |
| Database CPU | 35% | 89% |
| DB query p95 | 45 ms | 780 ms |
| API errors/timeouts | 0.2% | 6.4% |

Redis endpoint отвечает. Приложение не теряет соединение с Redis. Ошибок Redis connection в логах нет.

## Условия и ограничения

- Работай в локальном/учебном окружении или используй предоставленные данные как incident simulation.
- Начинай с read-only проверки.
- Не выполняй `FLUSHALL`, `FLUSHDB`, массовое удаление ключей, `KEYS *` или `MONITOR` на production.
- Не меняй TTL, cache keys, настройки Redis или deployment до того, как сформулируешь гипотезу и оценишь blast radius.
- Сначала убедись, что проверяешь правильный Kubernetes context и namespace.

## Задание 1 — зафиксировать impact и timeline

1. Определи, какие пользовательские функции затронуты и каков масштаб деградации.
2. Составь timeline: начало роста latency, hit ratio, DB CPU, query latency, изменения после релиза.
3. Отдели симптомы от доказанных причин.
4. Какие сигналы указывают, что Redis, вероятно, не является первичным bottleneck?

## Задание 2 — read-only диагностика Kubernetes

Проверь context, namespace, Pods, Service и Events:

```bash
kubectl config current-context
kubectl get pods -n <namespace> -o wide
kubectl get svc -n <namespace>
kubectl describe pod <redis-pod> -n <namespace>
kubectl get events -n <namespace> --sort-by=.lastTimestamp
```

Ответь:
- Были ли рестарты, OOM, eviction или scheduling проблемы?
- Redis Pod Ready — что это доказывает и чего не доказывает?
- Какие дополнительные метрики/графики запросил бы?

## Задание 3 — Redis read-only checks

Если доступен Redis CLI и права позволяют, используй безопасные read-only команды:

```text
PING
INFO stats
INFO memory
INFO clients
INFO commandstats
INFO keyspace
```

Сравни snapshots во времени, а не только один момент.

Проверь:
- `keyspace_hits` и `keyspace_misses` — рассчитай hit ratio по приростам counters за одинаковый интервал;
- `evicted_keys` — есть ли eviction, и достаточно ли его для объяснения miss storm;
- `expired_keys` — изменился ли темп истечения ключей;
- memory usage, maxmemory и eviction policy (если доступна конфигурация);
- latency/slowlog — только если доступен разрешённый безопасный интерфейс; не включай глобальные настройки и не очищай slowlog.

**Формула hit ratio по дельтам:**

`hit ratio = Δhits / (Δhits + Δmisses) × 100%`

Не сравнивай абсолютные counters, если Redis перезапускался или counters сбрасывались.

## Задание 4 — исследовать приложение и downstream

Попроси application logs/metrics за окно инцидента:

- cache key / namespace (без вывода чувствительных значений);
- cache lookup result (hit/miss) и причины miss, если логируются;
- TTL при записи ключей;
- изменения кода/config после последнего релиза;
- database connection pool saturation, запросы, query p95, timeouts;
- повторные запросы к БД при cache miss.

Не выгружай cache values или персональные данные в тикет/чат.

## Evidence

### A. Redis metrics snapshot (интервал 5 минут)

```text
keyspace_hits: 142000
keyspace_misses: 205000
expired_keys: 98000
evicted_keys: 15
used_memory: 4.2G
maxmemory: 8G
```

### B. Redis commandstats (дельты за 5 минут)

```text
get: calls +210000
set: calls +205000
```

### C. Application log excerpt

```text
INFO cache miss key_prefix=product:v3 ttl_on_write=30s
INFO db_query source=cache_miss duration_ms=812
INFO cache_write key_prefix=product:v3 ttl=30s
INFO cache miss key_prefix=product:v3 ttl_on_write=30s
INFO db_query source=cache_miss duration_ms=790
```

### D. Release timeline

```text
14:02 — application release started
14:07 — cache hit ratio begins falling
14:10 — DB CPU begins rising
14:12 — application p95 latency crosses 1s
14:15 — error rate reaches 6.4%
```

### E. Database

```text
DB CPU: 89%
Query p95: 780ms (baseline 45ms)
Connections: 72/80
Timeouts: increasing
```

## Задание 5 — сформулировать root cause

Составь гипотезы и ранжируй их по evidence:

- Redis capacity / memory pressure;
- TTL/expiration behavior;
- application cache key change;
- cache invalidation/namespace mismatch;
- database slowdown unrelated to cache;
- application release regression.

Для каждой гипотезы укажи:
1. какие evidence поддерживают её;
2. что противоречит;
3. какой следующий read-only check даст больше уверенности.

## Задание 6 — безопасная mitigation

Напиши короткий mitigation plan для incident commander:

- что можно остановить/откатить;
- какой change требует approval;
- как избежать cache stampede при прогреве или восстановлении;
- почему масштабирование Redis или backend без evidence может не помочь;
- какие риски у резкого повышения TTL;
- как избежать повторного перегруза DB при recovery.

Не предлагай mass cache warming без оценки concurrency/rate limits downstream.

## Verification

После mitigation проверь по динамике, а не единичным snapshot:

- cache hit ratio возвращается к baseline;
- DB CPU и query p95 снижаются;
- application p95 latency и errors уменьшаются;
- misses и DB запросы на cache miss снижаются;
- Redis memory/evictions стабильны;
- нет новой деградации или side effects.

## Incident report

Заполни:

- **Impact:**
- **Timeline:**
- **Detection:**
- **Evidence:**
- **Root cause:**
- **Mitigation:**
- **Verification:**
- **Prevention:**
- **Follow-up owner / actions:**

## Root cause — открой после расследования

<details>
<summary>Подсказка</summary>

Сопоставь release timeline, key prefix и TTL. Redis работает и не испытывает существенного memory pressure. Вопрос не только «почему Redis отдаёт miss», но и «почему приложение перестало попадать в прежние cache entries?».

</details>

<details>
<summary>Root cause</summary>

В новом релизе изменился cache key namespace с `product:v2` на `product:v3`, но прогрев и cache population strategy не были адаптированы к новой схеме. Старые ключи ещё существуют, однако приложение больше не читает их. Cache miss резко увеличил количество запросов в БД; DB стала перегружаться, время ответа выросло, и ошибки начали распространяться обратно в приложение.

Показатель `expired_keys` увеличился из-за прежнего набора ключей, но eviction незначителен и memory usage далеко от maxmemory — это не объясняет основной miss storm.

**Mitigation:** если подтверждено regression и rollback безопасен, согласовать откат приложения/конфигурации либо исправление namespace. Не удалять старые ключи и не устраивать массовый прогрев. Следить за нагрузкой на DB при постепенном восстановлении cache hit ratio.

**Prevention:** release checklist для cache schema/key changes, контроль hit ratio и DB load в canary, оценка cache warming, документирование TTL/key versioning и regression tests на cache compatibility.

</details>

## Cleanup

Для этого сценария cleanup не требуется, если использовались только предоставленные данные. Если ты создал тестовые ресурсы самостоятельно, удали только свои ресурсы после проверки namespace/context.

## Шпаргалка

| Симптом | Первое направление проверки |
|---|---|
| Cache hit ratio падает, Redis здоров | Cache key/schema, TTL, release changes |
| Misses растут, DB CPU растёт | Cache miss amplification / DB overload |
| Evictions растут, память близко к maxmemory | Memory capacity, key size, eviction policy |
| Expirations синхронны | TTL alignment, expiration burst |
| Redis latency растёт | Slow commands, hot keys, network, CPU |
| DB overload при cache misses | Rate limiting, bounded retries, concurrency, safe cache recovery |

