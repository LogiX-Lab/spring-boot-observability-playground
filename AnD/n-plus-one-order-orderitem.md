# N+1 Problem Analysis: Order ↔ OrderItem

## 1. Root Cause in This Codebase

### The Offending Line — `OrderEntity.java:41`

```java
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
private List<OrderItemEntity> items = new ArrayList<>();
```

`FetchType.EAGER` on a `@OneToMany` collection is the most common source of N+1 in JPA.
Spring Data JPA's derived query methods (`findByCustomerIdOrderByCreatedAtDesc`,
`findAllByOrderByCreatedAtDesc`) do **not** emit a JOIN — they issue a plain SELECT,
then let Hibernate satisfy the EAGER contract separately for every row returned.

### The Trigger — `OrderService.java:48–51`

```java
public List<OrderHistoryDto> getOrders(Long customerId) {
    List<OrderEntity> entities = (customerId != null)
            ? orderRepository.findByCustomerIdOrderByCreatedAtDesc(customerId)
            : orderRepository.findAllByOrderByCreatedAtDesc();     // ← triggers N+1
    return entities.stream().map(this::toDto).toList();
}
```

`toDto()` accesses `e.getItems()` for every entity, forcing Hibernate to load items.

---

## 2. SQL Pattern That Is Generated Today

```sql
-- 1 query: load all orders
SELECT o.id, o.customer_id, o.status, o.total_amount, o.created_at, o.updated_at
FROM orders o
ORDER BY o.created_at DESC;

-- N queries: one per order row returned above
SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price
FROM order_items oi WHERE oi.order_id = 1;

SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price
FROM order_items oi WHERE oi.order_id = 2;

-- ... repeated for every order
```

With **N orders** in the result, the database receives **N + 1 round-trips**.

---

## 3. Solutions — Ranked by Fit for This Project

### Solution A — `@EntityGraph` on the Repository (Recommended)

**Change**: Switch `@OneToMany` back to `FetchType.LAZY` (the JPA default), then declare
an `@EntityGraph` on the repository methods that need items.

**`OrderEntity.java`**
```java
// Change EAGER → LAZY (or remove fetch — LAZY is the default for @OneToMany)
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
private List<OrderItemEntity> items = new ArrayList<>();
```

**`OrderRepository.java`**
```java
@EntityGraph(attributePaths = "items")
List<OrderEntity> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

@EntityGraph(attributePaths = "items")
List<OrderEntity> findAllByOrderByCreatedAtDesc();
```

**SQL emitted** — single LEFT OUTER JOIN:
```sql
SELECT DISTINCT o.*, oi.*
FROM orders o
LEFT OUTER JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC;
```

**Pros**: Zero-change to service layer; controlled per query; idiomatic Spring Data JPA.
**Cons**: Returns a Cartesian product at the JDBC level (deduplication by Hibernate).
  For very wide item lists, Solution B (batch) produces less data transfer.

---

### Solution B — `@BatchSize` (Low-Effort, High-Impact)

Add a single annotation to the collection. Hibernate will replace N separate
`WHERE order_id = ?` queries with batched `WHERE order_id IN (?, ?, ...)` queries.

**`OrderEntity.java`**
```java
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
@org.hibernate.annotations.BatchSize(size = 50)
private List<OrderItemEntity> items = new ArrayList<>();
```

Or globally in `application.properties`:
```properties
spring.jpa.properties.hibernate.default_batch_fetch_size=50
```

**SQL emitted** (with batch size 50, 120 orders = 3 queries):
```sql
SELECT * FROM orders ORDER BY created_at DESC;

-- batch 1: orders 1–50
SELECT * FROM order_items WHERE order_id IN (1,2,3,...,50);
-- batch 2: orders 51–100
SELECT * FROM order_items WHERE order_id IN (51,52,...,100);
-- batch 3: orders 101–120
SELECT * FROM order_items WHERE order_id IN (101,...,120);
```

**Pros**: One-line change; no query rewrite; works with any calling code.
**Cons**: Still multiple queries (though far fewer); items are not loaded in the same
  query as orders.

---

### Solution C — JPQL `JOIN FETCH` in Repository

Replace the Spring Data derived queries with explicit JPQL that loads items in one shot.

**`OrderRepository.java`**
```java
@Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items " +
       "WHERE o.customerId = :customerId ORDER BY o.createdAt DESC")
List<OrderEntity> findByCustomerIdWithItems(@Param("customerId") Long customerId);

@Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items " +
       "ORDER BY o.createdAt DESC")
List<OrderEntity> findAllWithItems();
```

**`OrderService.java`** — update the calls:
```java
? orderRepository.findByCustomerIdWithItems(customerId)
: orderRepository.findAllWithItems();
```

**SQL emitted**: Same single LEFT OUTER JOIN as Solution A.

**Pros**: Explicit, readable; no annotation magic; same performance as EntityGraph.
**Cons**: Requires updating the service call sites; query strings must be maintained.
  `DISTINCT` is mandatory to avoid duplicate `OrderEntity` rows from the JOIN.

---

### Solution D — DTO Projection (Maximum Efficiency)

Skip loading entities entirely. Project directly into `OrderHistoryDto` via JPQL
or a Spring Data Projection — zero object mapping overhead.

**`OrderRepository.java`**
```java
@Query("""
    SELECT new com.example.observability.order.model.dto.OrderHistoryDto(
        o.id, o.customerId, o.status, o.totalAmount, o.createdAt, o.updatedAt,
        i.productId, i.quantity, i.price)
    FROM OrderEntity o LEFT JOIN o.items i
    WHERE o.customerId = :customerId
    ORDER BY o.createdAt DESC
    """)
List<OrderHistoryDto> findHistoryByCustomerId(@Param("customerId") Long customerId);
```

> **Note**: This requires an `OrderHistoryDto` constructor that accepts flat arguments and
> groups items internally, or a post-grouping step in the service.

**Pros**: Single query; no entity hydration; smallest memory footprint.
**Cons**: Requires constructor or post-grouping logic; tightest coupling between query and DTO.

---

## 4. Comparison Table

| Solution | Queries for N orders | Code change scope | Complexity |
|---|---|---|---|
| **A — EntityGraph** | 1 (JOIN) | Repository only | Low |
| **B — @BatchSize** | ceil(N / batchSize) | One annotation | Minimal |
| **C — JOIN FETCH JPQL** | 1 (JOIN) | Repository + Service | Low |
| **D — DTO Projection** | 1 (flat JOIN) | Repository + DTO | Medium |
| ❌ Current (EAGER) | N + 1 | — | — |

---

## 5. Recommendation for This Project

**Immediate fix** → apply **Solution B** (global batch size) as a one-line safety net:

```properties
# order-service/src/main/resources/application.properties
spring.jpa.properties.hibernate.default_batch_fetch_size=50
```

**Proper fix** → apply **Solution A** (`@EntityGraph`) on the two `OrderRepository` methods.
Switch `FetchType.LAZY` on `OrderEntity.items` so no other code path accidentally
triggers EAGER loads; annotate only the query methods that actually need items.

Combined, these eliminate the N+1 entirely with minimal code change and no impact to
`OrderService` or the controller layer.
