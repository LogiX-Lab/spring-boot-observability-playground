# Database-Level Observation in This Project

## What "observation at the database level" means

OpenTelemetry can observe your application at multiple layers. The database layer
means every JDBC call — every SQL query, every connection acquisition — becomes a
**child span** inside the currently active trace. You can then see in Jaeger exactly
which SQL statements ran during a single HTTP request, how long each took, and
whether a slow endpoint is slow because of a bad query or slow business logic.

---

## How It Is Wired in This Project

### 1. The Library — `datasource-micrometer-spring-boot`

Added to both `order-service/pom.xml` and `payment-service/pom.xml`:

```xml
<dependency>
    <groupId>net.ttddyy.observation</groupId>
    <artifactId>datasource-micrometer-spring-boot</artifactId>
    <version>1.0.6</version>
</dependency>
```

This is a Spring Boot auto-configuration library by Tadaya Tsuyukubo (the author of
`datasource-proxy`). On startup it detects the existing `DataSource` bean and
**wraps it with a proxy** — no code changes needed anywhere else.

### 2. The Bridge — `micrometer-tracing-bridge-otel`

Already on the classpath in both services:

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
```

`datasource-micrometer` uses **Micrometer Observation** API to emit events.
The bridge translates those Micrometer observations into **OpenTelemetry spans**
automatically — no extra wiring needed.

### 3. The Exporter — `opentelemetry-exporter-otlp`

Also already on the classpath. Sends the spans as OTLP HTTP payloads to Jaeger.

```properties
management.otlp.tracing.endpoint=http://localhost:4318/v1/traces
```

### 4. Configuration Properties (both `application.properties`)

```properties
# Logs each query to the console via slf4j (useful during development)
datasource.proxy.query.enable-logging=true

# Whether to capture bind parameter values in the span (false = safer for prod)
datasource.proxy.include-parameter-values=false
```

---

## The Proxy Wrapping Mechanism

```
Application code
      │
      │  orderRepository.save(entity)
      ▼
  Hibernate ORM
      │
      │  emits JDBC call: prepareStatement("INSERT INTO orders ...")
      ▼
┌─────────────────────────────────────┐
│  ProxyDataSource  (datasource-micrometer wrapper)     │
│                                     │
│  1. Start Micrometer Observation    │  ← span begins: "query"
│  2. Delegate to real DataSource     │
│  3. Real PostgreSQL Driver executes │
│  4. Stop Observation                │  ← span ends, duration recorded
└─────────────────────────────────────┘
      │
      ▼
  PostgreSQL (port 5432)
```

The proxy intercepts at the **JDBC layer**, sitting between Hibernate and the real
PostgreSQL driver. The original `DataSource` bean is replaced in the Spring context
with the proxy — Hibernate never knows it is being observed.

---

## What Spans Look Like in Jaeger

A typical `POST /api/v1/order` trace will look like this in the Jaeger UI:

```
POST /api/v1/order                                  [order-service]  ~45ms
  ├─ query                                           [order-service]   ~3ms
  │     db.system    = postgresql
  │     db.operation = INSERT
  │     db.statement = insert into orders (id, customer_id, ...) values (?, ...)
  │
  ├─ query                                           [order-service]   ~2ms
  │     db.system    = postgresql
  │     db.operation = INSERT
  │     db.statement = insert into order_items (order_id, product_id, ...) values (?, ...)
  │
  └─ send orders.topic                               [order-service]   ~1ms
       └─ receive orders.topic                       [payment-service]
            └─ query                                 [payment-service]  ~2ms
                  db.system    = postgresql
                  db.operation = INSERT
                  db.statement = insert into payment (order_id, status, ...) values (?, ...)
```

Each `query` span carries these **standard OTel semantic conventions** attributes:

| Attribute | Example value |
|---|---|
| `db.system` | `postgresql` |
| `db.operation` | `SELECT` / `INSERT` / `UPDATE` |
| `db.statement` | Full SQL text (when `include-parameter-values=false`, bind params are `?`) |
| `db.url` | `jdbc:postgresql://localhost:5432/observability_db` |
| `net.peer.name` | `localhost` |
| `net.peer.port` | `5432` |

---

## The Full Observation Pipeline

```
JDBC call (Hibernate)
      │
      ▼
datasource-micrometer (ProxyDataSource)
      │  emits: Micrometer Observation("db.query")
      ▼
micrometer-tracing-bridge-otel
      │  translates to: OpenTelemetry Span
      │  sets parent: current active span (HTTP span / Kafka span)
      ▼
opentelemetry-exporter-otlp
      │  HTTP POST /v1/traces
      ▼
Jaeger (port 4318)
      │
      ▼
Jaeger UI (port 16686)
```

---

## What Is NOT Covered

| Layer | Covered? | Notes |
|---|---|---|
| SQL query execution time | ✅ Yes | Per-query child span |
| PostgreSQL server internals | ❌ No | Would need `pg_stat_statements` + Prometheus |
| Connection pool wait time | ✅ Partial | `datasource-micrometer` can instrument HikariCP connections |
| Slow query plan | ❌ No | Requires `EXPLAIN ANALYZE` on the DB side |
| Bind parameter values | ⚠️ Opt-in | Set `datasource.proxy.include-parameter-values=true` (sensitive data risk) |

---

## Relevant Files in This Project

| File | Role |
|---|---|
| `order-service/pom.xml` | Adds `datasource-micrometer-spring-boot` |
| `payment-service/pom.xml` | Same |
| `order-service/src/main/resources/application.properties` | `datasource.proxy.*` config |
| `payment-service/src/main/resources/application.properties` | Same |
| `order-service/repository/OrderRepository.java` | Queries that become observed spans |
| `payment-service/service/PaymentService.java` | Queries that become observed spans |
