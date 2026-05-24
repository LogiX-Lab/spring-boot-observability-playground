# OpenTelemetry Observation at the Service Level (order-service & payment-service)

## The Technology Stack

Both services share the same tracing stack, assembled from three Spring Boot dependencies:

```xml
<!-- 1. Exposes the Observation/Actuator infrastructure -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<!-- 2. Bridges Micrometer Observation events into OpenTelemetry spans -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>

<!-- 3. Ships the spans to Jaeger via OTLP HTTP -->
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

These three together form the pipeline:

```
Spring / Micrometer Observation
          │  emits Observation events
          ▼
micrometer-tracing-bridge-otel
          │  translates to OTel Span objects
          ▼
opentelemetry-exporter-otlp
          │  HTTP POST /v1/traces
          ▼
    Jaeger :4318
```

---

## Shared Configuration (both `application.properties`)

```properties
# Sample every request — 1.0 = 100% (lower in production, e.g. 0.1)
management.tracing.sampling.probability=1.0

# Ship spans to Jaeger's OTLP HTTP collector
management.otlp.tracing.endpoint=http://localhost:4318/v1/traces
```

`spring.application.name` (set to `order-service` / `payment-service`) becomes the
`service.name` resource attribute on every span — this is what Jaeger displays as the
node label in the System Architecture diagram.

---

## Three Layers of Observation

### Layer 1 — Auto-Instrumentation (zero code required)

Spring Boot auto-configures observation for several integration points when
`micrometer-tracing-bridge-otel` is on the classpath.

#### HTTP Server — Spring MVC (`order-service`)

Every inbound HTTP request to `OrderController` automatically gets a root span.
No annotation or configuration needed — Spring MVC's `ObservationFilter` wraps
every `DispatcherServlet` invocation.

```
POST /api/v1/order        → span: "POST /api/v1/order"   [order-service]
PUT  /api/v1/order        → span: "PUT /api/v1/order"    [order-service]
GET  /api/v1/order        → span: "GET /api/v1/order"    [order-service]
```

Span attributes set automatically:

| Attribute | Example |
|---|---|
| `http.request.method` | `POST` |
| `url.path` | `/api/v1/order` |
| `http.response.status_code` | `200` |
| `server.address` | `localhost` |
| `server.port` | `8081` |

#### HTTP Client — RestTemplate (`payment-service`)

`PaymentApplication` creates an `OrderUpdateService` backed by a `RestTemplate`.
Spring Boot auto-configures `RestTemplateBuilder` with an `ObservationConvention`,
so every outgoing HTTP call from payment-service back to order-service creates a
child span with the W3C `traceparent` header injected.

```java
// PaymentApplication.java
@Bean
RestTemplate restTemplate(RestTemplateBuilder builder) {
    return builder.build();   // builder includes ObservationConvention automatically
}
```

This creates the `payment-service → order-service` dependency edge in Jaeger for the
status update callback (`PUT /api/v1/order`).

#### Kafka Producer — `spring.kafka.template.observationEnabled=true` (`order-service`)

```java
// OrderProcessingService.java
kafkaTemplate.send("order-events", String.valueOf(order.id()), orderJson);
```

When observation is enabled, `KafkaTemplate.send()` creates a producer span and injects
`traceparent` into the Kafka message headers automatically.

```
span: "order-events send"   [order-service]
  tags: messaging.system=kafka, messaging.destination.name=order-events
```

#### Kafka Consumer — `spring.kafka.listener.observationEnabled=true` (`payment-service`)

```java
// PaymentEventHandler.java
@KafkaListener(topics = "order-events")
public void listen(String message) { ... }
```

The listener container extracts `traceparent` from the message headers and creates a
consumer span as a child of the producer span.

```
span: "order-events receive"   [payment-service]
  parent: "order-events send"  [order-service]   ← linked across services
