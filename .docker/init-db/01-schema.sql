-- =============================================================
-- Bootstrap schema for spring-boot-observability-playground
-- Runs automatically on first PostgreSQL container start
-- =============================================================

-- Orders placed via order-service
CREATE TABLE IF NOT EXISTS orders (
    id            BIGINT PRIMARY KEY,
    customer_id   BIGINT         NOT NULL,
    payment_token VARCHAR(255),
    status        VARCHAR(50)    NOT NULL,
    total_amount  DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- Line items belonging to an order
CREATE TABLE IF NOT EXISTS order_items (
    id         BIGSERIAL      PRIMARY KEY,
    order_id   BIGINT         NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id BIGINT         NOT NULL,
    quantity   INT            NOT NULL,
    price      DECIMAL(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id  ON orders (customer_id);

-- Payments processed by payment-service
CREATE TABLE IF NOT EXISTS payments (
    id            BIGSERIAL      PRIMARY KEY,
    order_id      BIGINT         NOT NULL,
    payment_token VARCHAR(255),
    amount        DECIMAL(12, 2) NOT NULL,
    status        VARCHAR(50)    NOT NULL,
    processed_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
