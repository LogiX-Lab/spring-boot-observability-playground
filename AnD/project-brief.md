# Spring Boot Observability Playground — Project Brief

## Overview

A two-service Spring Boot 3.5 (Java 25 LTS) demo that shows end-to-end distributed tracing
across an HTTP boundary and a Kafka message bus, using **Micrometer Tracing** + **OpenTelemetry**
with **Jaeger** as the trace backend.

---

## Project Structure

```
spring-boot-observability-playground/
├── pom.xml                          # Parent POM — Spring Boot 3.5.14, Java 25
├── order-service/                   # Service A — HTTP entry point (port 8081)
│   └── src/main/java/…/order/
│       ├── controller/
│       │   └── OrderController      # REST: POST/PUT /api/v1/order
│       ├── service/
│       │   └── OrderService         # Business logic, logs order lifecycle
│       └── messaging/
│           └── OrderProcessingService  # Publishes to Kafka topic: order-events
├── payment-service/                 # Service B — Kafka consumer (port 8082)
│   └── src/main/java/…/payment/
│       ├── messaging/
│       │   └── PaymentEventHandler  # @KafkaListener on order-events
│       └── service/
│           ├── PaymentService       # @Observed — creates an observation span
│           └── OrderUpdateService   # Updates order status after payment
└── .docker/
    ├── compose.yaml                 # All-in-one: Jaeger + Kafka + Kafka UI
    ├── kafka-compose.yaml           # Kafka only (Confluent KRaft, no ZooKeeper)
    └── observe-compose.yaml         # Jaeger only (+ commented Zipkin/Grafana/Prometheus)
```

### Key Kafka topics (auto-created by `kafka-init-topics`)

| Topic                    | Partitions | Producer       | Consumer        |
| ------------------------ | ---------- | -------------- | --------------- |
| `order-events`           | 3          | order-service  | payment-service |
| `order-payment-topic`    | 3          | —              | —               |
| `order-notification-topic` | 2        | —              | —               |

---

## Observability Stack

| Component                              | Role                                          |
| -------------------------------------- | --------------------------------------------- |
| `micrometer-tracing-bridge-otel`       | Micrometer → OpenTelemetry SDK bridge         |
| `opentelemetry-exporter-otlp`          | Exports spans via OTLP HTTP to Jaeger         |
| `spring.kafka.template.observationEnabled=true` | Auto-traces Kafka producer spans    |
| `spring.kafka.listener.observationEnabled=true` | Auto-traces Kafka consumer spans    |
| `management.tracing.sampling.probability=1.0`   | 100% sampling (all requests traced) |
| `management.otlp.tracing.endpoint`     | `http://localhost:4318/v1/traces` (Jaeger)    |
| `@Observed(name = "payment:processPayment")` | Manual span on `PaymentService`          |
| Jaeger UI                              | `http://localhost:16686`                      |
| Kafka UI                               | `http://localhost:8090`                       |

---

## How to Demo Micrometer Tracing

### Step 1 — Start the infrastructure

```bash
cd .docker
docker compose -f compose.yaml up -d
```

Starts: **Jaeger** (`:16686`), **Kafka** broker (`:9092`), **Kafka UI** (`:8090`).

### Step 2 — Start both services

Open two terminals:

```bash
# Terminal 1
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home \
  ./mvnw spring-boot:run -pl order-service

# Terminal 2
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home \
  ./mvnw spring-boot:run -pl payment-service
```

### Step 3 — Trigger a trace

```bash
curl -s -X POST http://localhost:8081/api/v1/order \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1001,
    "customerId": 42,
    "paymentToken": "tok_demo_123",
    "orderStatus": "PLACED",
    "items": [
      { "productId": 7, "quantity": 2 }
    ]
  }'
```

Expected response: `Order has been placed`

### Step 4 — View the trace in Jaeger

1. Open **http://localhost:16686**
2. In the **Service** dropdown, select `order-service`
3. Click **Find Traces**
4. Open the trace — you will see a single distributed trace spanning **both services**:

```
order-service  POST /api/v1/order             ~0 ms  ←  HTTP entry span
  └─ order-service  kafka send → order-events  ~5 ms  ←  Kafka producer span (auto)
       └─ payment-service  receive order-events ~2 s  ←  Kafka consumer span (auto)
               └─ payment-service  payment:processPayment  ~2 s  ←  @Observed span
```

The **trace ID propagates automatically** through Kafka message headers — no manual instrumentation
needed in `OrderProcessingService` or `PaymentEventHandler`.

### What each span demonstrates

| Span | Instrumentation type | Where set |
| ---- | -------------------- | --------- |
| HTTP `POST /api/v1/order` | Auto (Spring MVC + Micrometer) | Spring Boot auto-config |
| Kafka producer `order-events` | Auto (`observationEnabled=true`) | `order-service/application.properties` |
| Kafka consumer `order-events` | Auto (`observationEnabled=true`) | `payment-service/application.properties` |
| `payment:processPayment` | Manual (`@Observed`) | `PaymentService.java` |

### Optional: check the Actuator trace endpoint

```bash
# Current in-memory traces (last 100)
curl http://localhost:8081/actuator/httptrace 2>/dev/null || \
curl http://localhost:8081/actuator/httpexchanges
```

---

## Runtime Requirements

| Requirement | Version |
| ----------- | ------- |
| JDK         | 25.0.1+ |
| Maven       | 3.9+    |
| Docker      | 24+     |

---

## Tech Stack Summary

| Dependency | Version |
| ---------- | ------- |
| Spring Boot | 3.5.14 |
| Spring Kafka | 3.3.15 |
| Micrometer Tracing Bridge (OTel) | 1.5.11 |
| OpenTelemetry OTLP Exporter | 1.49.0 |
| springdoc-openapi (order-service) | 2.8.17 |
| Lombok | 1.18.46 |
| Java | 25 LTS |
