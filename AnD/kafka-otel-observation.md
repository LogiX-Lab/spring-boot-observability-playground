# Kafka Observation & OpenTelemetry — How Jaeger Builds the Dependency Graph

## The Two Config Lines That Wire It Up

```properties
# order-service/src/main/resources/application.properties
spring.kafka.template.observationEnabled=true

# payment-service/src/main/resources/application.properties
spring.kafka.listener.observationEnabled=true
```

These two properties activate Spring Kafka's built-in Micrometer Observation support,
which bridges into OpenTelemetry via `micrometer-tracing-bridge-otel` (already on the classpath).

---

## End-to-End Trace Flow

```
order-service                         Kafka broker                     payment-service
─────────────────────────────────────────────────────────────────────────────────────
POST /api/v1/order
 └─ span: "POST /api/v1/order"
     │
     ├─ span: "query [INSERT orders]"  (PostgreSQL)
     │
     └─ span: "send orders.topic"      ← KafkaTemplate produces span
          │
          │   Message headers injected:
          │   traceparent: 00-<traceId>-<spanId>-01   ──────────────────────►
          │                                                                    │
          │                                              Listener extracts header
          │                                              └─ span: "receive orders.topic"  (child of order-service span)
          │                                                   └─ span: "query [INSERT payment]"  (PostgreSQL)
```

---

## Step-by-Step Mechanism

### 1. Producer side — `spring.kafka.template.observationEnabled=true`

When `KafkaTemplate.send(...)` is called in `OrderProcessingService`, Spring:
- Creates a new **producer span** (`orders.topic send`)
- **Injects the W3C `traceparent` header** into the Kafka message before putting it on the broker

The `traceparent` value looks like:
```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              ^  ^────────── traceId ───────────^ ^── spanId ──^  ^flags
```

### 2. Consumer side — `spring.kafka.listener.observationEnabled=true`

When `@KafkaListener` in `PaymentEventHandler` receives the message, Spring:
- **Extracts the `traceparent` header** from the message
- Creates a new **consumer span** (`orders.topic receive`) as a **child of the producer span**
- All subsequent work (payment logic, PostgreSQL INSERT) runs as children of this consumer span

### 3. Jaeger connects the dots

Both the producer span and consumer span carry the **same `traceId`**. Jaeger:
- Groups all spans with the same `traceId` into one trace
- Reads `service.name` tags (`order-service`, `payment-service`) from each span
- Draws a directed edge `order-service → payment-service` in the System Architecture diagram

---

## Why This Works Without Any Code Changes

Spring Kafka's observation support is built on `io.micrometer:micrometer-observation`.
The project already has `micrometer-tracing-bridge-otel` on the classpath, which translates
Micrometer `Observation` events into OpenTelemetry spans automatically. No manual span
creation or header manipulation is needed.

---

## Dependency Chain in This Project

```
spring.kafka.template.observationEnabled
        │
        ▼
KafkaTemplate  ──► Micrometer Observation
                          │
                          ▼
              micrometer-tracing-bridge-otel
                          │
                          ▼
              opentelemetry-exporter-otlp
                          │
                   HTTP POST /v1/traces
                          │
                          ▼
                    Jaeger (port 4318)
```

---

## Relevant Files

| File | Key Setting |
|------|-------------|
| `order-service/src/main/resources/application.properties` | `spring.kafka.template.observationEnabled=true` |
| `payment-service/src/main/resources/application.properties` | `spring.kafka.listener.observationEnabled=true` |
| `order-service/pom.xml` | `micrometer-tracing-bridge-otel`, `opentelemetry-exporter-otlp` |
| `payment-service/pom.xml` | `micrometer-tracing-bridge-otel`, `opentelemetry-exporter-otlp` |
| `order-service/messaging/OrderProcessingService.java` | Kafka producer |
| `payment-service/messaging/PaymentEventHandler.java` | `@KafkaListener` consumer |