```

#### JDBC / PostgreSQL — `datasource-micrometer-spring-boot` (both services)

Every SQL query becomes a child span. Covered in detail in `database-observation.md`.

---

### Layer 2 — Explicit Custom Span with `@Observed` (`payment-service` only)

`PaymentService.processPayment()` is annotated with `@Observed`, creating a dedicated
span that wraps the entire payment processing logic:

```java
// PaymentService.java
@Observed(name = "payment:processPayment")
@Transactional
public void processPayment(OrderPayment orderPayment) {
    // validate → Thread.sleep(500)
    // authorize → Thread.sleep(500)
    // capture   → Thread.sleep(500)
    // complete  → Thread.sleep(500)
    savePayment(orderPayment, PaymentStatus.COMPLETED);
}
```

`@Observed` requires two extra dependencies in `payment-service/pom.xml`:

```xml
<!-- AOP proxy weaves the @Observed advice around the method -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>

<!-- The Observation API itself -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-observation</artifactId>
</dependency>
```

The resulting span in Jaeger shows the **~2 seconds** of simulated payment processing
as a single named unit, making it easy to identify payment latency as a distinct step
in the trace.

```
order-events receive                      [payment-service]  ~2100ms
  └─ payment:processPayment               [payment-service]  ~2000ms  ← @Observed
       └─ query [INSERT INTO payment ...] [payment-service]    ~3ms   ← datasource-micrometer
```

---

### Layer 3 — Context Propagation Between Services

The W3C `traceparent` header ties all spans from all services into one trace.

```
traceId is created once by the first span (HTTP or Kafka receive)
and carried forward through every context propagation point:

order-front  ──[traceparent header]──►  order-service  ──[Kafka message header]──►  payment-service
                                                        ◄──[traceparent header]──── (REST callback)
```

All spans with the same `traceId` are grouped in Jaeger as a single trace tree.

---

## Complete Span Tree for `POST /api/v1/order`

```
POST /api/v1/order                            [order-service]    ~50ms
  │
  ├─ query [INSERT INTO orders ...]           [order-service]     ~3ms
  ├─ query [INSERT INTO order_items ...]      [order-service]     ~2ms  (×N items)
  │
  └─ order-events send                        [order-service]     ~1ms
       │
       └─ order-events receive                [payment-service]  ~2100ms
            │
            ├─ payment:processPayment         [payment-service]  ~2000ms  ← @Observed
            │    └─ query [INSERT payment]    [payment-service]     ~3ms
            │
            └─ PUT http://localhost:8081/...  [payment-service]    ~15ms  ← RestTemplate
                 └─ PUT /api/v1/order         [order-service]      ~10ms
                      └─ query [UPDATE orders] [order-service]      ~3ms
```

---

## What Is Observed Where — Summary Table

| Observation point | Service | Mechanism | Config / Code |
|---|---|---|---|
| Inbound HTTP requests | order-service | Spring MVC auto-config | (none — auto) |
| Outbound HTTP (status callback) | payment-service | RestTemplateBuilder auto-config | (none — auto) |
| Kafka produce | order-service | `KafkaTemplate` | `spring.kafka.template.observationEnabled=true` |
| Kafka consume | payment-service | `@KafkaListener` container | `spring.kafka.listener.observationEnabled=true` |
| JDBC / PostgreSQL | both | `datasource-micrometer-spring-boot` | `datasource.proxy.*` |
| `processPayment()` logic | payment-service | `@Observed` annotation | `spring-boot-starter-aop` |

---

## Relevant Files

| File | Role |
|---|---|
| `order-service/pom.xml` | Core tracing stack + datasource-micrometer |
| `payment-service/pom.xml` | Core tracing stack + AOP + micrometer-observation |
| `order-service/src/main/resources/application.properties` | Sampling + OTLP endpoint + Kafka observation |
| `payment-service/src/main/resources/application.properties` | Sampling + OTLP endpoint + Kafka observation |
| `order-service/controller/OrderController.java` | REST endpoints — auto-instrumented root spans |
| `order-service/messaging/OrderProcessingService.java` | `kafkaTemplate.send()` — producer span |
| `payment-service/messaging/PaymentEventHandler.java` | `@KafkaListener` — consumer span |
| `payment-service/service/PaymentService.java` | `@Observed` — explicit custom span |
| `payment-service/PaymentApplication.java` | `RestTemplateBuilder` — outbound HTTP spans |
